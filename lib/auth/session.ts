import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';

import { prisma } from '@/lib/prisma';
import { sessionAbsoluteExpiry, sessionDurationMsForRole } from '@/lib/auth/sessionPolicy';
import {
  ACCOUNT_SECURITY_ACTIONS,
  createAccountSecurityEventData,
} from '@/services/accountSecurityService';

export const SESSION_COOKIE_NAME = 'fornextgen_travel_session';
const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;
const MAX_ACTIVE_SESSIONS_PER_USER = 10;

export class AccountAccessDeniedError extends Error {
  constructor() {
    super('ACCOUNT_ACCESS_DENIED');
    this.name = 'AccountAccessDeniedError';
  }
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);

  const expiresAt = await prisma.$transaction(
    async (transaction) => {
      const user = await transaction.user.findUnique({
        select: { accessStatus: true, role: true },
        where: { id: userId },
      });
      if (!user || user.accessStatus !== 'ACTIVE') throw new AccountAccessDeniedError();
      const expiresAt = new Date(Date.now() + sessionDurationMsForRole(user.role));
      await transaction.userSession.deleteMany({
        where: { expiresAt: { lte: new Date() }, userId },
      });
      await transaction.userSession.create({
        data: { expiresAt, tokenHash, userId },
      });
      await transaction.accountSecurityEvent.create({
        data: createAccountSecurityEventData({
          action: ACCOUNT_SECURITY_ACTIONS.SIGNED_IN,
          summary: 'A new browser session signed in to your account.',
          userId,
        }),
      });
      const excessSessions = await transaction.userSession.findMany({
        orderBy: { createdAt: 'desc' },
        select: { id: true },
        skip: MAX_ACTIVE_SESSIONS_PER_USER,
        where: { userId },
      });
      if (excessSessions.length > 0) {
        await transaction.userSession.deleteMany({
          where: { id: { in: excessSessions.map((session) => session.id) } },
        });
      }
      return expiresAt;
    },
    { isolationLevel: 'Serializable' },
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    expires: expiresAt,
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function deleteCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  try {
    if (token) {
      await prisma.userSession.deleteMany({ where: { tokenHash: hashToken(token) } });
    }
  } finally {
    cookieStore.delete(SESSION_COOKIE_NAME);
  }
}

export async function getCurrentSession() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.userSession.findUnique({
    include: {
      user: {
        select: {
          accessStatus: true,
          bookingEmailEnabled: true,
          email: true,
          firstName: true,
          id: true,
          lastName: true,
          marketingConsentAt: true,
          role: true,
          smsAlertsEnabled: true,
          whatsappAlertsEnabled: true,
        },
      },
    },
    where: { tokenHash: hashToken(token) },
  });

  if (!session) return null;
  if (session.user.accessStatus !== 'ACTIVE') {
    await prisma.userSession.deleteMany({ where: { id: session.id } });
    return null;
  }

  const now = new Date();
  const roleExpiry = sessionAbsoluteExpiry(session.user.role, session.createdAt);
  if (session.expiresAt <= now || roleExpiry <= now) {
    await prisma.userSession.deleteMany({ where: { id: session.id } });
    return null;
  }

  if (session.lastSeenAt.getTime() <= now.getTime() - SESSION_TOUCH_INTERVAL_MS) {
    await prisma.userSession.updateMany({
      data: { lastSeenAt: now },
      where: { id: session.id, lastSeenAt: session.lastSeenAt },
    });
  }
  return session;
}

export async function getCurrentUser() {
  return (await getCurrentSession())?.user ?? null;
}
