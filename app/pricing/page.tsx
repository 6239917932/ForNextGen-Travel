import Link from 'next/link';

import { Card } from '@/components/ui/Card';
import { createPublicMetadata } from '@/lib/seo/siteMetadata';

export const metadata = createPublicMetadata({
  description:
    'How Mandyal Travels displays supplier prices, taxes, commission, payment processing, settlements and refunds.',
  path: '/pricing',
  title: 'How Marketplace Pricing Works',
});

export default function MarketplacePricingPage() {
  return (
    <main className="legal-page">
      <section className="legal-hero">
        <p className="legal-eyebrow">CLEAR PRICES BEFORE PAYMENT</p>
        <h1>How marketplace pricing works</h1>
        <p>
          Every booking is classified by source before money is collected. Mandyal marketplace
          bookings use an 18% all-inclusive commercial fee. Applicable government taxes are shown
          before payment.
        </p>
        <div className="legal-draft-notice" role="note">
          Live marketplace payments and public partner listings remain disabled until GST,
          payment-provider, contract, classification, and supplier-review controls are approved.
        </div>
      </section>

      <section className="legal-content">
        <p className="legal-eyebrow">LAUNCH COMMERCIAL SCHEDULE</p>
        <h2>One source, one disclosed rule</h2>
        <div className="legal-card-grid">
          <Card>
            <h3>Mandyal marketplace</h3>
            <p>
              18% of booking value, minimum ₹199, inclusive of GST on Mandyal&apos;s fee and
              standard gateway processing. The customer sees the total before payment.
            </p>
          </Card>
        </div>

        <p>
          Supplier settlement becomes eligible only after successful capture, checkout,
          reconciliation, and clearance of refund, fraud, chargeback, compliance, or legal holds.
          The operating target is two business days after eligibility, not a guaranteed 48-hour
          clock.
        </p>
        <p>
          <strong>No hidden payment surcharge:</strong> standard gateway processing is included in
          the commercial commission. A clearly identified exceptional fee can be charged only when
          it is legally permitted and disclosed before the customer confirms payment.
        </p>
        <p>
          Read the <Link href="/legal/terms">terms of use</Link>,{' '}
          <Link href="/legal/cancellation-refunds">cancellation and refund policy</Link>, and{' '}
          <Link href="/legal/partner-standards">supplier standards</Link> for the complete operating
          framework.
        </p>
      </section>
    </main>
  );
}
