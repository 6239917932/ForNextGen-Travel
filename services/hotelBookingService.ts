import { calculatePromotion } from '@/constants/promotionRules';
import { normalizeEmail } from '@/lib/auth/validation';
import { createBookingAccessToken, hashBookingAccessToken } from '@/lib/bookingAccessToken';
import { createBookingReference } from '@/lib/confirmationCode';
import { prisma } from '@/lib/prisma';
import { formatIndiaCalendarDate } from '@/utils/localDate';
import { hotelStayInputIssue } from '@/lib/hotel/stayRequest';
import { hotelRateStayPrice } from '@/lib/hotel/stayPrice';

import {
  availabilityLockRepository,
  type AvailabilityLockRepository,
} from '@/repositories/availabilityLockRepository';
import { hotelService, type HotelService } from '@/services/hotelService';
import { resolvePromotionRule } from '@/services/promotionService';
import { PromotionRedemptionError } from '@/services/promotionRedemptionService';
import {
  confirmPaymentForBooking,
  PaymentConfirmationError,
} from '@/services/paymentConfirmationService';
import {
  bookingRepository,
  BusinessBookingRequestUnavailableError,
  type BookingRepository,
  type BusinessBookingContext,
  type PartnerBookingQuery,
} from '@/repositories/bookingRepository';
import { quoteRepository, type QuoteRepository } from '@/repositories/quoteRepository';
import { amendmentRepository, type AmendmentRepository } from '@/repositories/amendmentRepository';
import {
  inventoryOverrideRepository,
  type InventoryOverrideRepository,
} from '@/repositories/inventoryOverrideRepository';
import { partnerHotelInventoryRepository } from '@/repositories/partnerHotelInventoryRepository';
import {
  listAvailableHotelBookingAddons,
  PartnerBookingAddonError,
  quoteHotelBookingAddons,
} from '@/services/partnerBookingAddonService';
import type {
  BookingAmendmentRecord,
  CreateHotelBookingRequest,
  CreatedHotelBooking,
  HotelBookingRecord,
  ManagedHotelBooking,
  HotelQuote,
  HotelQuoteRequest,
  PriceComponent,
  PartnerAmendmentRecord,
  PartnerBookingRecord,
  PartnerInventoryRecord,
} from '@/types/commerce';

const availabilityLockTtlMilliseconds = 10 * 60 * 1000;

export class HotelBookingRuleError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HotelBookingRuleError';
  }
}

function calculateNights(checkInDate: string, checkOutDate: string): number {
  const checkIn = new Date(`${checkInDate}T00:00:00Z`);
  const checkOut = new Date(`${checkOutDate}T00:00:00Z`);
  return Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000);
}

function isRefundEligible(
  checkInDate: string | undefined,
  checkInTime: string | undefined,
  timezone: string | undefined,
  refundable: boolean,
  cutoffHours: number | undefined,
): boolean {
  if (!refundable || !checkInDate || !checkInTime || cutoffHours === undefined) {
    return false;
  }
  const checkIn = localDateTimeToUtc(checkInDate, checkInTime, timezone ?? 'Asia/Kolkata');
  return Number.isFinite(checkIn) && Date.now() < checkIn - cutoffHours * 60 * 60 * 1000;
}

function localDateTimeToUtc(date: string, time: string, timezone: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match || !timeMatch) return Number.NaN;
  const localWallClock = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
  );
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
      minute: '2-digit',
      month: '2-digit',
      timeZone: timezone,
      year: 'numeric',
    });
    let candidate = localWallClock;
    for (let pass = 0; pass < 2; pass += 1) {
      const parts = Object.fromEntries(
        formatter
          .formatToParts(new Date(candidate))
          .filter((part) => part.type !== 'literal')
          .map((part) => [part.type, Number(part.value)]),
      );
      const renderedWallClock = Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour === 24 ? 0 : parts.hour,
        parts.minute,
      );
      candidate += localWallClock - renderedWallClock;
    }
    return candidate;
  } catch {
    return Number.NaN;
  }
}

export class HotelBookingService {
  constructor(
    private readonly hotels: HotelService = hotelService,
    private readonly locks: AvailabilityLockRepository = availabilityLockRepository,
    private readonly quotes: QuoteRepository = quoteRepository,
    private readonly bookings: BookingRepository = bookingRepository,
    private readonly amendments: AmendmentRepository = amendmentRepository,
    private readonly inventoryOverrides: InventoryOverrideRepository = inventoryOverrideRepository,
  ) {}

