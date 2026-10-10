import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { remainingCancellationRefundAmount } from '../lib/hotel/cancellationRefund.ts';

test('cancellation reserves only the uncommitted captured refund balance', () => {
  const payment = { amount: 10000, status: 'captured' };
  assert.equal(remainingCancellationRefundAmount(payment, []), 10000);
  assert.equal(
    remainingCancellationRefundAmount(payment, [
      { amount: 2000, status: 'APPROVED' },
      { amount: 3000, status: 'PENDING' },
    ]),
    5000,
  );
  assert.equal(
    remainingCancellationRefundAmount(payment, [{ amount: 10000, status: 'PROCESSING' }]),
    0,
  );
  assert.equal(
    remainingCancellationRefundAmount(payment, [{ amount: 10000, status: 'PROVIDER_FAILED' }]),
    0,
  );
  assert.equal(
    remainingCancellationRefundAmount(payment, [{ amount: 10000, status: 'REJECTED' }]),
    10000,
  );
});

test('uncaptured, invalid and exhausted payments never request a refund', () => {
  assert.equal(remainingCancellationRefundAmount(null, []), 0);
  for (const status of ['pending', 'failed', 'refunded'])
    assert.equal(remainingCancellationRefundAmount({ amount: 10000, status }, []), 0);
  assert.equal(
    remainingCancellationRefundAmount({ amount: 10000, status: 'captured' }, [
      { amount: 10001, status: 'APPROVED' },
    ]),
    0,
  );
  assert.equal(remainingCancellationRefundAmount({ amount: NaN, status: 'captured' }, []), 0);
});

test('persistent cancellation creates a request without prematurely recording a completed payment refund', () => {
  const source = readFileSync('repositories/bookingRepository.ts', 'utf8').split(
    'export class PrismaBookingRepository',
  )[1];
  const cancel = source.slice(0, source.indexOf('async findByConfirmationCode'));
  assert.match(cancel, /refundRequest\.create/);
  assert.match(cancel, /Serializable/);
  assert.doesNotMatch(cancel, /status: 'refunded'/);
  const route = readFileSync('app/api/v1/hotels/bookings/[confirmationCode]/route.ts', 'utf8');
  const deletion = route.slice(route.indexOf('export async function DELETE'));
  assert.ok(deletion.indexOf('isSameOriginMutation(request)') < deletion.indexOf('cancelBooking('));
});
