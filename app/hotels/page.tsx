import { PublicPageHero } from '@/components/layout/PublicPageHero';

import { HotelDiscoveryExplanation } from '@/components/hotel/HotelDiscoveryExplanation';
import { HotelResultCard } from '@/components/hotel/HotelResultCard';
import { HotelResultsExplorer } from '@/components/hotel/HotelResultsExplorer';
import { HotelSearchForm } from '@/components/hotel/HotelSearchForm';
import { HotelDiscoveryAssistant } from '@/components/hotel/HotelDiscoveryAssistant';
import { hotelService, HotelSearchInputError } from '@/services/hotelService';
import { createHotelSearchCriteria } from '@/utils/hotelSearchCriteria';
import { createHotelSearchFilters } from '@/utils/hotelSearchCriteria';
import { createHotelResultsLocationMarkers } from '@/utils/hotelResultsLocation';
import Link from 'next/link';
import { createPublicMetadata } from '@/lib/seo/siteMetadata';

export const metadata = createPublicMetadata({
  description:
    'Search verified hotel stays with transparent room information, rates and policies through Mandyal Travels.',
  path: '/hotels',
  title: 'Hotels in Himachal Pradesh',
});

interface HotelsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export default async function HotelsPage({ searchParams }: HotelsPageProps) {
  const rawSearchParams = await searchParams;
  const criteria = createHotelSearchCriteria(rawSearchParams);
  const filters = createHotelSearchFilters(rawSearchParams);
  let error: string | undefined;
  let resultPage: Awaited<ReturnType<typeof hotelService.searchHotels>> = {
    page: 1,
    pageCount: 1,
    pageSize: 10,
    results: [],
    totalResults: 0,
  };
  try {
    resultPage = await hotelService.searchHotels(criteria, filters);
  } catch (cause) {
    error =
      cause instanceof HotelSearchInputError
        ? cause.message
        : 'Hotel search is temporarily unavailable. Please try again.';
  }

  function pageHref(page: number) {
    const query = new URLSearchParams();
    query.set('adults', String(criteria.adults));
    query.set('checkInDate', criteria.checkInDate);
    query.set('checkOutDate', criteria.checkOutDate);
    query.set('children', String(criteria.children));
    query.set('destination', criteria.destination);
    query.set('rooms', String(criteria.rooms));
    query.set('minimumStarRating', String(filters.minimumStarRating));
    query.set('amenity', filters.amenity);
    query.set('maximumNightlyRate', String(filters.maximumNightlyRate));
    if (filters.centerLatitude !== undefined && filters.centerLongitude !== undefined) {
      query.set('latitude', String(filters.centerLatitude));
      query.set('longitude', String(filters.centerLongitude));
    }
    if (filters.radiusKm) query.set('radiusKm', String(filters.radiusKm));
    query.set('sort', filters.sort);
    if (filters.refundableOnly) query.set('refundableOnly', 'true');
    query.set('page', String(page));
    return `/hotels?${query.toString()}`;
  }

  return (
    <div className="hotel-page">
      <PublicPageHero
        description="Discover verified hotels with transparent rates, room choices, and policies you can understand before booking."
        eyebrow="Hotel stays"
        title="Find a stay that feels right."
      />

      <section className="hotel-page__content">
        <div className="hotel-page__container">
          <HotelSearchForm criteria={criteria} filters={filters} />
          <HotelDiscoveryAssistant criteria={criteria} />
          <HotelDiscoveryExplanation
            destination={criteria.destination}
            requestToken={first(rawSearchParams.guidedAt)}
          />

          {error ? (
            <p className="flight-page__error" role="alert">
              {error}
            </p>
          ) : null}

          {!error ? (
            <div className="hotel-page__results-heading">
              <div>
                <p className="hotel-page__eyebrow">Available stays</p>
                <h2>{resultPage.totalResults} hotels found</h2>
              </div>

              <p>
                {criteria.destination
                  ? `Showing stays matching “${criteria.destination}”`
                  : 'Showing all available destinations'}
              </p>
            </div>
          ) : null}

          {!error && resultPage.results.length > 0 ? (
            <HotelResultsExplorer markers={createHotelResultsLocationMarkers(resultPage.results)}>
              {resultPage.results.map((result, index) => (
                <div
                  className="hotel-results-explorer__card"
                  data-hotel-key={result.hotel.slug}
                  id={`hotel-result-${result.hotel.slug}`}
                  key={result.hotel.id}
                >
                  <HotelResultCard criteria={criteria} eagerImage={index === 0} result={result} />
                </div>
              ))}
            </HotelResultsExplorer>
          ) : !error ? (
            <p className="hotel-page__empty-state">
              No verified hotels are available for this search yet. Try another destination or
              adjust your dates and filters.
            </p>
          ) : null}

          {!error && resultPage.pageCount > 1 ? (
            <nav aria-label="Hotel results pages" className="hotel-results-pagination">
              {resultPage.page > 1 ? (
                <Link href={pageHref(resultPage.page - 1)}>Previous</Link>
              ) : (
                <span />
              )}
              <span>
                Page {resultPage.page} of {resultPage.pageCount}
              </span>
              {resultPage.page < resultPage.pageCount ? (
                <Link href={pageHref(resultPage.page + 1)}>Next</Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </div>
      </section>
    </div>
  );
}
