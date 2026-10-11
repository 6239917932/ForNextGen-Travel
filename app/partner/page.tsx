import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { getPartnerAccess } from '@/lib/partnerAuth';
import { hotelBookingService } from '@/services/hotelBookingService';
import { prisma } from '@/lib/prisma';
export default async function PartnerWorkspacePage() {
  const access = await getPartnerAccess();
  if (!access?.partnerId || !access.userId) redirect('/partners/apply');
  if (access.partnerType === 'BUS') redirect('/partner/bus-operations');
  if (access.partnerType === 'FLIGHT') redirect('/partner/flights');
  if (access.partnerType === 'CAR') redirect('/partner/fleet');
  const summary = await hotelBookingService.getPartnerBookingSummary({
    hotelSlugs: access.allowedHotelSlugs,
  });
  const propertyCount = await prisma.partnerProperty.count({
    where: { partnerId: access.partnerId, listingSource: 'MANAGED', status: 'ACTIVE' },
  });
  return (
    <section className="account-page partner-workspace">
      <header className="admin-hero">
        <div className="admin-hero__content">
          <p className="admin-hero__eyebrow">Travel supplier workspace</p>
          <h1>{access.partnerName}</h1>
          <p>
            Manage your travel listings, availability, booking requests and marketplace settlements.
          </p>
        </div>
      </header>
      {propertyCount === 0 ? (
        <Card>
          <h2>No inventory has been added.</h2>
          <p>Add your hotel listing and room types to prepare marketplace availability.</p>
          <Link className="home-card__link" href="/partner/properties">
            Create the first property
          </Link>
        </Card>
      ) : null}
      <div className="partner-bookings__summary">
        <Card>
          <span>Total bookings</span>
          <strong>{summary.totalCount}</strong>
        </Card>
        <Card>
          <span>Confirmed bookings</span>
          <strong>{summary.confirmedCount}</strong>
        </Card>
      </div>
      <div className="partner-workspace__links">
        {[
          [
            '/partner/properties',
            'Hotel listings',
            'Manage room types, photos, policies and published listings.',
          ],
          [
            '/partner/inventory',
            'Rates and availability',
            'Set dated prices, sellable capacity and stay restrictions.',
          ],
          ['/partner/bookings', 'Travel bookings', 'Review reservations and payment status.'],
          [
            '/partner/amendments',
            'Booking amendments',
            'Review guest changes through the existing servicing controls.',
          ],
          [
            '/partner/settlements',
            'Settlements',
            'Review marketplace commissions and supplier settlements.',
          ],
        ].map(([href, title, description]) => (
          <Card key={href}>
            <h2>{title}</h2>
            <p>{description}</p>
            <Link className="home-card__link" href={href}>
              Open {title.toLowerCase()}
            </Link>
          </Card>
        ))}
      </div>
    </section>
  );
}
