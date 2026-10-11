# Mandyal Travels Project Status

Current OTA extraction review: 10 October 2026. This checkout is the independent
ForNextGen Travel OTA project. The older combined-platform status below is historical,
and does not mean PMS operational screens are part of this checkout. See
`docs/OTA_RELEASE_STATUS_2026-10-10.txt` for current checks and remaining release gates.
The live domain is unchanged; this review does not authorize deployment or payment activation.
The broader audit and remediation record is `docs/OTA_AUDIT_2026-10-10.txt`, including
pricing, cancellation/refund, dependency and indexing fixes and remaining release gates.

Last reviewed: 7 September 2026

The current launch-gate register is maintained in
[`docs/RAILWAY_PRODUCTION_STATUS_2026-09-07.md`](docs/RAILWAY_PRODUCTION_STATUS_2026-09-07.md).

This document separates the working portal from items that require approved production providers,
credentials, or commercial rules. The Master Blueprint remains the product source of truth.

## Working portal scope

### Customer travel

- Customer registration, sign-in, sign-out, secure browser sessions, active-session review and
  other-device revocation, profile editing, password changes, and provider-neutral forgotten-password
  recovery with hashed 30-minute single-use tokens and full session revocation
- Persistent booking-email, SMS-alert, WhatsApp-update, and marketing preferences
- Hotel, flight, bus, and car search and booking demonstrations
- Provider-neutral Flight search validation now enforces IATA-style airport codes, travel dates,
  bounded passenger counts, route/cabin/date matching, seat sufficiency, positive prices, valid
  segment timing, and continuous connections before supplier offers can enter checkout
- Versioned, no-store Flight offer search and revalidation APIs expose the same governed service
  boundary to future web, Android, iOS, B2B, and corporate clients
- Personal Flight, Bus, and Car checkout now revalidates the selected inventory, travel dates,
  promotion, and final total on the server and fails safely when persistence is unavailable; the
  browser can no longer show a successful confirmation for an unsaved trip
- Flight booking persistence validates the exact adult count, bounded passenger names, supported
  gender values, email address, and normalized phone length at the API boundary
- Flight offers distinguish outbound and return legs, reject incomplete or wrong-date round trips,
  and display both legs before selection; the fixture adapter includes a revalidatable round-trip
  example without pretending to provide live airline inventory
- Flight multi-city search carries two or three chronological, continuous journeys through typed
  criteria, supplier normalization, booking, checkout, and itinerary documents; a clearly identified
  fixture itinerary supports safe local revalidation without implying live airline inventory
- Flight discovery supports bounded airline, refundable-fare, and maximum-total filters plus stable
  price, total-duration, and departure-time sorting without weakening server-side offer validation
- Provider-neutral Bus validation rejects wrong-date, wrong-route, over-capacity, malformed-timing,
  invalid-rating, and non-positive-price offers while normalizing bounded amenity data; personal
  Bus checkout also fails safely if its server-side booking cannot be saved
- Bus discovery adds governed operator, bus-type, refundable-only, maximum-fare, price, duration,
  departure, and rating controls without weakening supplier revalidation.
- Versioned, no-store Bus offer search and revalidation APIs reuse that supplier boundary for
  future mobile, partner, B2B, and corporate clients
- Bus checkout validates the exact passenger roster, booking contact, and a unique seat assignment
  for every traveller at the server boundary instead of trusting browser session data
- Car search and revalidation now enforce bounded locations, drivers and rental length, validate
  provider inventory/capacity/pricing, normalize feature data, and expose versioned no-store APIs
  shared by direct partner and future external supplier inventory
- Car checkout validates the primary driver's age, name, driving licence, email, and phone again at
  the server boundary before any personal or approved-company trip can be confirmed
- Car discovery and checkout distinguish self-drive from chauffeur service end to end; self-drive
  retains licence and age validation while chauffeur bookings require a bounded lead-traveller contact
- Car pickup and drop-off times are validated and carried through revalidation, billed-duration
  calculation, checkout, confirmations, and vouchers rather than being reduced to date-only rentals
- Hotel availability results with typed star/amenity/refundability filters, price/rating sorting,
  and bounded pagination
