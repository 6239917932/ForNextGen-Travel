import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { WorkspaceShell, type WorkspaceNavigationGroup } from '@/components/layout/WorkspaceShell';
import { getCurrentUser } from '@/lib/auth/session';
import { getPartnerAccess } from '@/lib/partnerAuth';
export default async function PartnerLayout({ children }: Readonly<{ children: ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?returnTo=/partner');
  const access = await getPartnerAccess();
  if (!access?.partnerId || !access.userId) redirect('/partners/apply');
  const groups: readonly WorkspaceNavigationGroup[] = [
    {
      label: 'Travel supplier workspace',
      items: [
        { code: 'DB', href: '/partner', label: 'Dashboard' },
        ...(access.partnerType === 'HOTEL'
          ? [
              { code: 'PR', href: '/partner/properties', label: 'Hotel listings' },
              { code: 'IN', href: '/partner/inventory', label: 'Rates and availability' },
              { code: 'BK', href: '/partner/bookings', label: 'Travel bookings' },
              { code: 'AM', href: '/partner/amendments', label: 'Amendments' },
              { code: 'RV', href: '/partner/reviews', label: 'Guest reviews' },
            ]
          : access.partnerType === 'CAR'
            ? [
                { code: 'FL', href: '/partner/fleet', label: 'Fleet' },
                { code: 'RS', href: '/partner/reservations', label: 'Reservations' },
              ]
            : access.partnerType === 'BUS'
              ? [
                  { code: 'BO', href: '/partner/bus-operations', label: 'Bus supply' },
                  { code: 'BB', href: '/partner/bus-bookings', label: 'Bus bookings' },
                ]
              : [{ code: 'FL', href: '/partner/flights', label: 'Flight supply' }]),
        { code: 'RP', href: '/partner/reports', label: 'Reports' },
        { code: 'CP', href: '/partner/compliance', label: 'Compliance' },
        { code: 'TX', href: '/partner/tax', label: 'Tax profile' },
        { code: 'ST', href: '/partner/settlements', label: 'Settlements' },
        { code: 'AC', href: '/partner/access', label: 'Team access' },
        { code: 'LG', href: '/partner/activity', label: 'Activity' },
      ],
    },
  ];
  return (
    <WorkspaceShell
      groups={groups}
      identity={user.email}
      subtitle="Travel marketplace supply"
      title={access.partnerName ?? 'Travel supplier'}
    >
      {children}
    </WorkspaceShell>
  );
}
