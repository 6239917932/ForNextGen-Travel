import { formatIndiaCalendarDate, isValidCalendarDate } from '../../utils/localDate.ts';

export type HotelStayInput = {
  adults: number;
  checkInDate: string;
  checkOutDate: string;
  children: number;
  rooms: number;
};

export function hotelStayInputIssue(input: HotelStayInput, today = formatIndiaCalendarDate()) {
  if (!isValidCalendarDate(input.checkInDate) || !isValidCalendarDate(input.checkOutDate)) {
    return { code: 'INVALID_STAY_DATES', message: 'Enter valid check-in and check-out dates.' };
  }
  const nights =
    (Date.parse(`${input.checkOutDate}T00:00:00Z`) - Date.parse(`${input.checkInDate}T00:00:00Z`)) /
    86_400_000;
  if (nights < 1 || nights > 90) {
    return { code: 'INVALID_STAY_DATES', message: 'Choose a stay between 1 and 90 nights.' };
  }
  if (input.checkInDate < today) {
    return { code: 'PAST_CHECK_IN', message: 'Check-in date cannot be in the past.' };
  }
  if (
    !Number.isSafeInteger(input.rooms) ||
    input.rooms < 1 ||
    input.rooms > 20 ||
    !Number.isSafeInteger(input.adults) ||
    input.adults < 1 ||
    input.adults > 60 ||
    !Number.isSafeInteger(input.children) ||
    input.children < 0 ||
    input.children > 40
  ) {
    return {
      code: 'INVALID_OCCUPANCY',
      message: 'Choose whole numbers: 1–20 rooms, 1–60 adults, and 0–40 children.',
    };
  }
  return undefined;
}