  async createQuote(request: HotelQuoteRequest): Promise<HotelQuote> {
    const issue = hotelStayInputIssue(request);
    if (issue) throw new HotelBookingRuleError(issue.code, issue.message);
    const nights = calculateNights(request.checkInDate, request.checkOutDate);

    const hotel = await this.hotels.getHotelBySlug(request.hotelSlug);
    if (!hotel) {
      throw new HotelBookingRuleError('HOTEL_NOT_FOUND', 'The selected hotel is unavailable.');
    }

    const room = hotel.rooms.find((candidate) => candidate.roomTypeId === request.roomTypeId);
    if (!room || !room.isAvailable) {
      throw new HotelBookingRuleError('ROOM_UNAVAILABLE', 'The selected room is unavailable.');
    }

    const maximumAdults = room.occupancy.maximumAdults * request.rooms;
    const maximumChildren = room.occupancy.maximumChildren * request.rooms;
    const maximumGuests = room.occupancy.maximumGuests * request.rooms;
    if (
      request.adults > maximumAdults ||
      request.children > maximumChildren ||
      request.adults + request.children > maximumGuests
    ) {
      throw new HotelBookingRuleError(
        'OCCUPANCY_EXCEEDED',
        'The selected room allocation cannot accommodate all guests.',
      );
    }

    const reservedLocks = await this.locks.findReservedByRoomType(
      room.roomTypeId,
      request.checkInDate,
      request.checkOutDate,
    );
    const lockedInventory = reservedLocks.reduce((total, lock) => total + lock.quantity, 0);
    const [overrideLimit, partnerControl] = await Promise.all([
      this.inventoryOverrides.findLimitForStay(
        room.roomTypeId,
        request.checkInDate,
        request.checkOutDate,
      ),
      partnerHotelInventoryRepository.findStayControl(
        room.roomTypeId,
        request.checkInDate,
        request.checkOutDate,
      ),
    ]);
    const effectiveInventory = Math.min(
      room.inventoryCount,
      overrideLimit ?? room.inventoryCount,
      partnerControl.availableRooms ?? room.inventoryCount,
    );
    if (partnerControl.restrictionMessage) {
      throw new HotelBookingRuleError('CALENDAR_RESTRICTION', partnerControl.restrictionMessage);
    }
    if (effectiveInventory - lockedInventory < request.rooms) {
      throw new HotelBookingRuleError(
        'INVENTORY_NOT_AVAILABLE',
        'The requested room quantity is no longer available.',
      );
    }

    const ratePlan = room.ratePlans.find((candidate) => candidate.id === request.ratePlanId);
    if (!ratePlan) {
      throw new HotelBookingRuleError('RATE_PLAN_NOT_FOUND', 'The selected rate is unavailable.');
    }
    if (nights < ratePlan.minimumStayNights || nights > ratePlan.maximumStayNights) {
      throw new HotelBookingRuleError(
        'STAY_RESTRICTION_NOT_MET',
        `This rate requires a stay between ${ratePlan.minimumStayNights} and ${ratePlan.maximumStayNights} nights.`,
      );
    }

    const rateControl = await partnerHotelInventoryRepository.findStayControl(
      room.roomTypeId,
      request.checkInDate,
      request.checkOutDate,
      ratePlan.nightlyRate.amount,
      ratePlan.id,
    );
    const roomChargeAmount =
      (rateControl.nightlyCharge ?? ratePlan.nightlyRate.amount * nights) * request.rooms;
    if (
      rateControl.stopSell ||
      !hotelRateStayPrice(ratePlan, nights, request.rooms, rateControl.nightlyCharge)
    ) {
      throw new HotelBookingRuleError(
        'RATE_UNAVAILABLE',
        'The selected rate is unavailable for this stay.',
      );
    }
    const taxAndFeeAmount = ratePlan.taxesAndFees.amount * nights * request.rooms;
    const components: PriceComponent[] = [
      {
        amount: roomChargeAmount,
        currency: ratePlan.nightlyRate.currency,
        label: `${request.rooms} room${request.rooms === 1 ? '' : 's'} × ${nights} night${nights === 1 ? '' : 's'}`,
        type: 'room-charge',
      },
      {
        amount: taxAndFeeAmount,
        currency: ratePlan.taxesAndFees.currency,
        label: 'Taxes and fees',
        type: 'tax-and-fee',
      },
    ];
    try {
      components.push(
        ...(await quoteHotelBookingAddons({
          adults: request.adults,
          checkInDate: request.checkInDate,
          checkOutDate: request.checkOutDate,
          children: request.children,
          hotelSlug: request.hotelSlug,
          nights,
          rooms: request.rooms,
          selections: request.addons,
        })),
      );
    } catch (error) {
      if (error instanceof PartnerBookingAddonError)
        throw new HotelBookingRuleError(error.code, error.message);
      throw error;
    }

    const availabilityLock = await this.locks.create({
      checkInDate: request.checkInDate,
      checkOutDate: request.checkOutDate,
      inventorySource: hotel.inventory.source,
      quantity: request.rooms,
      roomTypeId: room.roomTypeId,
      ttlMilliseconds: availabilityLockTtlMilliseconds,
    });
    const quotedAt = new Date().toISOString();

    const quote: HotelQuote = {
      availabilityLock,
      checkInDate: request.checkInDate,
      checkOutDate: request.checkOutDate,
      components,
      currency: ratePlan.nightlyRate.currency,
      expiresAt: availabilityLock.expiresAt,
      hotelSlug: request.hotelSlug,
      id: crypto.randomUUID(),
      nights,
      quotedAt,
      ratePlanId: request.ratePlanId,
      rooms: request.rooms,
      totalAmount: components.reduce((total, component) => total + component.amount, 0),
    };

    await this.quotes.save(quote);
    return quote;
  }

