import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import {
  PartnerPropertyManager,
  type ManagedProperty,
} from '@/components/partner/PartnerPropertyManager';
import { getCurrentUser } from '@/lib/auth/session';
import { getPartnerAccess } from '@/lib/partnerAuth';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = { title: 'Hotel marketplace listings' };

export default async function PartnerPropertiesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?returnTo=/partner/properties');
  const access = await getPartnerAccess();
  if (!access?.partnerId || access.partnerType !== 'HOTEL') redirect('/partner');
  const initialProperties = await prisma.partnerProperty.findMany({
    include: {
      rooms: {
        include: {
          ratePlans: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    where: { listingSource: 'MANAGED', partnerId: access.partnerId, status: 'ACTIVE' },
  });
  return (
    <PartnerPropertyManager
      canManage={access.memberRole === 'ADMIN'}
      initialProperties={initialProperties satisfies ManagedProperty[]}
    />
  );
}
