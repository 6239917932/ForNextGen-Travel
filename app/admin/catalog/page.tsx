import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Card } from '@/components/ui/Card';
import type { Prisma } from '@/generated/prisma/client';
import { getPlatformAdmin } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';
import {
  ADMIN_SUPPLY_CATALOG_PAGE_SIZE,
  ADMIN_SUPPLY_CATALOG_RESULT_LIMIT,
  adminSupplyCatalogPath,
  assessPropertyContent,
  internalInventorySource,
  normalizeAdminSupplyCatalogFilters,
} from '@/services/adminSupplyCatalogService';
import { hotelService } from '@/services/hotelService';

export const metadata: Metadata = { title: 'Supply catalog' };

type AdminSupplyCatalogPageProps = {
  searchParams: Promise<{
    approval?: string | string[];
    content?: string | string[];
    page?: string | string[];
    publication?: string | string[];
    q?: string | string[];
    source?: string | string[];
  }>;
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(value);
}

function label(value: string) {
  return value.replaceAll('_', ' ').toLowerCase();
}

export default async function AdminSupplyCatalogPage({
  searchParams,
}: AdminSupplyCatalogPageProps) {
  if (!(await getPlatformAdmin())) redirect('/login?returnTo=/admin/catalog');
  const filters = normalizeAdminSupplyCatalogFilters(await searchParams);
  const where: Prisma.PartnerPropertyWhereInput = {
    ...(filters.approval === 'ALL' ? {} : { approvalStatus: filters.approval }),
    ...(filters.publication === 'ALL' ? {} : { publicationStatus: filters.publication }),
    ...(filters.query
      ? {
          OR: [
            { displayName: { contains: filters.query } },
            { hotelSlug: { contains: filters.query } },
            { locality: { contains: filters.query } },
            { city: { contains: filters.query } },
            { district: { contains: filters.query } },
            { state: { contains: filters.query } },
            { partner: { name: { contains: filters.query } } },
          ],
        }
      : {}),
  };
  const baseCount = await prisma.partnerProperty.count({ where });
  const overLimit = baseCount > ADMIN_SUPPLY_CATALOG_RESULT_LIMIT;
  const [properties, hotels] = await Promise.all([
    overLimit
      ? Promise.resolve([])
      : prisma.partnerProperty.findMany({
          include: {
            partner: { select: { id: true, name: true, status: true } },
            rooms: {
              include: {
                ratePlans: { select: { id: true }, where: { status: 'ACTIVE' } },
              },
              where: { status: 'ACTIVE' },
            },
          },
          orderBy: [{ updatedAt: 'desc' }, { displayName: 'asc' }],
          take: ADMIN_SUPPLY_CATALOG_RESULT_LIMIT,
          where,
        }),
    hotelService.getHotels(),
  ]);
  const normalizedSources = new Map(
    hotels.map((hotel) => [hotel.slug, hotel.inventory.source] as const),
  );
  const assessed = properties.map((property) => {
    const assessment = assessPropertyContent({
      activeRatePlans: property.rooms.reduce((count, room) => count + room.ratePlans.length, 0),
      activeRooms: property.rooms.length,
      amenitiesJson: property.amenitiesJson,
      city: property.city,
      description: property.description,
      district: property.district,
      imageUrl: property.imageUrl,
      imageUrlsJson: property.imageUrlsJson,
      latitude: property.latitude,
      locality: property.locality,
      longitude: property.longitude,
      policiesJson: property.policiesJson,
      state: property.state,
      streetAddress: property.streetAddress,
    });
    return {
      assessment,
      property,
      source: internalInventorySource(
        property.listingSource,
        normalizedSources.get(property.hotelSlug),
      ),
    };
  });
  const filtered = assessed.filter(
    ({ assessment, source }) =>
      (filters.source === 'ALL' || source === filters.source) &&
      (filters.content === 'ALL' ||
        (filters.content === 'READY' ? assessment.ready : !assessment.ready)),
  );
  const directCount = filtered.filter(({ source }) => source === 'DIRECT').length;
  const readyCount = filtered.filter(({ assessment }) => assessment.ready).length;
  const totalPages = Math.max(1, Math.ceil(filtered.length / ADMIN_SUPPLY_CATALOG_PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const rows = filtered.slice(
    (page - 1) * ADMIN_SUPPLY_CATALOG_PAGE_SIZE,
    page * ADMIN_SUPPLY_CATALOG_PAGE_SIZE,
  );

  return (
    <section className="account-page business-report admin-workspace">
      <header className="admin-hero">
        <div>
          <p className="admin-hero__eyebrow">Protected catalog governance</p>
          <h1>Hotel supply catalog</h1>
          <p>
            Review property content, supplier ownership, internal inventory provenance, and listing
            readiness without changing publication, rates, availability, or bookings.
          </p>
        </div>
        <Link className="ui-button ui-button--secondary" href="/admin">
          Back to operations
        </Link>
      </header>

      <Card>
        <strong>Internal provenance only</strong>
        <p>
          Direct hotel supply and external API supplier labels are visible here for operations. They
          remain hidden from customer hotel results and detail pages.
        </p>
      </Card>

      <form className="business-report__filters" method="get">
        <div className="ui-field business-report__search">
          <label className="ui-field__label" htmlFor="admin-catalog-search">
            Property, supplier, slug, or destination
          </label>
          <input
            className="ui-input"
            defaultValue={filters.query}
            id="admin-catalog-search"
            maxLength={100}
            name="q"
            type="search"
          />
        </div>
        <label className="ui-field">
          <span className="ui-field__label">Inventory source</span>
          <select className="ui-input" defaultValue={filters.source} name="source">
            <option value="ALL">All sources</option>
            <option value="DIRECT">Direct hotel supply</option>
            <option value="EXTERNAL">External API supplier</option>
          </select>
        </label>
        <label className="ui-field">
          <span className="ui-field__label">Approval</span>
          <select className="ui-input" defaultValue={filters.approval} name="approval">
            <option value="ALL">All approval states</option>
            <option value="PENDING_REVIEW">Pending review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </label>
        <label className="ui-field">
          <span className="ui-field__label">Publication</span>
          <select className="ui-input" defaultValue={filters.publication} name="publication">
            <option value="ALL">All publication states</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="PAUSED">Paused</option>
          </select>
        </label>
        <label className="ui-field">
          <span className="ui-field__label">Content readiness</span>
          <select className="ui-input" defaultValue={filters.content} name="content">
            <option value="ALL">All content states</option>
            <option value="READY">Review ready</option>
            <option value="NEEDS_ATTENTION">Needs attention</option>
          </select>
        </label>
        <div className="business-report__filter-actions">
          <button className="ui-button ui-button--primary" type="submit">
            Apply filters
          </button>
          <Link className="ui-button ui-button--secondary" href="/admin/catalog">
            Clear
          </Link>
        </div>
      </form>

      {overLimit ? (
        <Card className="admin-empty-state">
          This query matches {baseCount.toLocaleString('en-IN')} properties. Narrow the supplier,
          destination, approval, or publication filters to fewer than{' '}
          {ADMIN_SUPPLY_CATALOG_RESULT_LIMIT.toLocaleString('en-IN')} records.
        </Card>
      ) : (
        <>
          <div className="partner-bookings__summary">
            <Card>
              <span>Filtered properties</span>
              <strong>{filtered.length.toLocaleString('en-IN')}</strong>
            </Card>
            <Card>
              <span>Direct hotel supply</span>
              <strong>{directCount.toLocaleString('en-IN')}</strong>
            </Card>
            <Card>
              <span>External API supplier</span>
              <strong>{(filtered.length - directCount).toLocaleString('en-IN')}</strong>
            </Card>
            <Card>
              <span>Content review ready</span>
              <strong>{readyCount.toLocaleString('en-IN')}</strong>
            </Card>
          </div>

          <Card className="business-report__table-card">
            <div className="business-report__table-scroll">
              <table className="business-report__table">
                <thead>
                  <tr>
                    <th>Property and destination</th>
                    <th>Supplier and source</th>
                    <th>Governance</th>
                    <th>Content readiness</th>
                    <th>Inventory structure</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ assessment, property, source }) => {
                    const ratePlans = property.rooms.reduce(
                      (count, room) => count + room.ratePlans.length,
                      0,
                    );
                    return (
                      <tr key={property.id}>
                        <td>
                          <strong>{property.displayName}</strong>
                          <span>
                            {property.locality || property.city || 'Location incomplete'},{' '}
                            {property.district || property.state || 'region incomplete'}
                          </span>
                          <span>{property.hotelSlug}</span>
                        </td>
                        <td>
                          <Link href={`/admin/partners/${property.partner.id}`}>
                            {property.partner.name}
                          </Link>
                          <strong>
                            {source === 'DIRECT'
                              ? 'Direct hotel supply inventory'
                              : 'External API supplier inventory'}
                          </strong>
                          <span>{property.partner.status.toLowerCase()} supplier</span>
                        </td>
                        <td>
                          <strong>{label(property.approvalStatus)}</strong>
                          <span>{label(property.publicationStatus)}</span>
                          {property.approvalStatus === 'PENDING_REVIEW' ? (
                            <Link
                              href={`/admin/partners/${property.partner.id}#property-${property.id}`}
                            >
                              Open review controls
                            </Link>
                          ) : null}
                        </td>
                        <td>
                          <strong>
                            {assessment.ready
                              ? 'Ready for human review'
                              : `${assessment.missing.length} checks need attention`}
                          </strong>
                          <span>
                            {assessment.completeChecks}/{assessment.totalChecks} checks complete
                          </span>
                          {assessment.missing.length ? (
                            <span>Missing: {assessment.missing.join(', ')}</span>
                          ) : null}
                        </td>
                        <td>
                          <strong>
                            {property.rooms.length} active room{' '}
                            {property.rooms.length === 1 ? 'type' : 'types'}
                          </strong>
                          <span>
                            {ratePlans} active rate {ratePlans === 1 ? 'plan' : 'plans'}
                          </span>
                        </td>
                        <td>{formatDate(property.updatedAt)}</td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={6}>No properties match these catalog filters.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>

          <nav aria-label="Hotel supply catalog pages" className="business-audit-pagination">
            {page > 1 ? (
              <Link
                className="ui-button ui-button--secondary"
                href={adminSupplyCatalogPath(filters, page - 1)}
              >
                Previous page
              </Link>
            ) : (
              <span />
            )}
            <span>
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                className="ui-button ui-button--secondary"
                href={adminSupplyCatalogPath(filters, page + 1)}
              >
                Next page
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </>
      )}
    </section>
  );
}
