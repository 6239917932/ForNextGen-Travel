import { isSameOriginMutation, readJsonObject } from '@/lib/api/request';
import { consumeRateLimit, getRequestRateLimitIdentifier } from '@/lib/auth/rateLimit';
import { getCurrentUser } from '@/lib/auth/session';
import {
  PartnerOperationsError,
  partnerOperationsService,
} from '@/services/partnerOperationsService';
import type { ApiErrorResponse } from '@/types/commerce';
import { isPlatformFeatureEnabled } from '@/services/platformFeatureFlagService';
import { after } from 'next/server';
import {
  isPartnerAgreementType,
  readPartnerApplicationAcknowledgements,
} from '@/lib/partner/partnerAgreementPolicy';
import { sendPartnerAgreementEmail } from '@/services/partnerAgreementEmailService';

function failure(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } } satisfies ApiErrorResponse, { status });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return failure('FORBIDDEN_ORIGIN', 'Use the Mandyal Travels portal.', 403);
  }
  if (!(await isPlatformFeatureEnabled('PARTNER_APPLICATIONS'))) {
    return failure('FEATURE_PAUSED', 'New partner applications are temporarily paused.', 503);
  }
  const user = await getCurrentUser();
  if (!user) return failure('AUTH_REQUIRED', 'Sign in before requesting supplier access.', 401);
  const rateLimit = await consumeRateLimit({
    action: 'PARTNER_APPLICATION_CREATE',
    identifier: getRequestRateLimitIdentifier(request, user.id),
    limit: 3,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return Response.json(
      {
        error: {
          code: 'RATE_LIMITED',
          message:
            'Too many supplier applications were attempted. Please wait before trying again.',
        },
      } satisfies ApiErrorResponse,
      { headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) }, status: 429 },
    );
  }
  const body = await readJsonObject(request);
  if (!body) return failure('INVALID_JSON', 'Enter valid onboarding details.', 400);
  const required = [
    'businessName',
    'partnerType',
    'contactName',
    'contactEmail',
    'contactPhone',
    'city',
    'inventorySummary',
    'legalBusinessName',
    'registeredAddress',
    'taxIdentifier',
    'registrationId',
    'identityType',
    'identityReference',
    'signingAuthority',
    'operatingLicenceNumber',
    'operatingLicenceIssuer',
    'operatingLicenceExpiresOn',
    'insurancePolicyNumber',
    'insuranceProvider',
    'insuranceExpiresOn',
  ] as const;
  if (required.some((key) => typeof body[key] !== 'string'))
    return failure('INVALID_APPLICATION', 'Complete every onboarding field.', 400);
  if (body.kycConsent !== 'on')
    return failure('KYC_CONSENT_REQUIRED', 'Supplier due-diligence consent is required.', 400);
  if (!isPartnerAgreementType(body.partnerType) || body.partnerType !== 'HOTEL')
    return failure(
      'PARTNER_TYPE_UNAVAILABLE',
      'Hotel partner onboarding is available. Car and bus partner onboarding are coming soon.',
      400,
    );
  const acknowledgements = readPartnerApplicationAcknowledgements(body);
  if (!acknowledgements)
    return failure(
      'AGREEMENT_ACKNOWLEDGEMENT_REQUIRED',
      'Review and accept every supplier agreement and compliance acknowledgement.',
      400,
    );
  try {
    const data = await partnerOperationsService.createApplication({
      applicantUserId: user.id,
      businessName: String(body.businessName),
      city: String(body.city),
      contactEmail: String(body.contactEmail),
      contactName: String(body.contactName),
      contactPhone: String(body.contactPhone),
      inventorySummary: String(body.inventorySummary),
      partnerType: String(body.partnerType),
      legalBusinessName: String(body.legalBusinessName),
      registeredAddress: String(body.registeredAddress),
      taxIdentifier: String(body.taxIdentifier),
      registrationId: String(body.registrationId),
      identityType: String(body.identityType),
      identityReference: String(body.identityReference),
      signingAuthority: String(body.signingAuthority),
      operatingLicenceNumber: String(body.operatingLicenceNumber),
      operatingLicenceIssuer: String(body.operatingLicenceIssuer),
      operatingLicenceExpiresOn: String(body.operatingLicenceExpiresOn),
      insurancePolicyNumber: String(body.insurancePolicyNumber),
      insuranceProvider: String(body.insuranceProvider),
      insuranceExpiresOn: String(body.insuranceExpiresOn),
      acknowledgements,
    });
    after(() => sendPartnerAgreementEmail(data.id));
    return Response.json({ data }, { status: 201 });
  } catch (error) {
    return error instanceof PartnerOperationsError
      ? failure(error.code, error.message, 409)
      : failure('APPLICATION_FAILED', 'The request could not be submitted.', 500);
  }
}
