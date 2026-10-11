import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { PartnerApplicationForm } from '@/components/partner/PartnerApplicationForm';
import { FeatureUnavailable } from '@/components/common/FeatureUnavailable';
import { Card } from '@/components/ui/Card';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { isPlatformFeatureEnabled } from '@/services/platformFeatureFlagService';
import { summarizePersistedPartnerKyc } from '@/lib/partner/kycPersistenceRules';

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: 'Partner onboarding',
};

export default async function PartnerApplicationPage() {
  if (!(await isPlatformFeatureEnabled('PARTNER_APPLICATIONS'))) {
    return (
      <FeatureUnavailable
        description="New supplier applications are paused while the onboarding queue is reviewed."
        title="Partner applications are paused"
      />
    );
  }
  const user = await getCurrentUser();
  if (!user) redirect('/login?returnTo=/partners/apply');
  const application = await prisma.partnerApplication.findFirst({
    include: { kycDocuments: true },
    orderBy: { createdAt: 'desc' },
    where: { applicantUserId: user.id },
  });
  const membership = await prisma.supplyPartnerMember.findUnique({
    include: { partner: true },
    where: { userId: user.id },
  });
  if (membership) redirect('/partner');
  const kycSummary =
    application &&
    (application.partnerType === 'BUS' ||
      application.partnerType === 'CAR' ||
      application.partnerType === 'HOTEL')
      ? summarizePersistedPartnerKyc({
          documents: application.kycDocuments,
          partnerType: application.partnerType,
          today: new Date().toISOString().slice(0, 10),
        })
      : null;
  return (
    <section className="auth-page partner-application">
      <div className="auth-page__intro">
        <p className="hotel-page__eyebrow">Verified supplier network</p>
        <h1>Apply to list and manage your hotel.</h1>
        <p>
          Tell us about your property. Access is activated only after a platform administrator
          reviews the business and hotel documentation.
        </p>
      </div>
      {application?.status === 'PENDING' ? (
        <Card className="partner-application__status">
          <span className="business-request__status business-request__status--pending">
            Verification pending
          </span>
          <h2>{application.businessName}</h2>
          <p>
            Your {application.partnerType.toLowerCase()} supplier request is in the review queue. No
            inventory access has been granted yet.
          </p>
          <p>
            <strong>Agreement v{application.agreementVersion || 'not assigned'}</strong>
            <br />
            Delivery: {application.agreementEmailStatus.replaceAll('_', ' ')} · Signed return:{' '}
            {application.signedAgreementStatus.replaceAll('_', ' ')}
          </p>
          {application.agreementDocumentPath ? (
            <p>
              <a href={application.agreementDocumentPath}>Download your issued agreement</a> and
              keep it for your records. If the reviewer identifies an applicable signature or
              stamping formality, return the requested complete copy through the agreement email.
            </p>
          ) : null}
          {application.agreementEmailStatus === 'FAILED' ? (
            <p className="booking-page__payment-error" role="alert">
              Agreement email delivery needs administrator attention. Your application remains
              safely pending.
            </p>
          ) : null}
          {!application.agreementVersion ? (
            <p className="booking-page__payment-error" role="alert">
              This application was submitted before the current agreement workflow. It cannot be
              converted into acceptance automatically. Please ask support to close it, then submit a
              new application under the current terms.
            </p>
          ) : null}
          {kycSummary ? (
            <>
              <p>
                <strong>
                  Compliance evidence: {kycSummary.verified.length} of {kycSummary.required.length}{' '}
                  verified
                </strong>
              </p>
              <p>
                {kycSummary.complete
                  ? 'Your required evidence is current.'
                  : `Still required: ${kycSummary.missing.join(', ').replaceAll('_', ' ') || 'expired evidence replacement'}.`}
              </p>
              <small>
                Private upload storage and malware scanning are not activated. No file can be safely
                accepted yet.
              </small>
            </>
          ) : null}
          <Link className="ui-button ui-button--secondary" href="/login#partner">
            Back to partner network
          </Link>
        </Card>
      ) : (
        <PartnerApplicationForm
          defaultEmail={user.email}
          defaultName={`${user.firstName} ${user.lastName}`}
        />
      )}
    </section>
  );
}
