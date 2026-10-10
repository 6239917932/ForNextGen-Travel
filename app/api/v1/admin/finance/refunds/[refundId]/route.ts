import { NextResponse } from 'next/server';

import { isSameOriginMutation, readJsonObject } from '@/lib/api/request';
import { getPlatformAdmin } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';
import { hasPrismaErrorCode } from '@/lib/prismaErrors';
import type { Prisma } from '@/generated/prisma/client';
import { createRefundPostings } from '@/lib/payments/accounting';
import {
  createLedgerData,
  isRefundDecision,
  normalizeFinanceNote,
} from '@/services/adminFinanceService';
import { dispatchProviderRefund } from '@/services/paymentGatewayService';
import { reversePromotionForConfirmedFullRefund } from '@/services/promotionRedemptionService';

type RouteContext = { params: Promise<{ refundId: string }> };

async function serializableTransactionWithRetry<T>(
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (!hasPrismaErrorCode(error, 'P2034') || attempt === 2) throw error;
    }
  }
  throw new Error('Serializable refund accounting retry exhausted.');
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!isSameOriginMutation(request))
    return Response.json({ error: 'Invalid origin.' }, { status: 403 });
  const administrator = await getPlatformAdmin();
  if (!administrator) {
    return NextResponse.json(
      { error: 'Platform administrator access is required.' },
      { status: 403 },
    );
  }
  const body = await readJsonObject(request, 4096);
  const decision = body?.decision;
  const note = normalizeFinanceNote(body?.note);
  if (!isRefundDecision(decision) || (decision === 'REJECT' && note.length < 5)) {
    return NextResponse.json(
      { error: 'Provide a valid refund decision and review note.' },
      { status: 400 },
    );
  }
  const { refundId } = await context.params;
  try {
    if (decision === 'REJECT') {
      const rejected = await prisma.refundRequest.updateMany({
        data: {
          reviewNote: note,
          reviewedAt: new Date(),
          reviewedByUserId: administrator.id,
          status: 'REJECTED',
        },
        where: { id: refundId, status: 'PENDING' },
      });
      if (rejected.count !== 1) {
        return NextResponse.json(
          { error: 'Only pending refunds can be reviewed.' },
          { status: 409 },
        );
      }
      return NextResponse.json({ data: { id: refundId, status: 'REJECTED' } });
    }

    const claimed = await prisma.$transaction(async (transaction) => {
      const result = await transaction.refundRequest.updateMany({
        data: { status: 'PROCESSING' },
        where: { id: refundId, status: { in: ['PENDING', 'PROVIDER_FAILED'] } },
      });
      if (result.count !== 1) return null;
      return transaction.refundRequest.findUnique({
        include: {
          payment: { select: { amount: true, bookingId: true, id: true, providerRef: true } },
        },
        where: { id: refundId },
      });
    });
    if (!claimed) {
      return NextResponse.json(
        { error: 'Only pending or failed refunds can be approved.' },
        { status: 409 },
      );
    }

    let providerRefundRef: string;
    try {
      const providerResult = await dispatchProviderRefund({
        amount: claimed.amount,
        currency: claimed.currency,
        idempotencyKey: `refund-${claimed.id}`,
        providerPaymentRef: claimed.payment.providerRef,
        reason: claimed.reason,
      });
      providerRefundRef = providerResult.providerRefundRef;
    } catch (error) {
      await prisma.refundRequest.updateMany({
        data: { status: 'PROVIDER_FAILED' },
        where: { id: claimed.id, status: 'PROCESSING' },
      });
      console.error('Provider refund dispatch failed.', error);
      return NextResponse.json(
        { error: 'The provider did not complete the refund. It remains available for retry.' },
        { status: 503 },
      );
    }

    const refund = await serializableTransactionWithRetry(async (transaction) => {
      const completed = await transaction.refundRequest.updateMany({
        data: {
          providerRefundRef,
          reviewNote: note,
          reviewedAt: new Date(),
          reviewedByUserId: administrator.id,
          status: 'APPROVED',
        },
        where: { id: claimed.id, status: 'PROCESSING' },
      });
      if (completed.count !== 1) return null;
      const existingJournal = await transaction.financialJournal.findUnique({
        where: { reference: `REFUND-${claimed.id}` },
      });
      if (!existingJournal) {
        const postings = createRefundPostings(claimed.amount);
        await transaction.financialJournal.create({
          data: {
            createdByUserId: administrator.id,
            currency: claimed.currency,
            description: `Completed provider refund for ${claimed.reason}`,
            postings: { create: postings },
            reference: `REFUND-${claimed.id}`,
            refundId: claimed.id,
            sourceId: claimed.id,
            sourceType: 'REFUND_APPROVED',
            totalCredit: claimed.amount,
            totalDebit: claimed.amount,
          },
        });
        await transaction.financialLedgerEntry.create({
          data: createLedgerData({
            amount: -claimed.amount,
            createdByUserId: administrator.id,
            currency: claimed.currency,
            description: `Completed provider refund for ${claimed.reason}`,
            entryType: 'REFUND_APPROVED',
            reference: claimed.id,
            refundId: claimed.id,
          }),
        });
      }
      await reversePromotionForConfirmedFullRefund(transaction, {
        bookingId: claimed.payment.bookingId,
        paymentAmount: claimed.payment.amount,
        paymentId: claimed.payment.id,
        reason: `Provider-confirmed full refund completed by refund ${claimed.id}.`,
      });
      const approvedRefunds = await transaction.refundRequest.aggregate({
        _sum: { amount: true },
        where: { paymentId: claimed.payment.id, status: 'APPROVED' },
      });
      if ((approvedRefunds._sum.amount ?? 0) >= claimed.payment.amount) {
        await transaction.paymentTransaction.updateMany({
          data: { status: 'refunded' },
          where: { id: claimed.payment.id, status: 'captured' },
        });
      }
      return transaction.refundRequest.findUnique({ where: { id: claimed.id } });
    });
    if (!refund) {
      return NextResponse.json(
        { error: 'The refund state changed while it was processed.' },
        { status: 409 },
      );
    }
    return NextResponse.json({ data: { id: refund.id, status: refund.status } });
  } catch (error) {
    console.error('Refund review failed.', error);
    return NextResponse.json({ error: 'The refund could not be reviewed.' }, { status: 500 });
  }
}
