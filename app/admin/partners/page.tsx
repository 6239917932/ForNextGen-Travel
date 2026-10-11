import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AdminPartnerReview } from '@/components/admin/AdminPartnerReview';
import { Card } from '@/components/ui/Card';
import { getPlatformAdmin } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';
import { summarizePersistedPartnerKyc } from '@/lib/partner/kycPersistenceRules';

export const metadata: Metadata = { title: 'Supplier administration' };

export default async function AdminPartnersPage() {
  if (!(await getPlatformAdmin())) redirect('/login?returnTo=/admin/partners');
  const [applications, partners, pendingProperties, pendingVehicles] = await Promise.all([
    prisma.partnerApplication.findMany({
      include: {
        applicant: { select: { email: true, firstName: true, lastName: true } },
        kycDocuments: true,
      },
      orderBy: { createdAt: 'asc' },
      where: { status: 'PENDING' },
    }),
    prisma.supplyPartner.findMany({
      include: { _count: { select: { members: true, properties: true, vehicles: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.partnerProperty.findMany({
      include: {
        partner: { select: { id: true, name: true } },
        rooms: { select: { id: true }, where: { status: 'ACTIVE' } },
      },
      orderBy: [{ submittedAt: 'asc' }, { createdAt: 'asc' }],
      where: {
        approvalStatus: 'PENDING_REVIEW',
        listingSource: 'MANAGED',
        status: 'ACTIVE',
      },
    }),
    prisma.partnerVehicle.findMany({
      include: { partner: { select: { id: true, name: true } } },
      orderBy: [{ submittedAt: 'asc' }, { createdAt: 'asc' }],
      where: { approvalStatus: 'PENDING_REVIEW', status: { not: 'ARCHIVED' } },
    }),
  ]);
  return (
    <section className="account-page supplier-admin admin-workspace">
      <header className="admin-hero">
        <div>
          <p className="hotel-page__eyebrow">Platform administration</p>
          <h1>Supplier control center</h1>
          <p>
            Verify businesses, activate named accounts, and monitor hotel and car inventory access.
          </p>
        </div>
        <div className="admin-hero__actions">
          <Link
            className="ui-button ui-button--secondary"
            href="/admin/contact-inquiries?category=HOTEL_OWNER"
          >
            Partner enquiries
          </Link>
          <Link className="ui-button ui-button--secondary" href="/admin/partner-applications">
            Application history
          </Link>

          <Link className="ui-button ui-button--secondary" href="/admin">
            Operations console
          </Link>
        </div>
      </header>
      <div className="partner-bookings__summary">
        <Card>
          <span>Pending verification</span>
          <strong>{applications.length}</strong>
        </Card>
        <Card>
          <span>Property reviews</span>
          <strong>{pendingProperties.length}</strong>
        </Card>
        <Card>
          <span>Vehicle reviews</span>
          <strong>{pendingVehicles.length}</strong>
        </Card>
        <Card>
          <span>Car suppliers</span>
          <strong>{partners.filter((p) => p.type === 'CAR').length}</strong>
        </Card>
      </div>

      <section>
        <p className="hotel-page__eyebrow">Verification queue</p>
        <h2>Pending applications</h2>
        <div className="supplier-admin__grid">
          {applications.map((item) => {
            const summary =
              item.partnerType === 'BUS' ||
              item.partnerType === 'CAR' ||
              item.partnerType === 'HOTEL'
                ? summarizePersistedPartnerKyc({
                    documents: item.kycDocuments,
                    partnerType: item.partnerType,
                    today: new Date().toISOString().slice(0, 10),
                  })
                : null;
            return (
              <Card key={item.id}>
                <div className="booking-confirmation__reference">
                  <span>
                    {item.partnerType} · {item.city}
                  </span>
                  <strong>{item.businessName}</strong>
                </div>
                <p>
                  <strong>{item.contactName}</strong>
                  <br />
                  {item.contactEmail} · {item.contactPhone}
                </p>
                <p>{item.inventorySummary}</p>
                <Link
                  className="ui-button ui-button--secondary"
                  href={`/admin/partner-applications/${item.id}`}
                >
                  Open application and review evidence
                </Link>
                <p>
                  <strong>KYC: {item.kycStatus.replaceAll('_', ' ')}</strong>
                  <br />
                  Legal name: {item.legalBusinessName}
                  <br />
                  Registration: {item.registrationId} · Tax ID: {item.taxIdentifier}
                  <br />
                  Representative: {item.identityType.replaceAll('_', ' ')} ·{' '}
                  {item.identityReference}
                  <br />
                  Address: {item.registeredAddress}
                </p>
                <small>
                  Account: {item.applicant.firstName} {item.applicant.lastName} (
                  {item.applicant.email})
                </small>
                <p>
                  <strong>
                    Evidence: {summary?.verified.length ?? 0} of {summary?.required.length ?? 0}{' '}
                    verified
                  </strong>
                </p>
                <p>
                  <strong>Agreement v{item.agreementVersion || 'not assigned'}</strong>
                  <br />
                  Email: {item.agreementEmailStatus.replaceAll('_', ' ')} · Signed return:{' '}
                  {item.signedAgreementStatus.replaceAll('_', ' ')}
                  {item.agreementDocumentPath ? (
                    <>
                      <br />
                      <a href={item.agreementDocumentPath} rel="noreferrer" target="_blank">
                        Open issued agreement
                      </a>
                    </>
                  ) : null}
                </p>
                <AdminPartnerReview
                  agreementEmailStatus={item.agreementEmailStatus}
                  agreementVersion={item.agreementVersion}
                  applicationId={item.id}
                  approvalAllowed={
                    summary?.complete === true && item.signedAgreementStatus === 'RECEIVED'
                  }
                  signedAgreementStatus={item.signedAgreementStatus}
                />
              </Card>
            );
          })}
          {applications.length === 0 ? (
            <Card>No supplier applications are awaiting verification.</Card>
          ) : null}
        </div>
      </section>
      <section>
        <p className="hotel-page__eyebrow">Vehicle governance</p>
        <h2>Vehicles awaiting review</h2>
        <div className="supplier-admin__grid">
          {pendingVehicles.map((vehicle) => (
            <Card key={vehicle.id}>
              <div className="booking-confirmation__reference">
                <span>{vehicle.partner.name}</span>
                <strong>{vehicle.vehicleName}</strong>
              </div>
              <p>
                {vehicle.pickupLocation} to {vehicle.dropoffLocation} · {vehicle.totalUnits} units
              </p>
              <small>
                {vehicle.registrationNumber
                  ? `Registration ${vehicle.registrationNumber}`
                  : 'Registration missing'}
              </small>
              <Link className="home-card__link" href={`/admin/partners/${vehicle.partner.id}`}>
                Review vehicle and risk signals
              </Link>
            </Card>
          ))}
          {pendingVehicles.length === 0 ? (
            <Card>No vehicle listings are awaiting review.</Card>
          ) : null}
        </div>
      </section>
      <section>
        <p className="hotel-page__eyebrow">Property governance</p>
        <h2>Listings awaiting review</h2>
        <div className="supplier-admin__grid">
          {pendingProperties.map((property) => (
            <Card key={property.id}>
              <div className="booking-confirmation__reference">
                <span>{property.partner.name}</span>
                <strong>{property.displayName}</strong>
              </div>
              <p>
                {property.locality || property.city}, {property.district || property.state}
                {' · '}
                {property.rooms.length} active room {property.rooms.length === 1 ? 'type' : 'types'}
              </p>
              <small>
                Submitted{' '}
                {property.submittedAt
                  ? property.submittedAt.toLocaleString('en-IN')
                  : 'automatically when its first room was added'}
              </small>
              <Link
                className="home-card__link"
                href={`/admin/partners/${property.partner.id}#property-${property.id}`}
              >
                Review listing
              </Link>
            </Card>
          ))}
          {pendingProperties.length === 0 ? (
            <Card>No property listings are awaiting review.</Card>
          ) : null}
        </div>
      </section>
      <section>
        <p className="hotel-page__eyebrow">Supplier directory</p>
        <h2>Approved supplier accounts</h2>
        <div className="supplier-admin__grid">
          {partners.map((partner) => (
            <Card key={partner.id}>
              <span
                className={`business-request__status business-request__status--${partner.status.toLowerCase()}`}
              >
                {partner.status}
              </span>
              <h3>{partner.name}</h3>
              <p>
                {partner.type} · {partner._count.members} users · {partner._count.properties}{' '}
                properties · {partner._count.vehicles} vehicles
              </p>
              <Link className="home-card__link" href={`/admin/partners/${partner.id}`}>
                Open supplier record
              </Link>
            </Card>
          ))}
        </div>
      </section>
    </section>
  );
}