  async confirmBooking(
    request: CreateHotelBookingRequest,
    idempotencyKey: string,
    businessContext?: BusinessBookingContext & { expectedTotal: number },
  ): Promise<CreatedHotelBooking> {
    const existingBooking = await this.bookings.findByIdempotencyKey(idempotencyKey);
    if (existingBooking) {
      const sameRequest =
        existingBooking.availabilityLockId === request.availabilityLockId &&
        existingBooking.hotelSlug === request.hotelSlug &&
        existingBooking.quoteId === request.quoteId &&
        normalizeEmail(existingBooking.guest.email) === normalizeEmail(request.guest.email) &&
        existingBooking.guest.firstName === request.guest.firstName &&
        existingBooking.guest.lastName === request.guest.lastName &&
        existingBooking.guest.phone === request.guest.phone &&
        existingBooking.guest.specialRequests === request.guest.specialRequests;
      if (!sameRequest) {
        throw new HotelBookingRuleError(
          'IDEMPOTENCY_KEY_REUSED',
          'This booking retry key is already connected to different reservation details.',
        );
      }
      return {
        accessToken: createBookingAccessToken(idempotencyKey),
        booking: existingBooking,
      };
    }

    const quote = await this.quotes.findById(request.quoteId);
    if (!quote || quote.availabilityLock.id !== request.availabilityLockId) {
      throw new HotelBookingRuleError('QUOTE_NOT_FOUND', 'The booking quote is unavailable.');
    }

    if (quote.hotelSlug !== request.hotelSlug) {
      throw new HotelBookingRuleError(
        'QUOTE_HOTEL_MISMATCH',
        'The selected hotel does not match the server-validated quote.',
      );
    }

    if (new Date(quote.expiresAt).getTime() <= Date.now()) {
      throw new HotelBookingRuleError(
        'QUOTE_EXPIRED',
        'The room hold has expired. Please select the room again.',
      );
    }

    const lock = await this.locks.findById(request.availabilityLockId);
    if (!lock || lock.status !== 'active') {
      throw new HotelBookingRuleError(
        'LOCK_NOT_ACTIVE',
        'The room is no longer held. Please select it again.',
      );
    }

    let totalAmount = quote.totalAmount;
    const reservedPromotion = request.paymentIntentId
      ? await prisma.promotionRedemption.findUnique({
          where: { checkoutIntentId: request.paymentIntentId },
        })
      : null;
    if (reservedPromotion) {
      if (
        reservedPromotion.productType !== 'HOTEL' ||
        reservedPromotion.subtotal !== quote.totalAmount ||
        reservedPromotion.currency !== quote.currency ||
        (request.promotionCode &&
          request.promotionCode.trim().toUpperCase() !== reservedPromotion.code)
      ) {
        throw new HotelBookingRuleError(
          'PROMOTION_CLAIM_CONTEXT_MISMATCH',
          'The reserved promotion does not match this hotel booking.',
        );
      }
      totalAmount = reservedPromotion.finalTotal;
    } else if (request.promotionCode) {
      const promotionRule = await resolvePromotionRule(request.promotionCode, 'HOTEL');
      if (!promotionRule) {
        throw new HotelBookingRuleError(
          'PROMOTION_NOT_AVAILABLE',
          'This promotion is not available for this hotel booking.',
        );
      }
      if (quote.totalAmount < promotionRule.minimumSubtotal) {
        throw new HotelBookingRuleError(
          'MINIMUM_SUBTOTAL_NOT_MET',
          `This offer requires a minimum booking value of ₹${promotionRule.minimumSubtotal.toLocaleString('en-IN')}.`,
        );
      }
      totalAmount = calculatePromotion(promotionRule, quote.totalAmount).finalTotal;
    }

    if (businessContext && totalAmount !== businessContext.expectedTotal) {
      throw new HotelBookingRuleError(
        'BUSINESS_TOTAL_MISMATCH',
        'The company booking total changed. Please review the room price again.',
      );
    }

    const bookingId = crypto.randomUUID();
    let paymentContext;
    try {
      paymentContext = await confirmPaymentForBooking({
        amount: totalAmount,
        bookingId,
        currency: quote.currency,
        paymentIntentId: request.paymentIntentId,
        quoteId: quote.id,
      });
    } catch (error) {
      if (error instanceof PaymentConfirmationError) {
        throw new HotelBookingRuleError(error.code, error.message);
      }
      throw error;
    }

    const convertedLock = await this.locks.convert(lock.id);
    if (!convertedLock) {
      throw new HotelBookingRuleError(
        'LOCK_CONVERSION_FAILED',
        'The room hold could not be confirmed.',
      );
    }

    const booking: HotelBookingRecord = {
      assignedRoomNumbers: [],
      availabilityLockId: convertedLock.id,
      checkInDate: quote.checkInDate,
      checkOutDate: quote.checkOutDate,
      confirmationCode: createBookingReference('MT'),
      createdAt: new Date().toISOString(),
      currency: quote.currency,
      guest: { ...request.guest, email: normalizeEmail(request.guest.email) },
      hotelSlug: request.hotelSlug,
      id: bookingId,
      operationalStatus: 'RESERVED',
      paymentAmount: totalAmount,
      paymentStatus: 'captured',
      quoteId: quote.id,
      source: 'ONLINE',
      status: 'confirmed',
      totalAmount,
    };

    const accessToken = createBookingAccessToken(idempotencyKey);
    const accessTokenHash = hashBookingAccessToken(accessToken);
    try {
      await this.bookings.save(
        booking,
        idempotencyKey,
        accessTokenHash,
        paymentContext,
        businessContext,
      );
    } catch (error) {
      try {
        await this.locks.release(convertedLock.id);
      } catch (releaseError) {
        console.error('Hotel availability hold release failed.', releaseError);
      }
      if (error instanceof BusinessBookingRequestUnavailableError) {
        throw new HotelBookingRuleError(
          'BUSINESS_REQUEST_ALREADY_USED',
          'This company request is no longer available for booking.',
        );
      }
      if (error instanceof PromotionRedemptionError) {
        throw new HotelBookingRuleError(error.code, error.message);
      }
      throw error;
    }
    return { accessToken, booking };
  }

