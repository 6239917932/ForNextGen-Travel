import type { MetadataRoute } from 'next';

import { POLICY_KINDS } from '@/lib/legal/policies';
import { absolutePublicUrl, buildPublicSitemapRecords } from '@/lib/seo/publicIndexing';
import { resolvePublicPortalOrigin } from '@/lib/url/publicOrigin';
import { prisma } from '@/lib/prisma';
import { hotelService } from '@/services/hotelService';
import { isPublicIndexingEnabled } from '@/lib/seo/indexingPolicy';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isPublicIndexingEnabled()) return [];
  const origin = resolvePublicPortalOrigin();
  const [hotelResult, destinationResult] = await Promise.allSettled([
    hotelService.getHotels(),
    prisma.destinationContent.findMany({
      orderBy: { slug: 'asc' },
      select: { slug: true, updatedAt: true },
      where: { status: 'PUBLISHED' },
    }),
  ]);
  const hotels = hotelResult.status === 'fulfilled' ? hotelResult.value : [];
  const destinations = destinationResult.status === 'fulfilled' ? destinationResult.value : [];
  const records = buildPublicSitemapRecords({
    destinations,
    hotelSlugs: hotels.map((hotel) => hotel.slug),
    legalPolicySlugs: POLICY_KINDS,
  });

  return records.map((record) => ({
    changeFrequency: record.changeFrequency,
    ...(record.lastModified ? { lastModified: record.lastModified } : {}),
    priority: record.priority,
    url: absolutePublicUrl(origin, record.path),
  }));
}
