import Image from 'next/image';
import Link from 'next/link';

import { HomeBookingWidget } from '@/components/home/HomeBookingWidget';
import { OrganizationStructuredData } from '@/components/seo/OrganizationStructuredData';
import { prisma } from '@/lib/prisma';
import { createPublicMetadata } from '@/lib/seo/siteMetadata';
import { hotelService } from '@/services/hotelService';

const description =
  'Official website of Mandyal Travels for verified hotel discovery, booking, trip planning and hotel supplier listings in Himachal Pradesh, India.';

export const metadata = createPublicMetadata({
  absoluteTitle: true,
  description,
  path: '/',
  title: 'Mandyal Travels | Himachal Hotels and Trip Planning',
});

const trustPoints = [
  {
    description: 'Understand the fare, inclusions, policies, and next step before you confirm.',
    number: '01',
    title: 'Clarity before checkout',
  },
  {
    description: 'Keep hotel searches, bookings, stay details, and support in one travel account.',
    number: '02',
    title: 'One connected stay',
  },
  {
    description: 'Search by the place travellers actually know—from a city to a local area.',
    number: '03',
    title: 'Locality-aware discovery',
  },
] as const;

const editorialJourneys = [
  {
    href: '/hotels?destination=Bir%20Billing',
    imageUrl: '/home/hero/bir-billing-02.jpg',
    name: 'Bir Billing',
    state: 'Himachal Pradesh',
    summary: 'Look for a stay near mountain views, village cafés, and the paragliding landscape.',
  },
  {
    href: '/trip-planner',
    imageUrl: '/home/hero/bir-billing-11.jpg',
    name: 'A slower mountain weekend',
    state: 'Trip inspiration',
    summary:
      'Build a simple stay-first itinerary, then shape the days around the place you choose.',
  },
] as const;

function ArrowIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
      <path
        d="M4 10h11M11 6l4 4-4 4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(amount);
}

