import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AdminContactInquiryReview } from '@/components/admin/AdminContactInquiryReview';
import { Card } from '@/components/ui/Card';
import { contactCategoryLabel } from '@/lib/admin/contactInquiryRules';
import { getPlatformAdmin } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = { title: 'Review contact inquiry' };

export default async function AdminContactInquiryPage({
  params,
}: {
  params: Promise<{ inquiryId: string }>;
}) {
  if (!(await getPlatformAdmin())) redirect('/login?returnTo=/admin/contact-inquiries');
  const { inquiryId } = await params;
  const inquiry = await prisma.contactInquiry.findUnique({
    where: { id: inquiryId },
    include: {
      reviewEvents: {
        include: { actor: { select: { firstName: true, lastName: true } } },
        orderBy: { version: 'desc' },
        take: 100,
      },
    },
  });
  if (!inquiry) notFound();
  const ownerRequest = ['HOTEL_OWNER', 'CAR_OWNER'].includes(inquiry.category);
  const applications = ownerRequest
    ? await prisma.partnerApplication.findMany({
        where: { contactEmail: inquiry.email },
        select: { id: true, businessName: true, status: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
    : [];
  return (
    <section className="account-page admin-workspace">
      <header className="admin-hero">
        <div>
          <p className="hotel-page__eyebrow">{contactCategoryLabel(inquiry.category)}</p>
          <h1>{inquiry.reference}</h1>
          <p>
            {inquiry.status.replaceAll('_', ' ')} · Received{' '}
            {inquiry.createdAt.toLocaleString('en-IN')}
          </p>
        </div>
        <Link className="ui-button ui-button--secondary" href="/admin/contact-inquiries">
          All requests
        </Link>
      </header>
      <Card>
        <h2>Request details</h2>
        <p>
          <strong>{inquiry.name}</strong>
          <br />
          <a href={`mailto:${inquiry.email}`}>{inquiry.email}</a>
          {inquiry.phone ? (
            <>
              <br />
              <a href={`tel:${inquiry.phone}`}>{inquiry.phone}</a>
            </>
          ) : null}
        </p>
        <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{inquiry.message}</p>
      </Card>
      <Card>
        <h2>Review request</h2>
        <AdminContactInquiryReview
          inquiryId={inquiry.id}
          status={inquiry.status}
          version={inquiry.version}
        />
      </Card>
      {ownerRequest ? (
        <Card>
          <h2>Supplier onboarding</h2>
          <p>
            Accepting this enquiry does not approve a supplier account, publish inventory or
            activate payments. Identity verification and agreement requirements still apply. Email
            matches below are a navigation aid, not proof of identity.
          </p>
          {applications.length ? (
            <ul>
              {applications.map((application) => (
                <li key={application.id}>
                  <Link href={`/admin/partner-applications/${application.id}`}>
                    {application.businessName} — {application.status}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No formal supplier application was found for this contact email. Ask the owner to
              complete <Link href="/partners/apply">partner registration</Link> using their verified
              account.
            </p>
          )}
          <Link href="/admin/partners">Open supplier control centre</Link>
        </Card>
      ) : null}
      <Card>
        <h2>Decision history</h2>
        {inquiry.reviewEvents.length ? (
          <ol>
            {inquiry.reviewEvents.map((event) => (
              <li key={event.id}>
                <p>
                  <strong>
                    {event.fromStatus.replaceAll('_', ' ')} → {event.toStatus.replaceAll('_', ' ')}
                  </strong>
                  <br />
                  {event.actor.firstName} {event.actor.lastName} ·{' '}
                  {event.createdAt.toLocaleString('en-IN')} · Revision {event.version}
                </p>
                <p style={{ whiteSpace: 'pre-wrap' }}>{event.reason}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p>No review decisions have been recorded.</p>
        )}
        <p className="booking-confirmation__note">
          Showing up to 100 most recent decisions. Earlier records remain retained in the audit
          database.
        </p>
      </Card>
    </section>
  );
}