- Provider-ready natural-language hotel discovery with explicit explanations and inventory-backed
  availability and pricing safeguards
- An explainable, provider-neutral trip planner creates bounded, editable day-by-day suggestions
  from origin, destination, dates, travellers, and interests, then links customers into the real
  Hotel, Bus, Car, and optional Flight search journeys for live inventory and final-price checks
- Trip-planning guidance is explicitly labelled as a recommendation rather than an availability,
  price, or booking promise; impossible dates, past travel, excessive trip lengths, invalid party
  sizes, and unsafe airport combinations are rejected at the versioned API boundary
- Promotion validation, protected demonstration payment forms, confirmation documents, and unified
  customer travel history
- Flight, Bus, and Car confirmations, tickets, itineraries, and vouchers require the signed-in
  customer to own the matching persisted trip; URL parameters alone cannot unlock documents
- Customer hotel cancellation/amendment handling and account-bound booking access
- Verified-stay hotel reviews restricted to signed-in customers with a completed confirmed booking
- Protected hotel-review moderation with rejection notes, supplier-scoped public responses, and
  partner audit history
- Booking-linked customer support cases with personal status tracking and operations resolution
- Flight, Bus, and Car trip cards open bounded, prefilled booking-owned servicing requests for
  human operations review; submitting a request never changes or cancels a booking or guarantees a
  refund
- Bounded personal JSON archive for profile, preferences, bookings, company requests, and support
  history without passwords, session tokens, or card data
- Platform-admin user and organization directories with bounded search, pagination, and protected
  read-only servicing records for profile, access, travel, support, policy, and audit context
- Protected read-only integration registry covering bounded hotel-channel and flight-supplier
  connections plus notification and outbox posture; credential and account references are reduced
  to configured/missing indicators and provider activation remains external
- Protected read-only flight supplier operation ledger with bounded search, status/environment
  filters, retry posture, correlation trace, and presence-only provider/error evidence; queued health
  operations remain explicitly blocked on contracted provider activation
- Governed administrator notification operations with bounded delivery search, status/channel/time
  filters, complete pagination, stale-lease posture, private recipient correlation, presence-only
  provider/error evidence, and concurrency-safe failed-delivery retry controls
- Human-governed administrator finance workbench with exact payment, discrepancy, and refund totals;
  independent bounded payment/refund pagination; closed-catalogue filters; private provider
  correlation; captured-payment reconciliation enforcement; and state-correct refund retry actions
- Protected administrator document-readiness workbench with bounded Hotel, Flight, Bus, and Car
  records; deterministic confirmation and provisional-receipt posture; unresolved amendment/refund
  exceptions; private references; and an explicit block on unsupported statutory GST documents
- Governed administrator promotion workbench with exact campaign posture, bounded search and
  pagination, authoritative stored-code states, version-safe reason-required activation,
  append-only change history, and concurrency-safe persisted redemption attribution for usage caps,
  including expiry release and provider-confirmed full-refund reversal
- Protected read-only administrator inventory and rate directory with bounded search, 7/30/90-day
  windows, pagination, capacity/rate-plan issue detection, seasonal price posture, and explicit
  stop-sale and restriction visibility without changing partner-owned PMS controls
- Account security activity history for sign-ins, profile/password/preference changes, and session revocation
- Protected read-only administrator security posture with aggregate MFA/session health, 24-hour
  security-event volume, and identifier-free throttling evidence under bounded filters and pagination
- Human-governed administrator risk workbench with bounded status, severity, time-window and search
  filters, full pagination, escalation and aging posture, one-way subject correlation, redacted
  narratives, reviewed history, and no automated adverse action
- Human-governed administrator exception operations with bounded integration history, private
  aggregate/error evidence, version-safe reason-required retry/ignore decisions, append-only review
  events, and exact handoffs for booking amendments, payment discrepancies, refunds, and risk
- Keyboard skip navigation, visible focus indicators, active-page semantics, and responsive primary
  navigation

### Business travel

- Separate organization workspace and personal customer account
- B2B travel-agency workspace with scoped customer profiles, non-destructive activation controls,
  auditable servicing changes, and customer-attributed Hotel, Flight, Bus, and Car requests that
  retain organization policy snapshots and idempotency protection