export default async function Home() {
  const [hotelResult, destinationResult] = await Promise.allSettled([
    hotelService.getHotels(),
    prisma.destinationContent.findMany({
      orderBy: [{ publishedAt: 'desc' }, { name: 'asc' }],
      select: { heroImageUrl: true, name: true, slug: true, state: true, summary: true },
      take: 4,
      where: { status: 'PUBLISHED' },
    }),
  ]);
  const featuredHotels =
    hotelResult.status === 'fulfilled'
      ? hotelResult.value
          .filter(
            (hotel) => hotel.images[0] && hotel.rooms.some((room) => room.ratePlans.length > 0),
          )
          .slice(0, 3)
      : [];
  const featuredDestinations =
    destinationResult.status === 'fulfilled' ? destinationResult.value : [];
  const destinationCards =
    featuredDestinations.length > 0
      ? featuredDestinations.map((destination) => ({
          href: `/destinations/${destination.slug}`,
          imageUrl: destination.heroImageUrl,
          name: destination.name,
          state: destination.state,
          summary: destination.summary,
        }))
      : editorialJourneys;

  return (
    <div className="home-page travel-premium">
      <OrganizationStructuredData />
      <section aria-labelledby="home-search-title" className="home-search-hero">
        <Image
          alt="Himalayan mountain ridges, a winding road, and a hillside lodge at sunrise"
          className="home-search-hero__image"
          fill
          priority
          sizes="100vw"
          src="/home/mandyal-travel-hero-v2.png"
        />
        <div aria-hidden="true" className="home-search-hero__shade" />
        <div className="home-container home-search-hero__content">
          <div className="home-search-hero__copy">
            <p>Himalayan roots. Exceptional journeys.</p>
            <h1 id="home-search-title">A change of scenery. A better way to stay.</h1>
            <span>
              Discover mountain stays, plan your days and keep every booking in one place. Wherever
              you go, our local team is here to help.
            </span>
          </div>

          <HomeBookingWidget />
          <div className="travel-popular">
            <span>Explore a place</span>
            {['Bir Billing', 'Mandi', 'Manali', 'Shimla'].map((place) => (
              <Link key={place} href={`/hotels?destination=${encodeURIComponent(place)}`}>
                {place} ↗
              </Link>
            ))}
          </div>

          <div className="home-search-hero__quick-links" aria-label="Helpful hotel links">
            <Link href="/trip-planner">Plan a hotel trip</Link>
            <Link href="/destinations">Explore destinations</Link>
            <Link href="/manage-booking">Manage booking</Link>
            <Link href="/login#partner">List your hotel</Link>
          </div>
        </div>
      </section>

      <section className="travel-journeys home-container" aria-label="Choose your travel journey">
        {[
          {
            number: '01',
            title: 'Find your next stay',
            text: 'Compare room choices, rates and policies before you book.',
            href: '/hotels',
            action: 'Explore hotels',
          },
          {
            number: '02',
            title: 'Make the days your own',
            text: 'Build a stay-first itinerary around your interests and pace.',
            href: '/trip-planner',
            action: 'Plan a trip',
          },
          {
            number: '03',
            title: 'Everything, in one place',
            text: 'Find your confirmation, manage a booking or reach our team.',
            href: '/manage-booking',
            action: 'Manage booking',
          },
        ].map((item) => (
          <Link href={item.href} key={item.number}>
            <span>{item.number} / YOUR JOURNEY</span>
            <h2>{item.title}</h2>
            <p>{item.text}</p>
            <strong>
              {item.action} <ArrowIcon />
            </strong>
          </Link>
        ))}
      </section>

      {featuredHotels.length > 0 ? (
        <section aria-labelledby="featured-stays-title" className="home-discovery">
          <div className="home-container">
            <div className="home-section__heading home-section__heading--row">
              <div>
                <p className="home-section__eyebrow">Places to explore</p>
                <h2 className="home-section__title" id="featured-stays-title">
                  Find a stay that suits your journey.
                </h2>
              </div>
              <div className="home-discovery__heading-action">
                <p className="home-section__description">
                  Explore property details, compare room choices and review pricing in hotel search.
                </p>
                <Link className="home-text-link" href="/hotels">
                  View all available stays <ArrowIcon />
                </Link>
              </div>
            </div>

            <div className="home-stay-grid">
              {featuredHotels.map((hotel) => {
                const roomRates = hotel.rooms.flatMap((room) =>
                  room.ratePlans.map((ratePlan) => ratePlan.nightlyRate.amount),
                );
                const startingRate = Math.min(...roomRates);
                const location = hotel.location.address.locality ?? hotel.location.address.city;
                const image = hotel.images.find((item) => item.isPrimary) ?? hotel.images[0];

                return (
                  <article className="home-stay-card" key={hotel.id}>
                    <Link
                      aria-label={`Search rooms at ${hotel.name}`}
                      className="home-stay-card__image"
                      href={`/hotels?destination=${encodeURIComponent(hotel.name)}`}
                      style={{ backgroundImage: `url(${JSON.stringify(image.url)})` }}
                    >
                      <span>{hotel.starRating}-star hotel</span>
                    </Link>
                    <div className="home-stay-card__content">
                      <p>{location}</p>
                      <h3>{hotel.name}</h3>
                      <div>
                        <span>
                          From <strong>{formatPrice(startingRate)}</strong> per night
                        </span>
                        <Link href={`/hotels?destination=${encodeURIComponent(hotel.name)}`}>
                          Check rooms <ArrowIcon />
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="featured-destinations-title" className="home-destinations">
        <div className="home-container">
          <div className="home-section__heading home-section__heading--row">
            <div>
              <p className="home-section__eyebrow">
                {featuredDestinations.length > 0
                  ? 'Reviewed destination guides'
                  : 'Mountain travel inspiration'}
              </p>
              <h2 className="home-section__title" id="featured-destinations-title">
                Find the right place before the right room.
              </h2>
            </div>
            <p className="home-section__description">
              {featuredDestinations.length > 0
                ? 'Practical, human-reviewed local context to help you choose where to stay and what to know before you travel.'
                : 'Start with a place and a pace that feel right. Check room availability in hotel search, then review your final quote before you confirm.'}
            </p>
          </div>

          <div className="home-destination-grid">
            {destinationCards.map((destination) => (
              <Link
                className="home-destination-card"
                href={destination.href}
                key={destination.name}
                style={{ backgroundImage: `url(${JSON.stringify(destination.imageUrl)})` }}
              >
                <span>{destination.state}</span>
                <div>
                  <h3>{destination.name}</h3>
                  <p>{destination.summary}</p>
                  <strong>
                    {featuredDestinations.length > 0 ? 'Explore guide' : 'Start planning'}{' '}
                    <ArrowIcon />
                  </strong>
                </div>
              </Link>
            ))}
          </div>

          {featuredDestinations.length > 0 ? (
            <Link className="home-text-link home-destinations__all" href="/destinations">
              Browse every published guide <ArrowIcon />
            </Link>
          ) : null}
        </div>
      </section>

      <section className="travel-story home-container" aria-labelledby="travel-story-title">
        <div className="travel-story__image">
          <Image
            src="/home/hero/bir-billing-14.jpg"
            alt="A paraglider above the green Kangra valley"
            fill
            sizes="(max-width: 760px) 100vw, 50vw"
          />
          <span>THE HIMALAYAS, AT YOUR OWN PACE</span>
        </div>
        <div className="travel-story__copy">
          <p className="home-section__eyebrow">Local roots. A wider horizon.</p>
          <h2 id="travel-story-title">Go somewhere that stays with you.</h2>
          <p>
            From a quiet village café to a sunrise over the Dhauladhar, the best journeys leave room
            for discovery. We bring the warmth of our Himachal home to a simpler way to find and
            book your stay.
          </p>
          <Link className="home-link-button home-link-button--primary" href="/trip-planner">
            Shape your next journey <ArrowIcon />
          </Link>
        </div>
      </section>
      <section className="home-trust" aria-labelledby="trust-title">
        <div className="home-container">
          <div className="home-section__heading">
            <p className="home-section__eyebrow">Confidence at every step</p>
            <h2 className="home-section__title" id="trust-title">
              More clarity. Less guesswork.
            </h2>
          </div>
          <div className="home-trust__grid">
            {trustPoints.map((point) => (
              <article className="home-trust__item" key={point.number}>
                <span>{point.number}</span>
                <h3>{point.title}</h3>
                <p>{point.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section
        className="travel-service home-container"
        aria-label="Travel support and hotel suppliers"
      >
        <article>
          <p className="home-section__eyebrow">A real team, within reach</p>
          <h2>
            Travel plans change.
            <br />
            We’re here to help.
          </h2>
          <p>
            For booking questions or local guidance, talk to our travel support team. Have your
            booking reference ready when you contact us.
          </p>
          <Link className="home-link-button home-link-button--primary" href="/contact">
            Contact our team <ArrowIcon />
          </Link>
        </article>
        <article id="supplier-launch">
          <p className="home-section__eyebrow">For hotel partners</p>
          <h2>
            Your next guest
            <br />
            starts here.
          </h2>
          <p>
            Apply to list your property in our travel marketplace. Publish room types, rates and
            availability, and receive travel bookings through your supplier account.
          </p>
          <Link className="home-link-button home-link-button--outline" href="/partners/apply">
            List your hotel <ArrowIcon />
          </Link>
        </article>
      </section>
      <section className="travel-faq home-container" aria-labelledby="travel-faq-title">
        <div>
          <p className="home-section__eyebrow">Before you travel</p>
          <h2 id="travel-faq-title">A few helpful answers.</h2>
          <Link className="home-text-link" href="/contact">
            Have another question? <ArrowIcon />
          </Link>
        </div>
        <div>
          <details>
            <summary>How do I find the right hotel?</summary>
            <p>
              Search by city, local area or hotel, choose your dates and guest count, then compare
              available rooms. Check the total price, inclusions and cancellation policy before
              confirming.
            </p>
          </details>
          <details>
            <summary>Can I change or cancel a booking?</summary>
            <p>
              Open Manage booking to find your reservation and its available options. Changes and
              refunds depend on the policy shown for your booked room.
            </p>
            <Link href="/manage-booking">Find my booking →</Link>
          </details>
          <details>
            <summary>Are flights, cars and buses available?</summary>
            <p>
              Hotel search is available now. Flights, cars and buses are coming soon. Contact our
              team if you’d like to hear when those services open.
            </p>
          </details>
        </div>
      </section>
    </div>
  );
}