  async getBookingByConfirmationCode(
    code: string,
    accessToken: string,
  ): Promise<HotelBookingRecord | undefined> {
    return this.bookings.findByConfirmationCode(code, hashBookingAccessToken(accessToken));
  }

  async getManagedBooking(
    code: string,
    accessToken: string,
  ): Promise<ManagedHotelBooking | undefined> {
    const booking = await this.getBookingByConfirmationCode(code, accessToken);
    if (!booking) {
      return undefined;
    }

    return this.enrichManagedBooking(booking);
  }

  async getManagedBookingForGuest(
    code: string,
    email: string,
  ): Promise<ManagedHotelBooking | undefined> {
    const booking = await this.bookings.findByConfirmationCodeAndGuestEmail(code, email);
    if (!booking) {
      return undefined;
    }

    return this.enrichManagedBooking(booking);
  }

  private async enrichManagedBooking(booking: HotelBookingRecord): Promise<ManagedHotelBooking> {
    const [hotel, quote, latestAmendment] = await Promise.all([
      this.hotels.getHotelBySlug(booking.hotelSlug),
      this.quotes.findById(booking.quoteId),
      this.amendments.findLatestByBookingId(booking.id),
    ]);
    const room = hotel?.rooms.find(
      (candidate) => candidate.roomTypeId === quote?.availabilityLock.roomTypeId,
    );
    const ratePlan = room?.ratePlans.find((candidate) => candidate.id === quote?.ratePlanId);
    const refundable = isRefundEligible(
      quote?.checkInDate,
      hotel?.checkInTime,
      hotel?.propertyProfile?.timezone,
      ratePlan?.cancellationPolicy.refundable ?? false,
      ratePlan?.cancellationPolicy.freeCancellationUntilHoursBeforeCheckIn,
    );
    return {
      ...booking,
      cancellationPolicy: ratePlan?.cancellationPolicy.description,
      checkInDate: quote?.checkInDate ?? booking.checkInDate,
      checkOutDate: quote?.checkOutDate ?? booking.checkOutDate,
      documentProfile: hotel?.propertyProfile?.documentProfile,
      hotelName: hotel?.name ?? booking.hotelSlug,
      latestAmendment,
      priceComponents: quote?.components,
      propertyContact: hotel?.propertyProfile
        ? {
            email: hotel.propertyProfile.contactEmail,
            phone: hotel.propertyProfile.contactPhone,
          }
        : undefined,
      ratePlanName: ratePlan?.name,
      refundable,
      roomName: room?.name,
      rooms: quote?.rooms,
    };
  }