- Agency-only customer reporting with customer, product, status, travel-date, and search filters;
  paginated records and formula-safe bounded CSV export preserve historical attribution without
  exposing private customer servicing notes
- Approval-gated agency booking controls hand attributed requests into the matching Hotel, Flight,
  Bus, or Car journey; request and approval screens identify the actual agency customer, and another
  administrator of the same travel agency may safely service the request without gaining access to
  ordinary company requests
- Organization contact and billing profile, traveller invitations, membership removal, and
  administrator/traveller roles
- Versioned travel policy with approval requirement, default flight cabin, and maximum trip amount
- Company travel requests with policy snapshots, retry protection, approval/rejection decisions,
  reviewer notes, and immutable audit history
- Approved-request checkout safeguards for hotel, flight, bus, and car bookings; rejected or pending
  requests cannot be used to create a company booking
- Company reporting, CSV export, booking statements, full request history, team access history, audit
  export, and organization support cases

### Partner and operational foundation

- Separately provisioned, read-only platform operations console with an executive activity snapshot,
  quick navigation, and customer, organization, session, booking, company approval, support, and
  hotel amendment oversight
- Accurate full-account servicing totals, direct user-to-organization navigation, queue shortcuts,
  a visible security-control posture, and a prefilled bounded reporting window
- Platform-admin operational analytics with explicit 30-day conversion, hotel cancellation, and
  checkout-capture denominators plus current supplier activation, approved hotel publication,
  support-load, and unresolved high-severity risk indicators
- Platform support-case close/reopen servicing with organization audit entries for every state
  change
- Platform hotel review moderation with exact pending/published/rejected counts, closed filters,
  bounded pagination, privacy-safe reviewer references, reasoned rejection controls, and immutable
  decided-history visibility. Public hotel rating totals aggregate every published review while the
  narrative list remains capped for responsive delivery.
- Customer support servicing with required resolution notes and append-only case events
- Dedicated platform support workbench with separate customer and company queues, bounded
  multi-field search, status filters, oldest-open ordering, complete pagination, account links, and
  the existing audited human resolution actions; no AI provider or automated decision is implied
- Closed-catalogue platform feature controls for guided trip planning and new partner applications;
  administrator changes require bounded reasons, optimistic versions, and append-only history, and
  both page and API entry points enforce the resulting state
- Read-only platform booking directory across Hotel, Flight, Bus, and Car records with bounded
  reference/traveller search, product/status/date filters, accurate filtered totals, customer
  servicing links, independent pagination, and explicit empty states
- Read-only administrator hotel supply catalog with bounded property/supplier/destination search,
  approval/publication/source/content filters, internal-only PMS versus external API provenance,
  deterministic content-readiness checks, and links to existing human review controls
- Governed destination content workflow with private drafts, completeness-gated human publication,
  optimistic versions, reason-required append-only history, bounded administration, and responsive
  public destination guides that route customers into inventory-backed search and trip planning
- Protected read-only administrator audit workbench combining platform configuration, destination
  content, promotion governance, partner-settlement decisions, integration-exception reviews,
  supplier, organization, customer-support, privacy-review, and account-security records with
  closed-domain filters, bounded search and date ranges, exact merged timeline pagination, private
  operational references, and explicit deep-history limits; it exposes no operational, inventory,
  payment, refund, or reconciliation mutation
- Privacy operations queue for customer access, correction, deletion, and restriction requests with
  30-day targets, overdue visibility, bounded filters and pagination, required human review notes,
  optimistic versions, immutable events, customer status visibility, and no automatic data deletion
- Platform-admin operational travel CSV across hotel, flight, bus, and car records with date filters
  and bounded export size
- Admin-approved supplier onboarding with named sign-in and a scoped operations workspace
- Supplier-managed hotel properties, room types, rates, amenities, publication controls, dated
  availability and stop-sell controls connected to public hotel search and booking
- Expanded hotel property profiles covering type, contacts, map coordinates, timezone, languages,
  landmarks, guest eligibility, house rules, and multi-image galleries
