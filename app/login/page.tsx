import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AuthForm } from '@/components/auth/AuthForm';
import { Card } from '@/components/ui/Card';
import { getSafeReturnTo, getSignedInReturnTo } from '@/lib/auth/redirect';
import { inferLoginAudience, normalizeLoginAudience } from '@/lib/auth/loginAudience';
import { getCurrentUser } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Sign in' };

type LoginPageProps = {
  searchParams: Promise<{
    passwordChanged?: string;
    passwordReset?: string;
    portal?: string;
    returnTo?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const values = await searchParams;
  const returnTo = getSafeReturnTo(values.returnTo);
  const audience =
    normalizeLoginAudience(values.portal) ??
    inferLoginAudience(returnTo) ??
    (values.passwordReset === '1' || values.passwordChanged === '1' ? 'customer' : null);
  const user = await getCurrentUser();
  if (user) redirect(getSignedInReturnTo(returnTo, user.role));

  if (!audience) {
    const portals = [
      {
        audience: 'customer',
        description: 'Book personal travel and keep every journey in one secure account.',
        features: [
          'Hotel bookings and stay management',
          'Trips, confirmations, and support',
          'Traveller profile and preferences',
        ],
        href: '/login?portal=customer',
        id: 'traveller',
        label: 'Traveller',
        monogram: 'TR',
        primaryLabel: 'Traveller sign in',
        secondaryActions: [{ href: '/register', label: 'Create traveller account' }],
        title: 'Plan and manage personal travel',
      },
      {
        audience: 'partner',
        description: 'Operate an approved hotel or hotel supplier account.',
        features: [
          'Listings, rates, and inventory',
          'Marketplace bookings and amendments',
          'Applications, compliance, and settlements',
        ],
        href: '/login?portal=partner&returnTo=%2Fpartner',
        id: 'partner',
        label: 'Hotel partner',
        monogram: 'PR',
        primaryLabel: 'Partner sign in',
        secondaryActions: [
          { href: '/register?returnTo=%2Fpartners%2Fapply', label: 'Apply as a partner' },
        ],
        title: 'Run supplier operations',
      },
      {
        audience: 'corporate',
        description: 'Coordinate company or agency travel through an organization workspace.',
        features: [
          'Travellers, policies, and approvals',
          'Bookings, invoices, and reporting',
          'Corporate and travel-agent access',
        ],
        href: '/login?portal=corporate&returnTo=%2Fbusiness%2Fdashboard',
        id: 'business',
        label: 'Business & agency',
        monogram: 'CO',
        primaryLabel: 'Business or agent sign in',
        secondaryActions: [
          { href: '/register?account=business', label: 'Create company account' },
          { href: '/register?account=agent', label: 'Create agency account' },
        ],
        title: 'Manage organization travel',
      },
      {
        audience: 'admin',
        description: 'Restricted internal access for authorized Mandyal Travels administration.',
        features: [
          'Platform and supplier governance',
          'Support and operational reviews',
          'Audit and security controls',
        ],
        href: '/login?portal=admin&returnTo=%2Fadmin',
        id: 'administration',
        label: 'Mandyal administration',
        monogram: 'AD',
        notice: 'No public registration. Authorized personnel only.',
        primaryLabel: 'Administrator sign in',
        secondaryActions: [],
        title: 'Control platform operations',
      },
    ] as const;

    return (
      <section className="auth-page auth-page--portal-hub">
        <div className="auth-portal-hero">
          <div className="auth-page__intro auth-portal-intro">
            <p className="hotel-page__eyebrow">Mandyal Travels account access</p>
            <h1>Everything you need, in the right workspace.</h1>
            <p>
              Book hotel stays, operate property inventory, manage organization journeys, or run the
              platform—all through one clear and secure account gateway.
            </p>
          </div>
          <div className="auth-portal-overview" aria-label="Workspace overview">
            <strong>One connected travel platform</strong>
            <span>4 purpose-built workspaces</span>
            <span>Separate tools and permissions</span>
            <span>One place for access and support</span>
          </div>
        </div>
        <div className="auth-portal-grid">
          {portals.map((portal) => (
            <Card
              className={`auth-portal-card auth-portal-card--${portal.audience}`}
              id={portal.id}
              key={portal.audience}
            >
              <div className="auth-portal-card__heading">
                <span aria-hidden="true" className="auth-portal-card__monogram">
                  {portal.monogram}
                </span>
                <div>
                  <p className="hotel-page__eyebrow">{portal.label}</p>
                  <h2>{portal.title}</h2>
                </div>
              </div>
              <p>{portal.description}</p>
              <ul className="auth-portal-card__features">
                {portal.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              {'notice' in portal ? (
                <p className="auth-portal-card__notice">{portal.notice}</p>
              ) : null}
              <div className="auth-portal-card__actions">
                <Link className="ui-button ui-button--primary" href={portal.href}>
                  {portal.primaryLabel}
                </Link>
                {portal.secondaryActions.map((action) => (
                  <Link
                    className="auth-portal-card__secondary"
                    href={action.href}
                    key={action.href}
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            </Card>
          ))}
        </div>
        <aside className="auth-portal-help" aria-labelledby="login-help-title">
          <div>
            <p className="hotel-page__eyebrow">Account assistance</p>
            <h2 id="login-help-title">Not sure where to sign in?</h2>
            <p>
              Travellers use the personal account. Hotel owners use Partner. Companies and travel
              agencies use Business &amp; Agency.
            </p>
          </div>
          <div className="auth-portal-help__links">
            <Link href="/forgot-password">Reset password</Link>
            <Link href="/manage-booking">Manage a booking</Link>
            <Link href="/contact">Contact support</Link>
          </div>
        </aside>
        <div className="auth-portal-trust" aria-label="Account protection">
          <span>Encrypted connection</span>
          <span>Role-separated access</span>
          <span>Protected account controls</span>
        </div>
      </section>
    );
  }

  const copy = {
    admin: {
      description: 'Sign in to the protected Mandyal Travels operations console.',
      eyebrow: 'Restricted administration',
      title: 'Administrator login',
    },
    corporate: {
      description: 'Sign in to manage your company travel account and team.',
      eyebrow: 'Corporate travel',
      title: 'Corporate login',
    },
    customer: {
      description: 'Sign in to manage your personal journeys and account.',
      eyebrow: 'Customer account',
      title: 'Customer login',
    },
    partner: {
      description: 'Sign in to apply or manage your approved hotel business.',
      eyebrow: 'Supplier network',
      title: 'Partner login',
    },
  }[audience];

  return (
    <section className="auth-page">
      <div className="auth-page__intro">
        <p className="hotel-page__eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
      </div>
      <AuthForm
        message={
          values.passwordReset === '1'
            ? 'Your password was reset. Sign in with your new password.'
            : values.passwordChanged === '1'
              ? 'Your password was updated. Sign in again on this device.'
              : undefined
        }
        loginAudience={audience}
        mode="login"
        returnTo={returnTo ?? undefined}
      />
      <p className="auth-portal-switch">
        <Link href="/login">Choose a different login</Link>
      </p>
    </section>
  );
}
