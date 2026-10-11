import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('public booking forms prevent past dates and link end dates to start dates', () => {
  const home = source('components/home/HomeBookingWidget.tsx');
  const hotels = source('components/hotel/HotelSearchForm.tsx');
  const cars = source('components/car/CarSearchForm.tsx');
  const buses = source('components/bus/BusSearchForm.tsx');
  const flights = source('components/flight/FlightSearchForm.tsx');

  assert.match(home, /min=\{today\}/);
  assert.match(home, /min=\{offsetLocalCalendarDate\(hotelCheckIn, 1\)\}/);
  assert.match(hotels, /min=\{today\}/);
  assert.match(hotels, /min=\{offsetLocalCalendarDate\(checkInDate, 1\)\}/);
  assert.match(cars, /min=\{today\}/);
  assert.match(cars, /min=\{offsetLocalCalendarDate\(pickupDate, 1\)\}/);
  assert.match(buses, /min=\{today\}/);
  assert.match(flights, /min=\{today\}/);
  assert.match(flights, /min=\{offsetLocalCalendarDate\(departureDate, 1\)\}/);
});

test('hotel discovery rejects malformed and historical dates on the server', () => {
  const service = source('services/hotelService.ts');
  assert.match(service, /hotelStayInputIssue\(criteria\)/);
  const rules = source('lib/hotel/stayRequest.ts');
  assert.match(rules, /isValidCalendarDate\(input\.checkInDate\)/);
  assert.match(rules, /input\.checkInDate < today/);
});