  async cancelBooking(code: string, accessToken: string): Promise<ManagedHotelBooking | undefined> {
    const booking = await this.getManagedBooking(code, accessToken);
    if (!booking) {
      return undefined;
    }

    if (booking.status === 'cancelled') {
      return booking;
    }

    await this.bookings.cancel(booking.id, booking.refundable === true);
    return this.getManagedBooking(code, accessToken);
  }

  async cancelBookingForGuest(
    code: string,
    email: string,
  ): Promise<ManagedHotelBooking | undefined> {
    const booking = await this.getManagedBookingForGuest(code, email);
    if (!booking) {
      return undefined;
    }

    if (booking.status !== 'cancelled') {
      await this.bookings.cancel(booking.id, booking.refundable === true);
    }
    return this.getManagedBookingForGuest(code, email);
  }

  async requestAmendment(
    code: string,
    accessToken: string,
    request: { reason: string; requestedCheckInDate: string; requestedCheckOutDate: string },
  ): Promise<ManagedHotelBooking | undefined> {
    const booking = await this.getManagedBooking(code, accessToken);
    if (!booking) {
      return undefined;
    }

    await this.createAmendmentRequest(booking, request);
    return this.getManagedBooking(code, accessToken);
  }

  async requestAmendmentForGuest(
    code: string,
    email: string,
    request: { reason: string; requestedCheckInDate: string; requestedCheckOutDate: string },
  ): Promise<ManagedHotelBooking | undefined> {
    const booking = await this.getManagedBookingForGuest(code, email);
    if (!booking) {
      return undefined;
    }

    await this.createAmendmentRequest(booking, request);
    return this.getManagedBookingForGuest(code, email);
  }

  private async createAmendmentRequest(
    booking: ManagedHotelBooking,
    request: { reason: string; requestedCheckInDate: string; requestedCheckOutDate: string },
  ): Promise<void> {
    if (booking.status !== 'confirmed') {
      throw new HotelBookingRuleError(
        'BOOKING_NOT_AMENDABLE',
        'Only confirmed bookings can be amended.',
      );
    }

    const nights = calculateNights(request.requestedCheckInDate, request.requestedCheckOutDate);
    const today = formatIndiaCalendarDate();
    if (!Number.isFinite(nights) || nights < 1 || request.requestedCheckInDate < today) {
      throw new HotelBookingRuleError(
        'INVALID_AMENDMENT_DATES',
        'Requested dates must describe a future stay of at least one night.',
      );
    }

    if (
      request.requestedCheckInDate === booking.checkInDate &&
      request.requestedCheckOutDate === booking.checkOutDate
    ) {
      throw new HotelBookingRuleError(
        'AMENDMENT_UNCHANGED',
        'Choose dates that are different from the current stay.',
      );
    }

    if (booking.latestAmendment?.status === 'pending') {
      throw new HotelBookingRuleError(
        'AMENDMENT_ALREADY_PENDING',
        'An amendment request is already pending for this booking.',
      );
    }

    await this.amendments.create({ bookingId: booking.id, ...request });
  }

