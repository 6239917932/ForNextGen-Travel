import { InMemoryHotelRepository } from '@/repositories/hotelRepository';
import {
  availabilityLockRepository,
  type AvailabilityLockRepository,
} from '@/repositories/availabilityLockRepository';
import {
  inventoryOverrideRepository,
  type InventoryOverrideRepository,
} from '@/repositories/inventoryOverrideRepository';
import { partnerHotelInventoryRepository } from '@/repositories/partnerHotelInventoryRepository';
import { distanceInKilometres } from '@/lib/hotel/geo';
import { hotelAmenityMatches } from '@/lib/hotel/amenities';
import { hotelStayInputIssue } from '@/lib/hotel/stayRequest';
import { hotelRateStayPrice } from '@/lib/hotel/stayPrice';
import type {
  Hotel,
  HotelSearchCriteria,
  HotelSearchFilters,
  HotelSearchPage,
  HotelSearchResult,
} from '@/types/hotel';
import type { HotelRepository } from '@/repositories/hotelRepository';

export class HotelSearchInputError extends Error {}

function calculateNights(checkInDate: string, checkOutDate: string): number {
  const checkIn = new Date(`${checkInDate}T00:00:00Z`);
  const checkOut = new Date(`${checkOutDate}T00:00:00Z`);

  const durationInMilliseconds = checkOut.getTime() - checkIn.getTime();
  return Math.round(durationInMilliseconds / (1000 * 60 * 60 * 24));
}

