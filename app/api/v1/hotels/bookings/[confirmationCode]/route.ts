import type { NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { isSameOriginMutation } from '@/lib/api/request';
import { getBookingAccessCookieName, legacyBookingAccessCookieName } from '@/lib/bookingAccess';
import { hotelBookingService } from '@/services/hotelBookingService';
import { reportOperationalError } from '@/lib/observability/operations';
import type { ApiErrorResponse } from '@/types/commerce';

interface BookingRouteContext {
  params: Promise<{ confirmationCode: string }>;
}

function getAccessToken(request: NextRequest, confirmationCode: string): string | undefined {
  const authorization = request.headers.get('Authorization');
  const bearerToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
  return (
    bearerToken ??
    request.cookies.get(getBookingAccessCookieName(confirmationCode))?.value ??
    request.cookies.get(legacyBookingAccessCookieName)?.value
  );
}

export async function GET(request: NextRequest, context: BookingRouteContext): Promise<Response> {
  try {
    const { confirmationCode } = await context.params;
    const accessToken = getAccessToken(request, confirmationCode);
    let booking = accessToken
      ? await hotelBookingService.getManagedBooking(confirmationCode, accessToken)
      : undefined;
    if (!booking) {
      const user = await getCurrentUser();
      booking = user
        ? await hotelBookingService.getManagedBookingForGuest(confirmationCode, user.email)
        : undefined;
    }

    if (!accessToken && !booking) {
      const body: ApiErrorResponse = {
        error: {
          code: 'BOOKING_ACCESS_TOKEN_REQUIRED',
          message: 'Sign in to the booking account or use the browser where it was booked.',
        },
      };
      return Response.json(body, { status: 401 });
    }

    if (!booking) {
      const body: ApiErrorResponse = {
        error: {
          code: 'BOOKING_NOT_FOUND',
          message: 'The booking reference or access token is invalid.',
        },
      };
      return Response.json(body, { status: 404 });
    }

    return Response.json({ data: booking }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    reportOperationalError('hotels.booking.lookup_failed');
    return Response.json(
      {
        error: {
          code: 'BOOKING_SERVICE_UNAVAILABLE',
          message: 'Booking management is temporarily unavailable. Please try again.',
        },
      } satisfies ApiErrorResponse,
      { status: 503 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: BookingRouteContext,
): Promise<Response> {
  if (!isSameOriginMutation(request)) {
    return Response.json(
      {
        error: { code: 'FORBIDDEN_ORIGIN', message: 'Use the travel portal to cancel a booking.' },
      },
      { status: 403 },
    );
  }
  try {
    const { confirmationCode } = await context.params;
    const accessToken = getAccessToken(request, confirmationCode);
    let booking = accessToken
      ? await hotelBookingService.cancelBooking(confirmationCode, accessToken)
      : undefined;
    if (!booking) {
      const user = await getCurrentUser();
      booking = user
        ? await hotelBookingService.cancelBookingForGuest(confirmationCode, user.email)
        : undefined;
    }

    if (!accessToken && !booking) {
      return Response.json(
        {
          error: {
            code: 'BOOKING_ACCESS_TOKEN_REQUIRED',
            message: 'Sign in to the booking account or use the browser where it was booked.',
          },
        } satisfies ApiErrorResponse,
        { status: 401 },
      );
    }

    if (!booking) {
      return Response.json(
        {
          error: {
            code: 'BOOKING_NOT_FOUND',
            message: 'The booking reference or access token is invalid.',
          },
        } satisfies ApiErrorResponse,
        { status: 404 },
      );
    }

    return Response.json({ data: booking }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    reportOperationalError('hotels.booking.cancellation_failed');
    return Response.json(
      {
        error: {
          code: 'BOOKING_SERVICE_UNAVAILABLE',
          message: 'The booking could not be cancelled right now. Please try again.',
        },
      } satisfies ApiErrorResponse,
      { status: 503 },
    );
  }
}
