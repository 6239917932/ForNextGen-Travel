import { isSameOriginMutation, readJsonObject } from '@/lib/api/request';
import { getPartnerAccess, recordPartnerAudit } from '@/lib/partnerAuth';
import { prisma } from '@/lib/prisma';
import {
  PartnerOperationsError,
  partnerOperationsService,
} from '@/services/partnerOperationsService';
import type { ApiErrorResponse } from '@/types/commerce';

const failure = (code: string, message: string, status: number) =>
  Response.json({ error: { code, message } } satisfies ApiErrorResponse, { status });

export async function GET(request: Request) {
  const access = await getPartnerAccess(request);
  if (!access?.partnerId || access.partnerType !== 'HOTEL')
    return failure('HOTEL_PARTNER_REQUIRED', 'An active hotel supplier account is required.', 403);
  const data = await prisma.partnerProperty.findMany({
    include: {
      rooms: {
        include: {
          ratePlans: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    where: { listingSource: 'MANAGED', partnerId: access.partnerId, status: 'ACTIVE' },
  });
  return Response.json({ data });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request))
    return failure('FORBIDDEN_ORIGIN', 'Use the Mandyal Travels partner portal.', 403);
  const access = await getPartnerAccess(request);
  if (!access?.partnerId || access.partnerType !== 'HOTEL')
    return failure('HOTEL_PARTNER_REQUIRED', 'An active hotel supplier account is required.', 403);
  if (access.memberRole !== 'ADMIN')
    return failure(
      'PARTNER_ADMIN_REQUIRED',
      'Only the supplier administrator can add properties.',
      403,
    );
  const body = await readJsonObject(request);
  if (!body) return failure('INVALID_JSON', 'Enter valid property details.', 400);
  try {
    const data = await partnerOperationsService.createProperty(access.partnerId, {
      amenities: String(body.amenities ?? '')
        .split(',')
        .map((value) => value.trim()),
      checkInTime: String(body.checkInTime ?? ''),
      checkOutTime: String(body.checkOutTime ?? ''),
      city: String(body.city ?? ''),
      district: String(body.district ?? ''),
      childrenAllowed: body.childrenAllowed === true,
      contactEmail: String(body.contactEmail ?? ''),
      contactPhone: String(body.contactPhone ?? ''),
      country: String(body.country ?? ''),
      description: String(body.description ?? ''),
      displayName: String(body.displayName ?? ''),
      imageUrl: String(body.imageUrl ?? ''),
      imageUrls: String(body.imageUrls ?? '')
        .split('\n')
        .map((value) => value.trim())
        .filter(Boolean),
      languages: String(body.languages ?? '')
        .split(',')
        .map((value) => value.trim()),
      landmarks: String(body.landmarks ?? '')
        .split('\n')
        .map((value) => value.trim()),
      locality: String(body.locality ?? ''),
      locationAliases: String(body.locationAliases ?? '')
        .split(',')
        .map((value) => value.trim()),
      latitude: Number(body.latitude),
      longitude: Number(body.longitude),
      minimumCheckInAge: Number(body.minimumCheckInAge),
      petsAllowed: body.petsAllowed === true,
      policies: String(body.policies ?? '')
        .split('\n')
        .map((value) => value.trim()),
      postalCode: String(body.postalCode ?? ''),
      propertyType: String(body.propertyType ?? 'HOTEL'),
      smokingAllowed: body.smokingAllowed === true,
      starRating: Number(body.starRating),
      state: String(body.state ?? ''),
      streetAddress: String(body.streetAddress ?? ''),
      tehsil: String(body.tehsil ?? ''),
      timezone: String(body.timezone ?? 'Asia/Kolkata'),
    });
    await recordPartnerAudit(access, {
      action: 'PROPERTY_CREATED',
      entityId: data.id,
      entityType: 'PROPERTY',
      summary: `${data.displayName} added as a draft property.`,
    });
    return Response.json({ data }, { status: 201 });
  } catch (error) {
    return error instanceof PartnerOperationsError
      ? failure(error.code, error.message, 409)
      : failure('PROPERTY_CREATE_FAILED', 'The property could not be added.', 500);
  }
}