  async listPendingAmendments(
    options: { hotelSlugs?: string[]; skip?: number; take?: number } = {},
  ): Promise<PartnerAmendmentRecord[]> {
    const pending = await this.amendments.findPending(options);
    const results = await Promise.all(
      pending.map(async (amendment) => {
        const { bookingId, ...publicAmendment } = amendment;
        const booking = await this.bookings.findById(bookingId);
        if (!booking) return undefined;
        const [hotel, quote] = await Promise.all([
          this.hotels.getHotelBySlug(booking.hotelSlug),
          this.quotes.findById(booking.quoteId),
        ]);
        const room = hotel?.rooms.find(
          (candidate) => candidate.roomTypeId === quote?.availabilityLock.roomTypeId,
        );
        const ratePlan = room?.ratePlans.find((candidate) => candidate.id === quote?.ratePlanId);
        if (!hotel || !quote || !room || !ratePlan) return undefined;
        return {
          ...publicAmendment,
          booking: {
            confirmationCode: booking.confirmationCode,
            currency: booking.currency,
            currentCheckInDate: quote.checkInDate,
            currentCheckOutDate: quote.checkOutDate,
            currentTotalAmount: booking.totalAmount,
            guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
            hotelName: hotel.name,
            ratePlanName: ratePlan.name,
            roomName: room.name,
            rooms: quote.rooms,
          },
        } satisfies PartnerAmendmentRecord;
      }),
    );
    return results.filter((item): item is PartnerAmendmentRecord => item !== undefined);
  }

  async getPendingAmendmentCount(hotelSlugs?: string[]): Promise<number> {
    return this.amendments.countPending(hotelSlugs);
  }

  async listPartnerBookings(options: PartnerBookingQuery = {}): Promise<PartnerBookingRecord[]> {
    const bookings = await this.bookings.findAll(options);
    const results = await Promise.all(
      bookings.map(async (booking) => {
        const [hotel, quote, property] = await Promise.all([
          this.hotels.getHotelBySlug(booking.hotelSlug),
          this.quotes.findById(booking.quoteId),
          prisma.partnerProperty.findUnique({
            include: { rooms: { include: { ratePlans: true } } },
            where: { hotelSlug: booking.hotelSlug },
          }),
        ]);
        const room = hotel?.rooms.find(
          (candidate) => candidate.roomTypeId === quote?.availabilityLock.roomTypeId,
        );
        const ratePlan = room?.ratePlans.find((candidate) => candidate.id === quote?.ratePlanId);
        const managedRoom = property?.rooms.find(
          (candidate) => candidate.roomTypeId === quote?.availabilityLock.roomTypeId,
        );
        const managedRatePlan = managedRoom?.ratePlans.find(
          (candidate) => candidate.ratePlanId === quote?.ratePlanId,
        );
        if (!quote || (!hotel && !property) || (!room && !managedRoom)) return undefined;
        return {
          assignedRoomNumbers: booking.assignedRoomNumbers,
          checkInDate: quote.checkInDate,
          checkOutDate: quote.checkOutDate,
          confirmationCode: booking.confirmationCode,
          createdAt: booking.createdAt,
          currency: booking.currency,
          guestEmail: booking.guest.email,
          guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
          hotelName: hotel?.name ?? property!.displayName,
          operationalStatus: booking.operationalStatus,
          partnerNote: booking.partnerNote ?? '',
          paymentStatus: booking.paymentStatus,
          ratePlanName: ratePlan?.name ?? managedRatePlan?.name ?? managedRoom!.ratePlanName,
          roomName: room?.name ?? managedRoom!.name,
          rooms: quote.rooms,
          source: booking.source,
          specialRequests: booking.guest.specialRequests,
          status: booking.status,
          totalAmount: booking.totalAmount,
        } satisfies PartnerBookingRecord;
      }),
    );
    return results.filter((booking): booking is PartnerBookingRecord => booking !== undefined);
  }

  async getPartnerBookingSummary(options: PartnerBookingQuery = {}) {
    return this.bookings.getPartnerSummary(options);
  }

