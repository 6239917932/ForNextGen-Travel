import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { mockHotels } from '../constants/hotelData.ts';
import { formatIndiaCalendarDate, offsetLocalCalendarDate } from '../utils/localDate.ts';

// Fixed independent preview: never accept an arbitrary base URL or production DB.
const origin = 'http://127.0.0.1:3049';
const database = new Database('prisma/ota-preview-independent.db', {
  readonly: true,
  fileMustExist: true,
});
const request = (route, init = {}) =>
  fetch(`${origin}${route}`, {
    ...init,
    redirect: 'manual',
    signal: AbortSignal.timeout(60000),
    headers: { Origin: origin, 'Content-Type': 'application/json', ...init.headers },
  });
try {
  const home = await request('/');
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Sample hotel inventory and prices are for testing/);
  assert.match(home.headers.get('x-robots-tag') ?? '', /noindex/);
  const hotel = mockHotels[0];
  const room = hotel.rooms[0];
  const rate = room.ratePlans[0];
  const checkInDate = offsetLocalCalendarDate(formatIndiaCalendarDate(), 14);
  const quoteInput = {
    adults: 2,
    children: 0,
    rooms: 1,
    checkInDate,
    checkOutDate: offsetLocalCalendarDate(checkInDate, 2),
    hotelSlug: hotel.slug,
    roomTypeId: room.roomTypeId,
    ratePlanId: rate.id,
  };
  for (const invalid of [
    { ...quoteInput, adults: 1.5 },
    { ...quoteInput, checkInDate: '2027-02-31', checkOutDate: '2027-03-05' },
  ]) {
    const rejected = await request('/api/v1/hotels/quotes', {
      method: 'POST',
      body: JSON.stringify(invalid),
    });
    assert.equal(rejected.status, 409);
  }
  const quoteResponse = await request('/api/v1/hotels/quotes', {
    method: 'POST',
    body: JSON.stringify(quoteInput),
  });
  const quoteBody = await quoteResponse.json();
  assert.equal(quoteResponse.status, 201, JSON.stringify(quoteBody));
  const quote = quoteBody.data;
  const bookingInput = {
    hotelSlug: hotel.slug,
    quoteId: quote.id,
    availabilityLockId: quote.availabilityLock.id,
    guest: {
      firstName: 'Sample',
      lastName: 'Traveller',
      email: 'ota-audit@example.invalid',
      phone: '0000000000',
      specialRequests: 'Synthetic local audit only',
    },
  };
  const key = `hotel-booking-${randomUUID()}`;
  const created = await request('/api/v1/hotels/bookings', {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify(bookingInput),
  });
  const createdBody = await created.json();
  assert.equal(created.status, 201, JSON.stringify(createdBody));
  const code = createdBody.data.confirmationCode;
  const cookie = created.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  assert.ok(cookie);
  const replay = await request('/api/v1/hotels/bookings', {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify(bookingInput),
  });
  assert.equal(replay.status, 201);
  assert.equal((await replay.json()).data.confirmationCode, code);
  const route = `/api/v1/hotels/bookings/${code}`;
  assert.equal((await request(route)).status, 401);
  assert.equal(
    (
      await request(route, {
        method: 'DELETE',
        headers: { Cookie: cookie, Origin: 'https://cross-site.example.invalid' },
      })
    ).status,
    403,
  );
  for (let retry = 0; retry < 2; retry++) {
    const cancelled = await request(route, { method: 'DELETE', headers: { Cookie: cookie } });
    assert.equal(cancelled.status, 200);
    const result = (await cancelled.json()).data;
    assert.equal(result.status, 'cancelled');
    assert.equal(result.paymentStatus, 'captured');
  }
  const payment = database
    .prepare(
      'SELECT p.id, p.status, p.environment, p.amount FROM PaymentTransaction p JOIN Booking b ON b.id=p.bookingId WHERE b.confirmationCode=?',
    )
    .get(code);
  assert.equal(payment.environment, 'SANDBOX');
  assert.equal(payment.status, 'captured');
  const refunds = database
    .prepare('SELECT status, amount FROM RefundRequest WHERE paymentId=?')
    .all(payment.id);
  assert.equal(refunds.length, 1);
  assert.equal(refunds[0].status, 'PENDING');
  assert.equal(refunds[0].amount, payment.amount);
  console.log(
    'Sample quote, booking, idempotent replay, access denial and cancellation/refund request verified.',
  );
  console.log(
    'No provider calls or live money movement. Synthetic audit records are preserved in the independent preview database.',
  );
} finally {
  database.close();
}
