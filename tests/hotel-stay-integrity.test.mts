import assert from 'node:assert/strict';
import test from 'node:test';
import { hotelStayInputIssue } from '../lib/hotel/stayRequest.ts';
import { hotelRateStayPrice } from '../lib/hotel/stayPrice.ts';
import type { HotelRatePlan } from '../types/hotel.ts';

const stay = {
  adults: 2,
  children: 0,
  rooms: 1,
  checkInDate: '2027-03-01',
  checkOutDate: '2027-03-04',
};
const today = '2026-10-10';
const rate: HotelRatePlan = {
  id: 'sample',
  name: 'Sample rate',
  mealPlan: 'room-only',
  minimumStayNights: 1,
  maximumStayNights: 90,
  cancellationPolicy: { description: 'Sample', refundable: false },
  nightlyRate: { amount: 3000, currency: 'INR' },
  taxesAndFees: { amount: 100, currency: 'INR' },
};

test('quotes reject overflowed dates, excessive stays and past check-in before inventory work', () => {
  assert.equal(hotelStayInputIssue(stay, today), undefined);
  for (const input of [
    { ...stay, checkInDate: '2027-02-31' },
    { ...stay, checkOutDate: '2027-03-01' },
    { ...stay, checkOutDate: '2027-07-01' },
    { ...stay, checkInDate: '2026-01-01' },
  ])
    assert.ok(hotelStayInputIssue(input, today));
});

test('quotes reject fractional, nonfinite and excessive occupancy', () => {
  for (const field of ['adults', 'children', 'rooms'] as const) {
    for (const value of [1.5, NaN, Infinity, -1, Number.MAX_SAFE_INTEGER]) {
      assert.equal(
        hotelStayInputIssue({ ...stay, [field]: value }, today)?.code,
        'INVALID_OCCUPANCY',
      );
    }
  }
  assert.equal(
    hotelStayInputIssue({ ...stay, rooms: 20, adults: 60, children: 40 }, today),
    undefined,
  );
});

test('seasonal search totals preserve the exact stay charge rather than multiplying a rounded average', () => {
  const price = hotelRateStayPrice(rate, 3, 2, 10001);
  assert.equal(price?.nightlyRate.amount, 3334);
  assert.equal(price?.total.amount, 20602);
  assert.notEqual(price?.total.amount, (3334 + 100) * 3 * 2);
});

test('currency and invalid supplier prices fail closed while decimal money stays precise', () => {
  assert.equal(
    hotelRateStayPrice({ ...rate, taxesAndFees: { amount: 100, currency: 'USD' } }, 3, 1),
    undefined,
  );
  for (const amount of [NaN, Infinity, -1])
    assert.equal(hotelRateStayPrice(rate, 3, 1, amount), undefined);
  const price = hotelRateStayPrice(
    {
      ...rate,
      nightlyRate: { amount: 10.1, currency: 'USD' },
      taxesAndFees: { amount: 0.2, currency: 'USD' },
    },
    3,
    1,
  );
  assert.equal(price?.total.amount, 30.9);
});