function matchesDestination(hotel: Hotel, destination: string): boolean {
  const normalizedDestination = destination.trim().toLowerCase();

  if (!normalizedDestination) {
    return true;
  }

  const searchableText = [
    hotel.name,
    hotel.location.address.locality,
    hotel.location.address.city,
    hotel.location.address.tehsil,
    hotel.location.address.district,
    hotel.location.address.state,
    hotel.location.address.country,
    hotel.location.address.postalCode,
    hotel.location.address.streetAddress,
    ...(hotel.propertyProfile?.locationAliases ?? []),
    ...(hotel.propertyProfile?.landmarks ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return searchableText.includes(normalizedDestination);
}

export class HotelService {
  constructor(
    private readonly hotelRepository: HotelRepository = new InMemoryHotelRepository(),
    private readonly locks: AvailabilityLockRepository = availabilityLockRepository,
    private readonly inventoryOverrides: InventoryOverrideRepository = inventoryOverrideRepository,
  ) {}

  async getHotelBySlug(slug: string): Promise<Hotel | undefined> {
    return this.hotelRepository.findBySlug(slug);
  }

  async getHotels(): Promise<Hotel[]> {
    return this.hotelRepository.findAll();
  }

  async searchHotels(
    criteria: HotelSearchCriteria,
    filters: HotelSearchFilters,
  ): Promise<HotelSearchPage> {
    const issue = hotelStayInputIssue(criteria);
    if (issue) throw new HotelSearchInputError(issue.message);
    const nights = calculateNights(criteria.checkInDate, criteria.checkOutDate);

    const hotels = await this.hotelRepository.findAll();

    const usesRadius =
      filters.radiusKm > 0 &&
      filters.centerLatitude !== undefined &&
      filters.centerLongitude !== undefined;
    const matchingHotels = hotels.filter(
      (hotel) =>
        matchesDestination(hotel, criteria.destination) &&
        (!usesRadius ||
          distanceInKilometres(
            { latitude: filters.centerLatitude!, longitude: filters.centerLongitude! },
            { latitude: hotel.location.latitude, longitude: hotel.location.longitude },
          ) <= filters.radiusKm) &&
        hotel.starRating >= filters.minimumStarRating &&
        (!filters.amenity ||
          hotel.amenities.some((amenity) => hotelAmenityMatches(amenity.name, filters.amenity))),
    );

    const results = await Promise.all(
      matchingHotels.map(async (hotel) => {
        const availability = await Promise.all(
          hotel.rooms.map(async (room) => {
            if (
              !room.isAvailable ||
              room.occupancy.maximumAdults * criteria.rooms < criteria.adults ||
              room.occupancy.maximumChildren * criteria.rooms < criteria.children ||
              room.occupancy.maximumGuests * criteria.rooms < criteria.adults + criteria.children
            ) {
              return false;
            }

            const [reservedLocks, overrideLimit, partnerControl] = await Promise.all([
              this.locks.findReservedByRoomType(
                room.roomTypeId,
                criteria.checkInDate,
                criteria.checkOutDate,
              ),
              this.inventoryOverrides.findLimitForStay(
                room.roomTypeId,
                criteria.checkInDate,
                criteria.checkOutDate,
              ),
              partnerHotelInventoryRepository.findStayControl(
                room.roomTypeId,
                criteria.checkInDate,
                criteria.checkOutDate,
              ),
            ]);
            const reservedRooms = reservedLocks.reduce((total, lock) => total + lock.quantity, 0);
            const effectiveInventory = Math.min(
              room.inventoryCount,
              overrideLimit ?? room.inventoryCount,
              partnerControl.availableRooms ?? room.inventoryCount,
            );
            return !partnerControl.stopSell && effectiveInventory - reservedRooms >= criteria.rooms;
          }),
        );

        const availableRatePlans = await Promise.all(
          hotel.rooms
            .filter((_room, index) => availability[index])
            .flatMap((room) =>
              room.ratePlans
                .filter(
                  (ratePlan) =>
                    nights >= ratePlan.minimumStayNights &&
                    nights <= ratePlan.maximumStayNights &&
                    (!filters.refundableOnly || ratePlan.cancellationPolicy.refundable),
                )
                .map(async (ratePlan) => {
                  const control = await partnerHotelInventoryRepository.findStayControl(
                    room.roomTypeId,
                    criteria.checkInDate,
                    criteria.checkOutDate,
                    ratePlan.nightlyRate.amount,
                    ratePlan.id,
                  );
                  if (control.stopSell) return undefined;
                  return hotelRateStayPrice(
                    ratePlan,
                    nights,
                    criteria.rooms,
                    control.nightlyCharge,
                  );
                }),
            ),
        );

        const lowestRatePlan = availableRatePlans
          .filter(
            (price): price is NonNullable<typeof price> =>
              Boolean(price) &&
              (!filters.maximumNightlyRate ||
                price!.nightlyRate.amount <= filters.maximumNightlyRate),
          )
          .sort((first, second) => first.total.amount - second.total.amount)[0];
        if (!lowestRatePlan) {
          return undefined;
        }

        return {
          ...(usesRadius
            ? {
                distanceKm: distanceInKilometres(
                  { latitude: filters.centerLatitude!, longitude: filters.centerLongitude! },
                  { latitude: hotel.location.latitude, longitude: hotel.location.longitude },
                ),
              }
            : {}),
          hotel,
          isAvailable: true,
          minimumNightlyRate: lowestRatePlan.nightlyRate,
          nights,
          totalStayPrice: lowestRatePlan.total,
        };
      }),
    );

    const sortedResults = results.filter(
      (result): result is HotelSearchResult => result !== undefined,
    );
    sortedResults.sort((firstResult, secondResult) => {
      if (filters.sort === 'price-descending') {
        return secondResult.totalStayPrice.amount - firstResult.totalStayPrice.amount;
      }
      if (filters.sort === 'rating-descending') {
        return (
          secondResult.hotel.reviewSummary.averageRating -
            firstResult.hotel.reviewSummary.averageRating ||
          secondResult.hotel.reviewSummary.reviewCount - firstResult.hotel.reviewSummary.reviewCount
        );
      }
      return firstResult.totalStayPrice.amount - secondResult.totalStayPrice.amount;
    });

    const pageSize = 10;
    const pageCount = Math.max(1, Math.ceil(sortedResults.length / pageSize));
    const page = Math.min(filters.page, pageCount);
    return {
      page,
      pageCount,
      pageSize,
      results: sortedResults.slice((page - 1) * pageSize, page * pageSize),
      totalResults: sortedResults.length,
    };
  }
}

export const hotelService = new HotelService();
