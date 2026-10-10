export interface NavigationItem {
  href: string;
  label: string;
}

export interface OfficeLocation {
  locality: string;
  region: string;
  type: 'Corporate office' | 'Registered office';
}

export const siteConfig = {
  group: {
    name: 'ForNextGen Group',
    href: 'https://www.fornextgengroup.com',
    travelDirectoryHref: 'https://www.fornextgengroup.com/solutions.html#travel',
  },
  description:
    'Thoughtful travel planning, trusted bookings, and connected journeys from the Himalayas to everywhere.',
  legalName: 'Mandyal Travels Services Private Limited',
  name: 'Mandyal Travels',
  navigation: [
    { href: '/', label: 'Home' },
    { href: '/trip-planner', label: 'Trip planner' },
    { href: '/destinations', label: 'Destinations' },
    { href: '/offers', label: 'Offers' },
    { href: '/login', label: 'Workspaces' },
    { href: '/manage-booking', label: 'Manage booking' },
    { href: '/contact', label: 'Contact us' },
  ] satisfies NavigationItem[],
  footerNavigation: [
    { href: '/hotels', label: 'Hotels' },
    { href: '/cars', label: 'Cars — coming soon' },
    { href: '/flights', label: 'Flights — coming soon' },
    { href: '/buses', label: 'Buses — coming soon' },
    { href: '/login#partner', label: 'List your hotel' },
    { href: '/manage-booking', label: 'Manage booking' },
  ] satisfies NavigationItem[],
  officeLocations: [
    {
      locality: 'Bir, District Kangra',
      region: 'Himachal Pradesh, India',
      type: 'Corporate office',
    },
    {
      locality: 'Village Suja, P.O. Matroo, Tehsil Joginder Nagar',
      region: 'District Mandi, Himachal Pradesh 175032, India',
      type: 'Registered office',
    },
  ] satisfies OfficeLocation[],
  registeredOffice: {
    lines: [
      'C/O Kewal Singh',
      'Village Suja, P.O. Matroo, Tehsil Joginder Nagar',
      'District Mandi, Himachal Pradesh 175032, India',
    ],
  },
  supportPhone: {
    display: '+91 80693 77940',
    href: '+918069377940',
  },
  supportEmail: 'support@mandyaltravels.com',
  grievanceOfficer: {
    name: 'Jasveer Singh',
    designation: 'Director and Grievance Officer',
    email: 'support@mandyaltravels.com',
    phone: {
      display: '+91 80693 77940',
      href: '+918069377940',
    },
  },
  socialLinks: {
    facebook: 'https://www.facebook.com/profile.php?id=61594331641440',
  },
  tagline: 'From the heart of the Himalayas to everywhere.',
} as const;
