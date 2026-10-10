'use client';

import { useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';

import { formatIndiaCalendarDate, offsetLocalCalendarDate } from '@/utils/localDate';

type BookingProduct = 'hotels' | 'cars' | 'flights' | 'buses';

const PRODUCTS: ReadonlyArray<{
  available: boolean;
  href: string;
  label: string;
  value: BookingProduct;
}> = [
  { available: true, href: '/hotels', label: 'Hotels', value: 'hotels' },
  { available: false, href: '/cars', label: 'Cars', value: 'cars' },
  { available: false, href: '/flights', label: 'Flights', value: 'flights' },
  { available: false, href: '/buses', label: 'Buses', value: 'buses' },
];

function ProductIcon({ product }: { product: BookingProduct }) {
  const paths: Record<BookingProduct, ReactNode> = {
    hotels: <path d="M4 19V8l8-4 8 4v11M8 19v-5h8v5M8 9h.01M12 9h.01M16 9h.01" />,
    flights: <path d="m3 11 7 1 4-8 2 1-2 8 5 2v2l-6-1-3 4-2-1 2-4-7-2Z" />,
    buses: <path d="M5 17V7c0-2 1.5-3 7-3s7 1 7 3v10M5 11h14M8 17v2M16 17v2M8 15h.01M16 15h.01" />,
    cars: <path d="m4 15 1.5-5h13l1.5 5M6 10l2-4h8l2 4M5 15v3M19 15v3M8 15h.01M16 15h.01" />,
  };

  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7">
        {paths[product]}
      </g>
    </svg>
  );
}

function Field({
  label,
  required = true,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> & {
  label: string;
}) {
  return (
    <label className="home-booking-widget__field">
      <span>{label}</span>
      <input required={required} {...props} />
    </label>
  );
}

export function HomeBookingWidget() {
  const today = formatIndiaCalendarDate();
  const [activeProduct, setActiveProduct] = useState<BookingProduct>('hotels');
  const productTabs = useRef<Array<HTMLButtonElement | null>>([]);
  const [hotelCheckIn, setHotelCheckIn] = useState(today);
  const [hotelCheckOut, setHotelCheckOut] = useState(offsetLocalCalendarDate(today, 1));
  const active = PRODUCTS.find((product) => product.value === activeProduct) ?? PRODUCTS[0];
  const updateCheckIn = (nextCheckIn: string) => {
    if (!nextCheckIn) return;
    setHotelCheckIn(nextCheckIn);
    if (hotelCheckOut <= nextCheckIn) {
      setHotelCheckOut(offsetLocalCalendarDate(nextCheckIn, 1));
    }
  };

  return (
    <div className="home-booking-widget">
      <div aria-label="Choose a booking type" className="home-booking-widget__tabs" role="tablist">
        {PRODUCTS.map((product, index) => (
          <button
            aria-controls="home-booking-panel"
            aria-selected={activeProduct === product.value}
            className={activeProduct === product.value ? 'is-active' : undefined}
            id={`home-product-${product.value}`}
            key={product.value}
            onClick={() => setActiveProduct(product.value)}
            onKeyDown={(event) => {
              const nextIndex =
                event.key === 'ArrowRight'
                  ? (index + 1) % PRODUCTS.length
                  : event.key === 'ArrowLeft'
                    ? (index + PRODUCTS.length - 1) % PRODUCTS.length
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? PRODUCTS.length - 1
                        : undefined;
              if (nextIndex === undefined) return;
              event.preventDefault();
              setActiveProduct(PRODUCTS[nextIndex].value);
              productTabs.current[nextIndex]?.focus();
            }}
            ref={(button) => {
              productTabs.current[index] = button;
            }}
            role="tab"
            tabIndex={activeProduct === product.value ? 0 : -1}
            type="button"
          >
            <ProductIcon product={product.value} />
            <span>{product.label}</span>
            {!product.available ? <small>Coming soon</small> : null}
          </button>
        ))}
      </div>

      {active.available ? (
        <form
          action={active.href}
          aria-labelledby={`home-product-${activeProduct}`}
          className="home-booking-widget__form"
          id="home-booking-panel"
          key={activeProduct}
          role="tabpanel"
        >
          {activeProduct === 'hotels' ? (
            <>
              <Field
                label="Where are you going?"
                name="destination"
                placeholder="City, area, or hotel"
                autoComplete="off"
                list="travel-destination-suggestions"
              />
              <Field
                label="Check-in"
                min={today}
                name="checkInDate"
                onChange={(event) => updateCheckIn(event.target.value)}
                onInput={(event) => updateCheckIn(event.currentTarget.value)}
                type="date"
                value={hotelCheckIn}
              />
              <Field
                label="Check-out"
                min={offsetLocalCalendarDate(hotelCheckIn, 1)}
                name="checkOutDate"
                onChange={(event) => setHotelCheckOut(event.target.value)}
                onInput={(event) => setHotelCheckOut(event.currentTarget.value)}
                type="date"
                value={hotelCheckOut}
              />
              <label className="home-booking-widget__field">
                <span>Guests</span>
                <select defaultValue="2" name="adults">
                  <option value="1">1 guest</option>
                  <option value="2">2 guests</option>
                  <option value="3">3 guests</option>
                  <option value="4">4 guests</option>
                </select>
              </label>
              <datalist id="travel-destination-suggestions">
                {['Bir Billing', 'Mandi', 'Manali', 'Shimla', 'Dharamshala'].map((place) => (
                  <option key={place} value={place} />
                ))}
              </datalist>
              <input name="children" type="hidden" value="0" />
              <input name="rooms" type="hidden" value="1" />
            </>
          ) : null}

          <button className="home-booking-widget__submit" type="submit">
            Search {active.label.toLowerCase()}
            <span aria-hidden="true">→</span>
          </button>
        </form>
      ) : (
        <div
          aria-labelledby={`home-product-${activeProduct}`}
          className="home-booking-widget__coming-soon"
          id="home-booking-panel"
          key={activeProduct}
          role="tabpanel"
        >
          <div>
            <strong>{active.label} are coming soon</strong>
            <p>
              We’re getting this service ready. You can search hotel stays now, or contact our team
              for updates on new travel services.
            </p>
          </div>
          <a href="/contact">Ask to be notified</a>
        </div>
      )}

      <div className="home-booking-widget__benefits" aria-label="Booking benefits">
        <span>Secure booking journey</span>
        <span>Clear prices</span>
        <span>Room details</span>
        <span>Human support</span>
      </div>
    </div>
  );
}
