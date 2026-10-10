import { NextResponse } from 'next/server';
import { readTextBody } from '@/lib/api/request';
import { paymentPayloadHash, verifyPaymentWebhook } from '@/lib/payments/gateway';
import { verifyPayuResponseHash } from '@/lib/payments/payu';
import {
  isRazorpayOrderId,
  isRazorpayPaymentId,
  verifyRazorpayWebhookSignature,
} from '@/lib/payments/razorpay';
import { prisma } from '@/lib/prisma';
import { hasPrismaErrorCode } from '@/lib/prismaErrors';
import { reconcilePayuCheckout } from '@/services/payuPaymentReconciliationService';

type Context = { params: Promise<{ provider: string }> };
type ProviderEvent = {
  amount?: unknown;
  currency?: unknown;
  id?: unknown;
  paymentReference?: unknown;
  type?: unknown;
};

const PROVIDER_PATTERN = /^[a-z0-9][a-z0-9_-]{0,49}$/;

function isBoundedProviderValue(value: unknown, maximumLength: number): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maximumLength &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

export async function POST(request: Request, context: Context) {
  const { provider } = await context.params;
  if (!PROVIDER_PATTERN.test(provider))
    return NextResponse.json({ error: { code: 'WEBHOOK_PROVIDER_INVALID' } }, { status: 400 });
  const payload = await readTextBody(request);
  if (payload === null)
    return NextResponse.json({ error: { code: 'WEBHOOK_PAYLOAD_TOO_LARGE' } }, { status: 413 });
  if (provider === 'razorpay') {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? '';
    const signature = request.headers.get('x-razorpay-signature') ?? '';
    if (!secret || secret.length < 16)
      return NextResponse.json({ error: { code: 'WEBHOOK_NOT_CONFIGURED' } }, { status: 503 });
    if (!verifyRazorpayWebhookSignature({ payload, signature, secret }))
      return NextResponse.json({ error: { code: 'WEBHOOK_SIGNATURE_INVALID' } }, { status: 401 });
    let event: {
      event?: unknown;
      payload?: { payment?: { entity?: Record<string, unknown> } };
    };
    try {
      event = JSON.parse(payload) as typeof event;
    } catch {
      return NextResponse.json({ error: { code: 'WEBHOOK_PAYLOAD_INVALID' } }, { status: 400 });
    }
    const eventId = request.headers.get('x-razorpay-event-id') ?? '';
    const eventType = typeof event.event === 'string' ? event.event : '';
    const payment = event.payload?.payment?.entity;
    const orderId = payment?.order_id;
    const paymentId = payment?.id;
    if (
      !payment ||
      !/^[A-Za-z0-9_-]{8,200}$/.test(eventId) ||
      !['payment.captured', 'payment.failed'].includes(eventType) ||
      !isRazorpayOrderId(orderId) ||
      !isRazorpayPaymentId(paymentId)
    ) {
      return NextResponse.json({ data: { accepted: true, ignored: true } }, { status: 202 });
    }
    const verifiedPayment = payment;
    try {
      await prisma.$transaction(async (transaction) => {
        const existing = await transaction.paymentProviderEvent.findUnique({
          where: { provider_providerEventId: { provider, providerEventId: eventId } },
        });
        if (existing) return;
        const intent = await transaction.paymentCheckoutIntent.findUnique({
          where: { providerRef: orderId },
        });
        const captured = eventType === 'payment.captured';
        const amountMatches =
          typeof verifiedPayment.amount === 'number' &&
          verifiedPayment.amount === (intent?.amount ?? 0) * 100 &&
          verifiedPayment.currency === intent?.currency;
        const accepted =
          Boolean(intent) && intent?.provider === 'razorpay' && (!captured || amountMatches);
        await transaction.paymentProviderEvent.create({
          data: {
            errorMessage: accepted
              ? ''
              : 'Razorpay order, amount, currency, or provider did not match.',
            eventType,
            payloadHash: paymentPayloadHash(payload),
            processedAt: new Date(),
            provider,
            providerEventId: eventId,
            providerRef: orderId,
            status: accepted ? 'PROCESSED' : 'REJECTED',
          },
        });
        if (accepted && captured) {
          await transaction.paymentCheckoutIntent.updateMany({
            data: {
              capturedAt: new Date(),
              capturedProviderRef: paymentId,
              status: 'CAPTURED',
            },
            where: { id: intent?.id, status: 'CREATED' },
          });
        }
      });
    } catch (error) {
      if (!hasPrismaErrorCode(error, 'P2002')) throw error;
    }
    return NextResponse.json({ data: { accepted: true } });
  }
  if (provider === 'payu') {
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().startsWith('application/x-www-form-urlencoded')) {
      return NextResponse.json(
        { error: { code: 'WEBHOOK_CONTENT_TYPE_INVALID' } },
        { status: 415 },
      );
    }
    const fields = Object.fromEntries(new URLSearchParams(payload).entries());
    const key = process.env.PAYU_MERCHANT_KEY?.trim() ?? '';
    const salt = process.env.PAYU_MERCHANT_SALT?.trim() ?? '';
    if (!key || !salt)
      return NextResponse.json({ error: { code: 'WEBHOOK_NOT_CONFIGURED' } }, { status: 503 });
    if (fields.key !== key || !verifyPayuResponseHash(fields, salt)) {
      return NextResponse.json({ error: { code: 'WEBHOOK_SIGNATURE_INVALID' } }, { status: 401 });
    }
    try {
      const result = await reconcilePayuCheckout(fields.txnid ?? '');
      if (!result)
        return NextResponse.json({ error: { code: 'WEBHOOK_PAYMENT_UNKNOWN' } }, { status: 400 });
      return NextResponse.json({
        data: {
          accepted: true,
          state: result.state,
        },
      });
    } catch {
      return NextResponse.json(
        { error: { code: 'WEBHOOK_RECONCILIATION_FAILED' } },
        { status: 503 },
      );
    }
  }
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret || secret.length < 32)
    return NextResponse.json({ error: { code: 'WEBHOOK_NOT_CONFIGURED' } }, { status: 503 });
  const signature = request.headers.get('x-payment-signature') ?? '';
  const timestamp = request.headers.get('x-payment-timestamp') ?? '';
  if (!verifyPaymentWebhook({ payload, signature, timestamp, secret }))
    return NextResponse.json({ error: { code: 'WEBHOOK_SIGNATURE_INVALID' } }, { status: 401 });
  let parsed: ProviderEvent;
  try {
    parsed = JSON.parse(payload) as ProviderEvent;
  } catch {
    return NextResponse.json({ error: { code: 'WEBHOOK_PAYLOAD_INVALID' } }, { status: 400 });
  }
  if (
    !isBoundedProviderValue(parsed.id, 200) ||
    !isBoundedProviderValue(parsed.type, 100) ||
    !isBoundedProviderValue(parsed.paymentReference, 200)
  )
    return NextResponse.json({ error: { code: 'WEBHOOK_PAYLOAD_INVALID' } }, { status: 400 });
  const eventId = parsed.id;
  const eventType = parsed.type;
  const paymentReference = parsed.paymentReference;
  const existing = await prisma.paymentProviderEvent.findUnique({
    where: { provider_providerEventId: { provider, providerEventId: eventId } },
  });
  if (existing) return NextResponse.json({ data: { accepted: true, duplicate: true } });
  const intentStatus =
    eventType === 'payment.captured'
      ? 'CAPTURED'
      : eventType === 'payment.failed'
        ? 'FAILED'
        : undefined;
  try {
    await prisma.$transaction(async (transaction) => {
      const intent = await transaction.paymentCheckoutIntent.findUnique({
        where: { providerRef: paymentReference },
      });
      const captureMatches =
        eventType !== 'payment.captured' ||
        (typeof parsed.amount === 'number' &&
          Number.isSafeInteger(parsed.amount) &&
          parsed.amount > 0 &&
          parsed.amount === intent?.amount &&
          isBoundedProviderValue(parsed.currency, 10) &&
          parsed.currency === intent?.currency);
      const accepted =
        Boolean(intent) && intent?.provider === provider && Boolean(intentStatus) && captureMatches;
      await transaction.paymentProviderEvent.create({
        data: {
          provider,
          providerEventId: eventId,
          eventType,
          providerRef: paymentReference,
          payloadHash: paymentPayloadHash(payload),
          errorMessage: accepted
            ? ''
            : !intent
              ? 'Unknown payment reference.'
              : intent.provider !== provider
                ? 'Provider does not match checkout intent.'
                : !captureMatches
                  ? 'Captured amount or currency does not match checkout intent.'
                  : 'Unsupported payment event type.',
          status: accepted ? 'PROCESSED' : intentStatus ? 'REJECTED' : 'IGNORED',
          processedAt: new Date(),
        },
      });
      if (accepted && intentStatus)
        await transaction.paymentCheckoutIntent.updateMany({
          where: { id: intent?.id, status: 'CREATED' },
          data: {
            status: intentStatus,
            capturedAt: intentStatus === 'CAPTURED' ? new Date() : null,
          },
        });
    });
  } catch (error) {
    if (hasPrismaErrorCode(error, 'P2002'))
      return NextResponse.json({ data: { accepted: true, duplicate: true } });
    throw error;
  }
  return NextResponse.json({ data: { accepted: true, duplicate: false } }, { status: 202 });
}