- Structured hotel destination hierarchy covering locality, town or city, tehsil, district, state,
  searchable aliases, landmarks, and safe editing of already-published property locations; public
  and AI-assisted hotel discovery use the same expanded destination vocabulary
- Governed, categorized property and room amenity checklists with standardized supplier selections,
  duplicate normalization, responsive controls, and the same catalogue powering customer filters
- Editable supplier room definitions and normalized multi-rate-plan management with meal plans,
  refundable policies, taxes, and enforced minimum/maximum stay restrictions; the additive
  migration backfills every existing room without changing its public rate-plan identifier
- Structured free-cancellation cutoffs on supplier rates, validated from 0 to 720 hours and used by
  customer refund-eligibility decisions
- Refund cutoffs anchored to each property's configured check-in time and IANA timezone rather than
  UTC midnight, with invalid timezone data failing closed
- Date-level Hotel PMS controls for seasonal pricing, availability limits, stop-sell,
  closed-to-arrival, closed-to-departure, and minimum/maximum stays, enforced by customer search
  and booking quote validation
- Supplier-managed car fleets with vehicle pricing and dated availability controls
- Audited car maintenance records with category, vendor, cost, status, history, and automatic stop-sales for active service dates
- Bus operator onboarding and a scoped route/trip workspace with governed schedules, seat capacity, fares, amenities, refundability, and cancellation terms
- Booking dashboards, hotel amendment review, and append-only partner activity history
- Guarded hotel stay operations for check-in, check-out, and no-show handling with append-only
  supplier audit entries
- Property-timezone-aware arrival guards prevent future stays from being checked in or marked as
  no-shows, and prevent check-in after the scheduled stay has ended
- Persisted physical room assignments required at check-in, validated against booked quantity and
  overlapping checked-in stays, displayed to front-desk users, audited, and included in exports
- Supplier-owned physical room registry with room-type inventory caps, unique room numbers,
  ready/dirty/cleaning and active/out-of-service controls, audited changes, ready-room enforcement
  at check-in, and automatic dirty status after checkout
- Front-desk room allocation loads only registered, active, housekeeping-ready rooms for the booked
  room type, excludes rooms occupied by active stays, and requires exact checkbox selection before check-in
- A dedicated supplier housekeeping board summarizes ready, dirty, cleaning, and out-of-service rooms
  across managed properties and uses the existing scoped, audited room-status workflow
- Supplier-private front-desk booking notes with bounded content, partner scoping, and append-only
  audit records; notes remain excluded from customer records and operational CSV exports
- Guest special requests captured before payment, persisted with the lead guest, shown on customer
  confirmation and supplier booking operations, and explicitly presented as non-guaranteed preferences
- Persistent PMS navigation with a live operational dashboard, seven-day room rack, direct walk-in
  booking, minimized guest registration, and booking-linked billing workspace
- Property-scoped restaurant outlet, dining-table and priced menu catalogue with bounded records,
  retry-safe creation, optimistic lifecycle controls, immutable history, conflict-protected
  half-hour reservations, capacity enforcement, controlled slot release, and explicit reuse of the
  existing POS, kitchen and append-only guest-folio workflows
- Booking-owned append-only hotel folios that derive the accommodation charge and captured online
  payment from existing records, support incidental charges and partial at-property payments, require
  administrator cashier shifts, reconcile cash exactly, audit every mutation, use reversals for
  corrections, and prevent checkout with a positive balance
- Platform property review workflow for supplier-created listings with pending, approved, and
  rejected states, correction notes, administrator decisions, audit history, and approval-gated search publication
- Consolidated administrator property-review queue with oldest-first ordering, submission context,
  active-room counts, and direct navigation to the exact supplier listing decision controls
- Formula-safe supplier booking CSV exports that honor active dashboard filters and reject result
  sets above the bounded 1,000-record operational limit instead of silently truncating records
- Server-side supplier booking search and booking/stay-status filters with matching scoped totals,
  captured-value summaries, and pagination
- Validated arrival-window filters for front-desk arrival lists, combinable with booking search and
  operational status filters
- Integration-key compatibility for approved server-to-server partner operations without exposing a
  shared key in browser forms
