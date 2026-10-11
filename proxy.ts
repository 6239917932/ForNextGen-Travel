import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { correlationIdFromHeader } from '@/lib/api/correlation';
import { isTrustedPortalMutation } from '@/lib/api/portalOrigin';
import { isRemovedPmsApiPath } from '@/lib/ota/removedApiRoutes';

const SESSION_COOKIE_NAME = 'fornextgen_travel_session';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const PARTNER_MUTATIONS_ENABLED = process.env.PARTNER_MUTATIONS_ENABLED === 'true';

function forbiddenResponse(requestId: string) {
  const response = NextResponse.json(
    {
      error: {
        code: 'FORBIDDEN_ORIGIN',
        message: 'This request must originate from the Mandyal Travels portal.',
      },
    },
    { status: 403, headers: { 'x-request-id': requestId } },
  );
  return response;
}

function partnerOperationsPausedResponse(requestId: string) {
  return NextResponse.json(
    {
      error: {
        code: 'PARTNER_OPERATIONS_PAUSED',
        message:
          'Partner onboarding and inventory changes are paused until contracts and payments are activated.',
      },
    },
    { status: 503, headers: { 'x-request-id': requestId } },
  );
}

export function proxy(request: NextRequest) {
  const requestId = correlationIdFromHeader(request.headers.get('x-request-id'));
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);

  if (isRemovedPmsApiPath(request.nextUrl.pathname)) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'This endpoint is unavailable.' } },
      { status: 404, headers: { 'x-request-id': requestId } },
    );
  }

  if (
    !SAFE_METHODS.has(request.method) &&
    !PARTNER_MUTATIONS_ENABLED &&
    (request.nextUrl.pathname.startsWith('/api/v1/partner/') ||
      request.nextUrl.pathname === '/api/v1/partners/applications')
  ) {
    return partnerOperationsPausedResponse(requestId);
  }

  if (SAFE_METHODS.has(request.method) || !request.cookies.has(SESSION_COOKIE_NAME)) {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('x-request-id', requestId);
    return response;
  }

  if (!isTrustedPortalMutation(request, process.env.PUBLIC_APP_ORIGIN)) {
    return forbiddenResponse(requestId);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-request-id', requestId);
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
