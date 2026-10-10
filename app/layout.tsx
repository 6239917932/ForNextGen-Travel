import type { Metadata, Viewport } from 'next';

import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { BackNavigation } from '@/components/layout/BackNavigation';
import { ServiceAdvisoryBanner } from '@/components/layout/ServiceAdvisoryBanner';
import { BookingProvider } from '@/context/BookingContext';
import { getCurrentUser } from '@/lib/auth/session';
import { PUBLIC_SHARE_IMAGE, PUBLIC_SITE_ORIGIN } from '@/lib/seo/siteMetadata';
import { getVisibleServiceAdvisories } from '@/services/serviceAdvisoryService';
import { isFixtureInventoryEnabled } from '@/lib/inventory/fixtureInventoryPolicy';

import './globals.css';

export const metadata: Metadata = {
  applicationName: 'Mandyal Travels',
  authors: [{ name: 'Mandyal Travels Services Private Limited', url: PUBLIC_SITE_ORIGIN }],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Mandyal Travels',
  },
  creator: 'Mandyal Travels',
  description:
    'Thoughtful travel planning, trusted bookings, and connected journeys from the Himalayas to everywhere.',
  icons: {
    apple: [
      {
        sizes: '180x180',
        type: 'image/png',
        url: '/brand/mandyal-signature-apple-touch-v3.png',
      },
    ],
    icon: [
      { type: 'image/svg+xml', url: '/brand/mandyal-symbol.svg' },
      {
        sizes: '192x192',
        type: 'image/png',
        url: '/brand/mandyal-signature-app-icon-v3-192.png',
      },
      {
        sizes: '512x512',
        type: 'image/png',
        url: '/brand/mandyal-signature-app-icon-v3-512.png',
      },
    ],
    shortcut: '/brand/mandyal-symbol.svg',
  },
  metadataBase: new URL(PUBLIC_SITE_ORIGIN),
  openGraph: {
    description:
      'Thoughtful travel planning, trusted bookings, and connected journeys from the Himalayas to everywhere.',
    images: [
      {
        alt: 'Mandyal Travels in Himachal Pradesh',
        height: 875,
        url: PUBLIC_SHARE_IMAGE,
        width: 1798,
      },
    ],
    locale: 'en_IN',
    siteName: 'Mandyal Travels',
    title: 'Mandyal Travels',
    type: 'website',
  },
  publisher: 'Mandyal Travels Services Private Limited',
  keywords: [
    'Mandyal Travels',
    'Mandi Himachal Pradesh travel',
    'Himachal hotels',
    'Bir Billing stays',
    'India travel booking',
  ],
  title: {
    default: 'Mandyal Travels | Himachal Hotels and Trip Planning',
    template: '%s | Mandyal Travels',
  },
  twitter: {
    card: 'summary_large_image',
    description:
      'Thoughtful travel planning, trusted bookings, and connected journeys from the Himalayas to everywhere.',
    images: [PUBLIC_SHARE_IMAGE],
    title: 'Mandyal Travels',
  },
};

export const viewport: Viewport = {
  colorScheme: 'light',
  initialScale: 1,
  themeColor: '#0c3157',
  viewportFit: 'cover',
  width: 'device-width',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [user, advisories] = await Promise.all([
    getCurrentUser(),
    getVisibleServiceAdvisories(new Date()),
  ]);

  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <BookingProvider>
          <SiteHeader user={user ? { firstName: user.firstName, role: user.role } : null} />
          {isFixtureInventoryEnabled() ? (
            <p className="travel-preview-note" role="note">
              Design preview · Sample hotel inventory and prices are for testing.
            </p>
          ) : null}
          <BackNavigation />
          <ServiceAdvisoryBanner advisories={advisories} />
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
          <SiteFooter />
        </BookingProvider>
      </body>
    </html>
  );
}