- Integration-key requests require a validated active supplier identifier; an integration key alone
  cannot enumerate cross-supplier bookings, properties, inventory, amendments, reviews, or exports
- Supplier-scoped activity history with server-side action, record-type, and text filters, bounded
  pagination, actor attribution, and immutable operational audit records
- Arrival-based supplier performance reports with bounded periods and exact booking, captured-value,
  room-night, cancellation, no-show, check-out, average-value, and per-property rollups
- Quote, availability-lock, booking, guest, payment-transaction, inventory-override, and amendment
  persistence
- Pagination and bounded query sizes for operational lists
- Explicit row limits for company travel, statement, and audit CSV exports with filter guidance when
  a report is too large
- Health/readiness endpoint at `/api/v1/health` verifies database access and core customer,
  organization, booking, and company-request schema availability, plus pending and dead-letter
  integration-event health
- Provider-neutral standalone container packaging with a non-root runtime, a separate migration
  task, process liveness at `/api/v1/health/live`, database readiness at `/api/v1/health`, secret-free
  build context, and a guarded one-replica SQLite preview for deployment rehearsals
- Transactional hotel-booking integration outbox with deduplication, a separately authenticated
  one-shot worker, database leases, exact provider acknowledgements, bounded exponential retry,
  dead-letter handling, and numeric administrator run evidence
- A disabled-by-default Hotelbeds static-content cache with authenticated scheduled batches,
  resumable 1,000-property pagination, daily differential refreshes, correlation evidence, and no
  connection to customer search, availability, booking, cancellation, or payments
- Automated Hotel domain regression tests for PMS restrictions, seasonal rates, property approval,
  stay timing, physical-room assignment, housekeeping readiness, and integration retries
- On-demand SQLite backups with SHA-256 sidecars for local development, plus Railway PostgreSQL
  point-in-time recovery, daily/weekly/monthly volume backups, and a completed post-migration backup
- Safe Windows start and update helpers with automatic pre-update database backups
- Automated clean-database migration and foreign-key integrity verification in the release quality
  gate
- Deterministic PostgreSQL schema materialization with a reviewable 110-table native baseline, Prisma
  Client generation, and CI drift detection that requires no provider credentials or live connection

### Security and reliability controls

- Versioned legal and policy center covering privacy, terms, cancellation and refunds, and cookies,
  with an explicit draft-approval state and marketing consent tied to the applicable privacy version
- Password hashing, server-side sessions, secure cookie settings, login/register/recovery throttling,
  account-neutral reset responses, account-scoped active-session controls, and session revocation
  after a password change or reset
- Content-security policy, anti-framing, content-type, referrer, permissions, and production HTTPS
  response headers
- Self-contained system font stack so production builds do not depend on Google Fonts availability
- Same-origin enforcement for authenticated API mutations to protect account and booking actions
  from cross-site requests
- Authorization checks at customer, organization, administrator, and partner API boundaries,
  including property-level filtering for supplier booking, inventory, and amendment operations
- Bounded JSON bodies and server-side validation for booking, policy, member, support, and account
  mutations
- Idempotency/retry safeguards for travel requests and booking completion
- No raw payment-card data is persisted
- Production startup rejects missing, placeholder, shared, or short application secrets

## Production integrations still required

These are not safely implementable with invented values. They require provider accounts, approved
credentials, contracts, or signed-off business rules:

1. Live payment authorization, capture, refund, reconciliation, and webhook processing
2. Live hotel, airline, bus, and car supplier APIs with production inventory and ticketing
3. Transactional email, SMS, and WhatsApp delivery providers
4. Statutory GST tax invoices, tax component rules, credit notes, and invoice numbering
5. Contracted corporate pricing, partner commission, markup, settlement, and refund rules
6. Production monitoring/alerting, high-availability capacity review, restore drills, and
   activation/scheduling of the prepared integration-outbox worker against an approved supplier
   gateway
7. Operational legal-policy drafts now exist in the portal; independent legal approval and final
   jurisdiction-specific wording are still required before launch.

The current company statements intentionally identify themselves as reporting statements, not GST
tax invoices.

