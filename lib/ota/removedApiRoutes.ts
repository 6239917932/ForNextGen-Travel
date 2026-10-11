import extraction from './extraction.json' with { type: 'json' };

const patterns = [
  ...extraction.removed,
  'app/api/v1/partner/channels',
  'app/api/v1/partner/booking-addons',
]
  .filter((path) => path.startsWith('app/api/'))
  .map(
    (path) =>
      new RegExp(
        '^' +
          path
            .slice(3)
            .split('/')
            .map((segment) =>
              segment.startsWith('[') ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            )
            .join('/') +
          '(?:/|$)',
      ),
  );

export function isRemovedPmsApiPath(pathname: string): boolean {
  // The OTA booking export is a retained route alongside the old dynamic PMS dossier.
  if (pathname === '/api/v1/partner/bookings/export') return false;
  return patterns.some((pattern) => pattern.test(pathname));
}
