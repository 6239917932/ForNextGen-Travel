export const inquiryStatuses = ['OPEN', 'IN_REVIEW', 'ACCEPTED', 'REJECTED', 'CLOSED'] as const;
export const inquiryActions = ['START_REVIEW', 'ACCEPT', 'REJECT', 'CLOSE', 'REOPEN'] as const;
export type InquiryAction = (typeof inquiryActions)[number];

export function contactCategoryLabel(category: string): string {
  return (
    (
      {
        HOTEL_OWNER: 'Hotel supplier request',
        CAR_OWNER: 'Car owner',
        BOOKING_HELP: 'Booking help',
        GENERAL: 'General',
      } as Record<string, string>
    )[category] ?? category
  );
}

export function inquiryActionsForStatus(status: string): InquiryAction[] {
  switch (status) {
    case 'OPEN':
      return ['START_REVIEW', 'ACCEPT', 'REJECT', 'CLOSE'];
    case 'IN_REVIEW':
      return ['ACCEPT', 'REJECT', 'CLOSE', 'REOPEN'];
    case 'ACCEPTED':
      return ['CLOSE', 'REOPEN'];
    case 'REJECTED':
    case 'CLOSED':
      return ['REOPEN'];
    default:
      return [];
  }
}

export function parseInquiryDecision(body: Record<string, unknown> | null) {
  if (!body || !inquiryActions.includes(body.action as InquiryAction))
    throw new Error('INQUIRY_ACTION_INVALID');
  if (!Number.isSafeInteger(body.expectedVersion) || Number(body.expectedVersion) < 1)
    throw new Error('INQUIRY_VERSION_REQUIRED');
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (reason.length < 5 || reason.length > 1000) throw new Error('INQUIRY_REASON_REQUIRED');
  return {
    action: body.action as InquiryAction,
    expectedVersion: Number(body.expectedVersion),
    reason,
  };
}

export function inquiryTargetStatus(status: string, action: InquiryAction) {
  if (!inquiryActionsForStatus(status).includes(action))
    throw new Error('INQUIRY_TRANSITION_INVALID');
  return {
    START_REVIEW: 'IN_REVIEW',
    ACCEPT: 'ACCEPTED',
    REJECT: 'REJECTED',
    CLOSE: 'CLOSED',
    REOPEN: 'OPEN',
  }[action];
}