Railway now hosts the application and migrated PostgreSQL data behind the canonical custom domain.
The transfer was reconciled, the live schema and sole-administrator invariant were verified, and
point-in-time recovery plus scheduled backups are active. SQLite remains local-development-only.
Remaining production gates are listed in `docs/RAILWAY_PRODUCTION_STATUS_2026-09-07.md`.

## Release procedure

1. Run `npm run db:backup` and copy the backup plus checksum to approved encrypted storage.
2. Run `UPDATE-PORTAL.cmd`. Never approve a Prisma data-loss warning without review.
3. Run `npm run check`.
4. Run `npm run release:verify-env` with the production environment loaded.
5. Start the portal with `START-PORTAL.cmd`.
6. Confirm `/api/v1/health` reports ready and has no unexplained dead-letter events.
7. Smoke-test one customer journey and one company approval-to-booking journey.

## Current quality gate

Hotel search-projection rebuilds are transactional and source-complete. They retain tehsil and alias
vocabulary on both initial and repeated projection, isolate malformed optional metadata, restrict facets
to normalized strings, and remove stale hotel documents after a property is unpublished or deactivated
without touching other projection types. Live availability and pricing remain relational source-of-truth
checks.

Search-projection maintenance is prepared as an authenticated one-shot autopilot job with a database
lease, replay-safe correlation evidence, healthy-state no-ops, and a hard source-count safety boundary.
It can repair only disposable public search documents and cannot mutate inventory, rates, bookings,
payments, refunds, settlements, or payouts. Production scheduling and alerts remain infrastructure-owned.

Successful isolated PostgreSQL restore rehearsals can now report fresh, fingerprint-verified,
replay-safe recovery evidence to the administrator autopilot console. Only safe aggregate validation
counts are retained. Railway PITR and scheduled retention are active; restore-drill evidence,
alerting, and named incident ownership remain operational requirements. The portal never creates or
restores a backup and never targets the active database.

Partner settlement governance now holds bookings with unresolved refund reservations out of payout
calculation, rejects inactive suppliers, and records draft, approval, and paid transitions in an
append-only history. Version-checked updates prevent stale or duplicate finance actions, payment
references are masked in portal views, and administrator and supplier statement screens are bounded
and paginated. The workflow remains provider-neutral and does not release money automatically.

Supplier payout destinations now have a bounded administrator workbench and a masked supplier view.
Only provider-tokenized references and final-four display data are stored; import and review remain
disabled behind a dedicated feature gate. Administrator verification or rejection requires a reason
and exact record version, replacing a default destination is atomic, and every import, decision, and
supersession is append-only audited. No raw bank account, UPI credential, PIN, or OTP is collected.

Seasonal pricing is rate-plan-specific: room-only, breakfast, and other plans retain independent
daily prices across search and booking quotes, while availability and stay restrictions remain
room-scoped. The additive `PartnerRatePlanInventoryDay` model keeps those overrides normalized and
supplier-scoped.

Front-desk stay transitions are evaluated using the property's configured timezone. Future arrivals
cannot be checked in or marked as no-shows, and an expired stay cannot be checked in.

Managed properties can register their physical rooms and operate a basic housekeeping lifecycle.
When a room type has registered rooms, check-in accepts only registered rooms that are ready and in
service; checkout marks the assigned rooms dirty for housekeeping follow-up.

Hotel partners have bounded, date-filtered occupancy decision support based only on their declared
room capacity, calendar limits, stop-sales, and confirmed non-no-show stays. It reports booked and
calendar-open room nights, flags over-capacity data for reconciliation, and gives deterministic
human-review guidance without automatically changing rates, restrictions, or inventory or claiming
to be an activated AI model.

Booking operations include a private supplier note for arrival preferences, accessibility support,
and shift handovers. Every note change is scoped to the assigned supplier and recorded in activity
history without copying the note text into audit metadata.

Guests can submit bounded accessibility, dietary, arrival, and room-preference requests before
payment. The request is persisted with the booking and handed to the assigned property while the UI
clearly states that fulfilment depends on availability.