  async getPartnerInventory(
    checkInDate: string,
    checkOutDate: string,
    hotelSlugs?: string[],
  ): Promise<PartnerInventoryRecord[]> {
    const nights = calculateNights(checkInDate, checkOutDate);
    const today = formatIndiaCalendarDate();
    if (!Number.isFinite(nights) || nights < 1 || checkInDate < today) {
      throw new HotelBookingRuleError(
        'INVALID_INVENTORY_DATES',
        'Choose a future date range of at least one night.',
      );
    }

    const hotels = (await this.hotels.getHotels()).filter(
      (hotel) => !hotelSlugs || hotelSlugs.includes(hotel.slug),
    );
    const records = await Promise.all(
      hotels.flatMap((hotel) =>
        hotel.rooms.map(async (room) => {
          const reservedLocks = await this.locks.findReservedByRoomType(
            room.roomTypeId,
            checkInDate,
            checkOutDate,
          );
          const activeHolds = reservedLocks
            .filter((lock) => lock.status === 'active')
            .reduce((total, lock) => total + lock.quantity, 0);
          const allocatedRooms = reservedLocks
            .filter((lock) => lock.status === 'converted')
            .reduce((total, lock) => total + lock.quantity, 0);
          const overrideLimit = await this.inventoryOverrides.findLimitForStay(
            room.roomTypeId,
            checkInDate,
            checkOutDate,
          );
          const effectiveInventory = Math.min(
            room.inventoryCount,
            overrideLimit ?? room.inventoryCount,
          );
          return {
            activeHolds,
            allocatedRooms,
            baseInventory: room.inventoryCount,
            effectiveInventory,
            hotelName: hotel.name,
            inventorySource: hotel.inventory.source,
            overrideApplied: overrideLimit !== undefined,
            remainingRooms: Math.max(0, effectiveInventory - activeHolds - allocatedRooms),
            roomName: room.name,
            roomTypeId: room.roomTypeId,
          } satisfies PartnerInventoryRecord;
        }),
      ),
    );
    return records;
  }

  async setPartnerInventoryOverride(
    input: {
      availableRooms: number;
      checkInDate: string;
      checkOutDate: string;
      note: string;
      roomTypeId: string;
    },
    hotelSlugs?: string[],
  ): Promise<PartnerInventoryRecord[]> {
    const nights = calculateNights(input.checkInDate, input.checkOutDate);
    const today = formatIndiaCalendarDate();
    if (!Number.isFinite(nights) || nights < 1 || input.checkInDate < today) {
      throw new HotelBookingRuleError(
        'INVALID_INVENTORY_DATES',
        'Choose a future date range of at least one night.',
      );
    }
    const hotels = (await this.hotels.getHotels()).filter(
      (hotel) => !hotelSlugs || hotelSlugs.includes(hotel.slug),
    );
    const room = hotels
      .flatMap((hotel) => hotel.rooms)
      .find((candidate) => candidate.roomTypeId === input.roomTypeId);
    if (!room)
      throw new HotelBookingRuleError('ROOM_NOT_FOUND', 'The room type could not be found.');
    if (
      !Number.isInteger(input.availableRooms) ||
      input.availableRooms < 0 ||
      input.availableRooms > room.inventoryCount
    ) {
      throw new HotelBookingRuleError(
        'INVALID_INVENTORY_LIMIT',
        `Available rooms must be between 0 and ${room.inventoryCount}.`,
      );
    }
    await this.inventoryOverrides.setRange(input);
    return this.getPartnerInventory(input.checkInDate, input.checkOutDate, hotelSlugs);
  }

