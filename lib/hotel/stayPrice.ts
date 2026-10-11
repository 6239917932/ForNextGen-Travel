import type { HotelRatePlan, Money } from '../../types/hotel.ts';

export function hotelRateStayPrice(
  ratePlan: HotelRatePlan,
  nights: number,
  rooms: number,
  seasonalRoomCharge?: number,
): { nightlyRate: Money; total: Money } | undefined {
  const roomCharge = seasonalRoomCharge ?? ratePlan.nightlyRate.amount * nights;
  const roomMinor = Math.round(roomCharge * 100);
  const taxMinor = Math.round(ratePlan.taxesAndFees.amount * 100);
  const totalMinor = (roomMinor + taxMinor * nights) * rooms;
  if (
    ratePlan.nightlyRate.currency !== ratePlan.taxesAndFees.currency ||
    !Number.isSafeInteger(nights) ||
    nights < 1 ||
    !Number.isSafeInteger(rooms) ||
    rooms < 1 ||
    !['INR', 'USD'].includes(ratePlan.nightlyRate.currency) ||
    !Number.isFinite(ratePlan.nightlyRate.amount) ||
    ratePlan.nightlyRate.amount <= 0 ||
    !Number.isSafeInteger(roomMinor) ||
    roomMinor < 1 ||
    Math.abs(roomMinor - roomCharge * 100) > 0.000001 ||
    !Number.isSafeInteger(taxMinor) ||
    taxMinor < 0 ||
    Math.abs(taxMinor - ratePlan.taxesAndFees.amount * 100) > 0.000001 ||
    !Number.isSafeInteger(totalMinor) ||
    totalMinor < 1
  )
    return undefined;
  return {
    nightlyRate: {
      amount: Math.round(roomCharge / nights),
      currency: ratePlan.nightlyRate.currency,
    },
    total: { amount: totalMinor / 100, currency: ratePlan.nightlyRate.currency },
  };
}