Supplier-created properties enter a platform review queue after an active room is added. Only an
administrator-approved property can publish to hotel search; rejected listings remain private with
correction guidance and an attributable review trail, while the additive migration preserves
existing published inventory as approved. Platform administrators can also correct the complete
customer-facing property and vehicle profile from the supplier record. Every administrator edit is
protected from stale overwrites, re-runs listing risk rules, creates an audit event in the same
transaction, and returns the listing to draft/pending review before it can be public again.
Administrator archive is reversible without deleting historical records. A reason and exact record
version are required to restore a property or vehicle, and restoration always produces an audit
event and a private draft/pending-review state rather than republishing the listing.
All administrator approve, reject, pause, archive, and restore decisions require the exact listing
version shown to the reviewer. The state change and audit event commit together, so a concurrent
supplier or administrator update cannot be silently overwritten by a stale decision.

Supplier agreements now have an administrator-only immutable draft and release workflow. Exact
agreement text is normalized and SHA-256 hashed on the server; approval requires the current
governance version, an exact typed confirmation, a decision reason, and a recorded counsel-approval
reference. A single release pointer governs the acceptable version, approving a replacement
atomically supersedes the previous release, and each lifecycle decision is append-only audited.
This operational control does not replace counsel review or enable paid supplier onboarding.

Direct bus-operator inventory now participates in customer search alongside the bounded fixture
adapter. Search subtracts confirmed reservations from seat capacity, supports overnight arrivals,
and exposes only active routes, trips, and partners. Booking completion reserves the customer's
exact seat selection transactionally, rejects seats outside the operator's declared capacity, and
prevents already-occupied seats from being sold again. Both the supplier interface and versioned
partner API reject services scheduled before the current operating date.

Bus operator administrators can pause and restore dated services, revise bounded seat capacity and
fares, and cannot reduce capacity below confirmed passengers or their assigned seat positions. A
route-level audited stop-sale can pause or restore every dated service on a corridor without
deleting its schedule or historical reservations. A
partner-scoped passenger manifest provides bounded pagination, search, routes, service times, exact
seat assignments, captured-value summaries, and a formula-safe CSV export capped at 1,000 records
without exposing another operator's reservations.

Bus operators have bounded service-date performance reports with reservation, passenger,
confirmed-value, trip, route, and per-route rollups. Reports are scoped to the authenticated
operator and refuse oversized periods rather than returning incomplete operational totals.

Car suppliers can export their scoped reservation register as a formula-safe CSV capped at 1,000
records, including driver or lead traveller, vehicle, registration, route, rental dates, units, and
captured value without exposing another fleet partner's reservations.

Car supplier administrators can maintain audited registration/RC, insurance, commercial permit,
fitness-certificate, and pollution-certificate expiry dates. The fleet workspace classifies each
vehicle as incomplete, expired, expiring within 30 days, or complete while preserving existing
fleet records through an additive migration.

Vehicle lifecycle controls let Car supplier administrators pause a vehicle from customer search
without deleting inventory or reservations. Restoration is audited and requires a registration
number plus complete, non-expired compliance dates, preventing non-compliant vehicles from
returning to sale.

Car partners have bounded pickup-date performance reports with reservation, confirmed-value,
rental-day, average-value, vehicle-utilization, and per-vehicle rollups. Every query is scoped to
the authenticated fleet partner and refuses unbounded result sets rather than returning partial
financial totals.

Car rental operations support audited pickup, completion, and no-show transitions. Server-side
date guards prevent early pickup, future no-shows, expired-period pickup, and invalid state jumps;
cancellation and refund decisions remain outside this lifecycle until approved commercial rules
and a payment provider are connected. Picked-up rentals continue consuming dated fleet capacity
until completion, and completed rentals remain included in confirmed-value performance totals.

The current travel-domain milestone passes 643 regression tests, formatting verification, Prisma
Client generation, strict TypeScript, ESLint, a Next.js production build including authenticated
internal worker routes, clean-database verification of all 95 SQLite migrations with foreign-key
integrity enabled, a synchronized 113-table PostgreSQL-native baseline, the portable deployment
contract, a 228-route production build, and live Railway smoke/accessibility/link/load checks.
Provider integration work must preserve those checks and add provider-specific automated tests
before going live.
