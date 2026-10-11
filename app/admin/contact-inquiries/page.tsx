import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Card } from '@/components/ui/Card';
import { contactCategoryLabel, inquiryStatuses } from '@/lib/admin/contactInquiryRules';
import { getPlatformAdmin } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = { title: 'Contact inquiries' };

export default async function AdminContactInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await getPlatformAdmin())) redirect('/login?returnTo=/admin/contact-inquiries');
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q.trim().slice(0, 120) : '';
  const status =
    typeof params.status === 'string' && inquiryStatuses.some((value) => value === params.status)
      ? params.status
      : '';
  const categories = ['HOTEL_OWNER', 'CAR_OWNER', 'BOOKING_HELP', 'GENERAL'];
  const category =
    typeof params.category === 'string' && categories.includes(params.category)
      ? params.category
      : '';
  const where = {
    ...(status ? { status } : {}),
    ...(category ? { category } : {}),
    ...(q
      ? {
          OR: ['reference', 'name', 'email', 'message'].map((field) => ({
            [field]: { contains: q },
          })),
        }
      : {}),
  };
  const total = await prisma.contactInquiry.count({ where });
  const pages = Math.max(1, Math.ceil(total / 30));
  const requestedPage =
    typeof params.page === 'string' && /^\d{1,6}$/.test(params.page) ? Number(params.page) : 1;
  const page = Math.max(1, Math.min(requestedPage, pages));
  const inquiries = await prisma.contactInquiry.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 30,
    skip: (page - 1) * 30,
  });
  const pageHref = (next: number) =>
    `/admin/contact-inquiries?${new URLSearchParams({ q, status, category, page: String(next) })}`;

  return (
    <section className="account-page business-report admin-workspace">
      <header className="admin-hero">
        <div>
          <p className="hotel-page__eyebrow">Public message inbox</p>
          <h1>Contact inquiries</h1>
          <p>
            Review the newest customer, hotel-owner, and car-owner messages captured by the public
            contact form.
          </p>
        </div>
        <Link className="ui-button ui-button--secondary" href="/admin/support">
          Support operations
        </Link>
      </header>

      <Card>
        <form className="business-report__filters" method="get">
          <label className="ui-field">
            <span className="ui-field__label">Search requests</span>
            <input
              className="ui-input"
              defaultValue={q}
              maxLength={120}
              name="q"
              placeholder="Reference, name, email or message"
            />
          </label>
          <label className="ui-field">
            <span className="ui-field__label">Status</span>
            <select className="ui-input" defaultValue={status} name="status">
              <option value="">All statuses</option>
              {inquiryStatuses.map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className="ui-field">
            <span className="ui-field__label">Category</span>
            <select className="ui-input" defaultValue={category} name="category">
              <option value="">All categories</option>
              {categories.map((value) => (
                <option key={value} value={value}>
                  {contactCategoryLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <div className="business-report__filter-actions">
            <button className="ui-button ui-button--primary" type="submit">
              Filter requests
            </button>
            <Link href="/admin/contact-inquiries">Clear filters</Link>
          </div>
        </form>
      </Card>
      <Card className="business-report__table-card">
        <div className="business-report__table-scroll">
          <table className="business-report__table">
            <thead>
              <tr>
                <th>Received</th>
                <th>Reference</th>
                <th>Category</th>
                <th>Contact</th>
                <th>Message</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {inquiries.map((inquiry) => (
                <tr key={inquiry.id}>
                  <td>{inquiry.createdAt.toLocaleString('en-IN')}</td>
                  <td>
                    <Link href={`/admin/contact-inquiries/${inquiry.id}`}>
                      <strong>{inquiry.reference}</strong>
                    </Link>
                  </td>
                  <td>{contactCategoryLabel(inquiry.category)}</td>
                  <td>
                    <a href={`mailto:${inquiry.email}`}>{inquiry.name}</a>
                    <br />
                    <small>{inquiry.email}</small>
                    {inquiry.phone ? (
                      <>
                        <br />
                        <a href={`tel:${inquiry.phone}`}>{inquiry.phone}</a>
                      </>
                    ) : null}
                  </td>
                  <td>
                    {inquiry.message.length > 160
                      ? `${inquiry.message.slice(0, 160)}…`
                      : inquiry.message}
                  </td>
                  <td>{inquiry.status.replaceAll('_', ' ')}</td>
                  <td>
                    <Link
                      className="home-card__link"
                      href={`/admin/contact-inquiries/${inquiry.id}`}
                    >
                      Open request
                    </Link>
                  </td>
                </tr>
              ))}
              {inquiries.length === 0 ? (
                <tr>
                  <td colSpan={7}>No requests match these filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="booking-confirmation__note">
        {total} matching requests · Page {page} of {pages}. Accepting an enquiry records your
        decision; it does not grant supplier account access.
      </p>
      <nav aria-label="Request pages">
        {page > 1 ? (
          <Link className="ui-button ui-button--secondary" href={pageHref(page - 1)}>
            Previous page
          </Link>
        ) : null}
        {page < pages ? (
          <Link className="ui-button ui-button--secondary" href={pageHref(page + 1)}>
            Next page
          </Link>
        ) : null}
      </nav>
    </section>
  );
}
