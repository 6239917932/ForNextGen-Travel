export function remainingCancellationRefundAmount(
  payment: { amount: number; status: string } | null,
  refunds: readonly { amount: number; status: string }[],
): number {
  if (
    !payment ||
    payment.status !== 'captured' ||
    !Number.isSafeInteger(payment.amount) ||
    payment.amount < 1
  )
    return 0;
  const reserved = refunds.filter((refund) =>
    ['PENDING', 'PROCESSING', 'PROVIDER_FAILED', 'APPROVED'].includes(refund.status),
  );
  if (reserved.some((refund) => !Number.isSafeInteger(refund.amount) || refund.amount < 1))
    return 0;
  const remainder = payment.amount - reserved.reduce((total, refund) => total + refund.amount, 0);
  return Number.isSafeInteger(remainder) && remainder > 0 ? remainder : 0;
}
