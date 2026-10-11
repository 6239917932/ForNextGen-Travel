'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { readJsonResponse } from '@/lib/api/clientResponse';
import type { ApiErrorResponse, PartnerBookingRecord } from '@/types/commerce';
type BookingPage = {
  data: PartnerBookingRecord[];
  meta: { totalCount: number; totalPages: number };
};
export default function PartnerBookingsPage() {
  const [bookings, setBookings] = useState<PartnerBookingRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/v1/partner/bookings?page=' + page + '&pageSize=25', { signal: controller.signal })
      .then(async (response) => {
        const result = await readJsonResponse<BookingPage | ApiErrorResponse>(response);
        if (controller.signal.aborted) return;
        setError(undefined);
        if (!response.ok || !result || !('data' in result)) {
          setError(
            result && 'error' in result ? result.error.message : 'Bookings could not be loaded.',
          );
          return;
        }
        setBookings(result.data);
        setTotalPages(result.meta.totalPages);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('The booking service could not be reached.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, attempt]);
  return (
    <section className="account-page partner-bookings">
      <h1>Travel bookings</h1>
      <p>Review guest stays and payment status for your assigned hotel listings.</p>
      <Link className="home-card__link" href="/partner/amendments">
        Review amendments
      </Link>
      {error ? (
        <p role="alert">
          {error}{' '}
          <button
            onClick={() => {
              setLoading(true);
              setAttempt(attempt + 1);
            }}
            type="button"
          >
            Try again
          </button>
        </p>
      ) : null}
      {loading ? (
        <p role="status">Loading bookings…</p>
      ) : !error && bookings.length === 0 ? (
        <Card>No bookings match this page.</Card>
      ) : null}
      {!loading && !error
        ? bookings.map((booking) => (
            <Card key={booking.confirmationCode}>
              <h2>{booking.confirmationCode}</h2>
              <p>
                {booking.hotelName} · {booking.roomName}
              </p>
              <p>
                {booking.guestName} · {booking.checkInDate} to {booking.checkOutDate}
              </p>
              <p>
                Booking: {booking.status} · Payment: {booking.paymentStatus}
              </p>
              <p>
                {new Intl.NumberFormat('en-IN', {
                  style: 'currency',
                  currency: booking.currency,
                }).format(booking.totalAmount)}
              </p>
            </Card>
          ))
        : null}
      <div className="manage-booking__document-actions">
        <button
          disabled={loading || page <= 1}
          onClick={() => {
            setLoading(true);
            setPage(page - 1);
          }}
          type="button"
        >
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button
          disabled={loading || page >= totalPages}
          onClick={() => {
            setLoading(true);
            setPage(page + 1);
          }}
          type="button"
        >
          Next
        </button>
      </div>
    </section>
  );
}