  async reviewAmendment(
    id: string,
    decision: 'approved' | 'declined',
    reviewNote: string,
    hotelSlugs?: string[],
  ): Promise<BookingAmendmentRecord | undefined> {
    const pending = await this.amendments.findPendingById(id, hotelSlugs);
    if (!pending) return undefined;
    if (decision === 'declined') {
      return this.amendments.decline(id, reviewNote);
    }

    const booking = await this.bookings.findById(pending.bookingId);
    if (!booking || booking.status !== 'confirmed') {
      throw new HotelBookingRuleError(
        'BOOKING_NOT_AMENDABLE',
        'The booking is no longer amendable.',
      );
    }
    const nights = calculateNights(pending.requestedCheckInDate, pending.requestedCheckOutDate);
    const today = formatIndiaCalendarDate();
    if (!Number.isFinite(nights) || nights < 1 || pending.requestedCheckInDate < today) {
      throw new HotelBookingRuleError(
        'INVALID_AMENDMENT_DATES',
        'The requested stay dates are no longer valid.',
      );
    }
    const [hotel, quote] = await Promise.all([
      this.hotels.getHotelBySlug(booking.hotelSlug),
      this.quotes.findById(booking.quoteId),
    ]);
    const room = hotel?.rooms.find(
      (candidate) => candidate.roomTypeId === quote?.availabilityLock.roomTypeId,
    );
    const ratePlan = room?.ratePlans.find((candidate) => candidate.id === quote?.ratePlanId);
    if (!hotel || !quote || !room || !ratePlan) {
      throw new HotelBookingRuleError(
        'RATE_UNAVAILABLE',
        'The original room or rate is unavailable.',
      );
    }

    const reservedLocks = await this.locks.findReservedByRoomType(
      room.roomTypeId,
      pending.requestedCheckInDate,
      pending.requestedCheckOutDate,
    );
    const otherReservedRooms = reservedLocks
      .filter((lock) => lock.id !== booking.availabilityLockId)
      .reduce((total, lock) => total + lock.quantity, 0);
    const overrideLimit = await this.inventoryOverrides.findLimitForStay(
      room.roomTypeId,
      pending.requestedCheckInDate,
      pending.requestedCheckOutDate,
    );
    const effectiveInventory = Math.min(room.inventoryCount, overrideLimit ?? room.inventoryCount);
    if (effectiveInventory - otherReservedRooms < quote.rooms) {
      throw new HotelBookingRuleError(
        'INVENTORY_NOT_AVAILABLE',
        'The requested dates no longer have sufficient inventory.',
      );
    }

    const roomChargeAmount = ratePlan.nightlyRate.amount * nights * quote.rooms;
    const taxAndFeeAmount = ratePlan.taxesAndFees.amount * nights * quote.rooms;
    const existingAddonCharges = quote.components.filter(
      (component) => component.type === 'addon-charge',
    );
    if (existingAddonCharges.length) {
      const availableAddons = await listAvailableHotelBookingAddons(
        booking.hotelSlug,
        pending.requestedCheckInDate,
        pending.requestedCheckOutDate,
      );
      const availableIds = new Set(availableAddons.map((addon) => addon.id));
      if (
        existingAddonCharges.some(
          (component) => !component.sourceId || !availableIds.has(component.sourceId),
        )
      )
        throw new HotelBookingRuleError(
          'ADDON_NOT_AVAILABLE',
          'A selected package is unavailable for the requested dates. Contact the property before changing this stay.',
        );
    }
    const amendedAddonComponents = existingAddonCharges.flatMap((component) => {
      const amount = component.pricingMode?.endsWith('PER_NIGHT')
        ? Math.round((component.amount * nights) / quote.nights)
        : component.amount;
      const taxAmount = Math.round((amount * (component.taxRateBps ?? 0)) / 10_000);
      return [
        { ...component, amount },
        ...(taxAmount > 0
          ? [
              {
                ...component,
                amount: taxAmount,
                label: `${component.label.split(' · ')[0]} tax (${((component.taxRateBps ?? 0) / 100).toFixed(2)}%)`,
                type: 'addon-tax' as const,
              },
            ]
          : []),
      ];
    });
    const priceComponents: PriceComponent[] = [
      {
        amount: roomChargeAmount,
        currency: ratePlan.nightlyRate.currency,
        label: `${quote.rooms} room${quote.rooms === 1 ? '' : 's'} × ${nights} night${nights === 1 ? '' : 's'}`,
        type: 'room-charge',
      },
      {
        amount: taxAndFeeAmount,
        currency: ratePlan.taxesAndFees.currency,
        label: 'Taxes and fees',
        type: 'tax-and-fee',
      },
      ...amendedAddonComponents,
    ];
    return this.amendments.approve(id, {
      checkInDate: pending.requestedCheckInDate,
      checkOutDate: pending.requestedCheckOutDate,
      nights,
      priceComponents,
      reviewNote,
      totalAmount: priceComponents.reduce((total, component) => total + component.amount, 0),
    });
  }
}

export const hotelBookingService = new HotelBookingService();
