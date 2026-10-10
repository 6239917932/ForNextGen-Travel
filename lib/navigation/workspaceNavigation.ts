import type { WorkspaceNavigationGroup } from '@/components/layout/WorkspaceShell';

export const adminWorkspaceNavigation = [
  {
    label: 'Overview',
    items: [
      { code: 'DB', href: '/admin', label: 'Dashboard' },
      { code: 'AN', href: '/admin/analytics', label: 'Platform analytics' },
      { code: 'LR', href: '/admin/readiness', label: 'Launch readiness' },
    ],
  },
  {
    label: 'Customers and bookings',
    items: [
      { code: 'CU', href: '/admin/users', label: 'Customers' },
      { code: 'OR', href: '/admin/organizations', label: 'Organizations' },
      { code: 'BK', href: '/admin/bookings', label: 'Bookings' },
      { code: 'CS', href: '/admin/support', label: 'Customer support' },
      { code: 'CI', href: '/admin/contact-inquiries', label: 'Contact and PMS requests' },
      { code: 'RV', href: '/admin/reviews', label: 'Hotel reviews' },
      { code: 'DC', href: '/admin/documents', label: 'Documents' },
    ],
  },
  {
    label: 'Suppliers and inventory',
    items: [
      { code: 'SP', href: '/admin/partners', label: 'Suppliers' },
      { code: 'AP', href: '/admin/partner-applications', label: 'Supplier applications' },
      { code: 'CA', href: '/admin/catalog', label: 'Supply catalog' },
      { code: 'IN', href: '/admin/inventory', label: 'Inventory and rates' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { code: 'FN', href: '/admin/finance', label: 'Finance operations' },
      { code: 'TX', href: '/admin/tax', label: 'Tax and commission' },
      { code: 'ST', href: '/admin/settlements', label: 'Partner settlements' },
      { code: 'PR', href: '/admin/promotions', label: 'Promotions and coupons' },
    ],
  },
  {
    label: 'Operations and integrations',
    items: [
      { code: 'EX', href: '/admin/operations', label: 'Exception queues' },
      { code: 'IG', href: '/admin/integrations', label: 'Integration registry' },
      { code: 'NT', href: '/admin/notifications', label: 'Notifications' },
      { code: 'SH', href: '/admin/search', label: 'Search health' },
      { code: 'AU', href: '/admin/automation', label: 'Automation' },
    ],
  },
  {
    label: 'Content and communication',
    items: [
      { code: 'CT', href: '/admin/content', label: 'Destination content' },
      { code: 'NW', href: '/admin/newsletter-subscriptions', label: 'Newsletter' },
      { code: 'SA', href: '/admin/service-advisories', label: 'Service advisories' },
    ],
  },
  {
    label: 'Security and system',
    items: [
      { code: 'RK', href: '/admin/risk', label: 'Risk review' },
      { code: 'SC', href: '/admin/security', label: 'Security posture' },
      { code: 'PV', href: '/admin/privacy', label: 'Privacy operations' },
      { code: 'AL', href: '/admin/audit', label: 'Audit workbench' },
      { code: 'CF', href: '/admin/configuration', label: 'Configuration' },
    ],
  },
] as const satisfies readonly WorkspaceNavigationGroup[];

export const customerWorkspaceNavigation = [
  {
    label: 'My travel',
    items: [
      { code: 'DB', href: '/account', label: 'Dashboard' },
      { code: 'TR', href: '/account/trips', label: 'Trips and bookings' },
      { code: 'MB', href: '/manage-booking', label: 'Manage booking' },
      { code: 'PY', href: '/account/payments', label: 'Payments' },
      { code: 'DC', href: '/account/documents', label: 'Travel documents' },
      { code: 'RV', href: '/account/reviews', label: 'My reviews' },
    ],
  },
  {
    label: 'Profile and preferences',
    items: [
      { code: 'PF', href: '/account/settings', label: 'Profile and security' },
      { code: 'TV', href: '/account/travelers', label: 'Saved travelers' },
      { code: 'NT', href: '/account/notifications', label: 'Notifications' },
      { code: 'CN', href: '/account/consents', label: 'Privacy choices' },
      { code: 'BN', href: '/account/benefits', label: 'Benefits' },
    ],
  },
  {
    label: 'Help and business',
    items: [
      { code: 'HP', href: '/account/support', label: 'Support' },
      { code: 'CR', href: '/account/company-requests', label: 'Company requests' },
      { code: 'OF', href: '/offers', label: 'Offers' },
    ],
  },
] as const satisfies readonly WorkspaceNavigationGroup[];

export const businessWorkspaceNavigation = [
  {
    label: 'Corporate travel',
    items: [
      { code: 'DB', href: '/business/dashboard', label: 'Dashboard' },
      { code: 'RQ', href: '/account#company-travel-request', label: 'New travel request' },
      { code: 'TM', href: '/business/members', label: 'Team access' },
    ],
  },
  {
    label: 'Finance and reporting',
    items: [
      { code: 'RP', href: '/business/reports', label: 'Company reports' },
      { code: 'ST', href: '/business/statements', label: 'Statements' },
      { code: 'AL', href: '/business/audit', label: 'Audit log' },
    ],
  },
  {
    label: 'Support',
    items: [
      { code: 'SP', href: '/business/support', label: 'Support cases' },
      { code: 'PA', href: '/account', label: 'Personal account' },
    ],
  },
] as const satisfies readonly WorkspaceNavigationGroup[];

export const agentWorkspaceNavigation = [
  {
    label: 'Agency operations',
    items: [
      { code: 'DB', href: '/agent', label: 'Dashboard and customers' },
      { code: 'OP', href: '/business/dashboard', label: 'Agency operations' },
      { code: 'RP', href: '/agent/reports', label: 'Customer reports' },
    ],
  },
  {
    label: 'Finance and support',
    items: [
      { code: 'ST', href: '/business/statements', label: 'Statements' },
      { code: 'SP', href: '/business/support', label: 'Support' },
      { code: 'AL', href: '/business/audit', label: 'Audit log' },
    ],
  },
] as const satisfies readonly WorkspaceNavigationGroup[];
