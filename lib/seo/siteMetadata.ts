import type { Metadata } from 'next';
import { isPublicIndexingEnabled } from './indexingPolicy.ts';

export const PUBLIC_SITE_ORIGIN = process.env.PUBLIC_APP_ORIGIN ?? 'https://www.mandyaltravels.com';
export const PUBLIC_SITE_NAME = 'Mandyal Travels';
export const PUBLIC_SHARE_IMAGE = '/home/mandyal-travel-hero-v2.png';

interface PublicMetadataInput {
  absoluteTitle?: boolean;
  description: string;
  path: `/${string}` | '/';
  title: string;
}

export function createPublicMetadata({
  absoluteTitle = false,
  description,
  path,
  title,
}: PublicMetadataInput): Metadata {
  const index = isPublicIndexingEnabled();
  return {
    alternates: { canonical: path },
    description,
    openGraph: {
      description,
      images: [
        {
          alt: 'Mandyal Travels in Himachal Pradesh',
          height: 875,
          url: PUBLIC_SHARE_IMAGE,
          width: 1798,
        },
      ],
      locale: 'en_IN',
      siteName: PUBLIC_SITE_NAME,
      title,
      type: 'website',
      url: path,
    },
    robots: {
      follow: index,
      googleBot: {
        follow: index,
        index,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
      index,
    },
    title: absoluteTitle ? { absolute: title } : title,
    twitter: {
      card: 'summary_large_image',
      description,
      images: [PUBLIC_SHARE_IMAGE],
      title,
    },
  };
}
