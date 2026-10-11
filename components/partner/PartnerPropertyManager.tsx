'use client';

import Link from 'next/link';
import { useCallback, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { AmenityChecklist } from '@/components/partner/AmenityChecklist';
import { propertyAmenityGroups, roomAmenityGroups } from '@/constants/hotelAmenities';
import { readJsonResponse } from '@/lib/api/clientResponse';
import type { ApiErrorResponse } from '@/types/commerce';

const DIRECT_IMAGE_URL_HELP =
  'Paste a direct public HTTPS image URL from images.unsplash.com. Google search pages, ordinary webpages, Drive sharing links, local files, and video links are not accepted.';
const MEDIA_UPLOAD_HELP =
  'Photos only for now. Secure photo and video uploads will be enabled after a media-storage provider is connected.';

type RatePlan = {
  cancellationDescription: string;
  freeCancellationHours: number;
  id: string;
  maximumStayNights: number;
  mealPlan: string;
  minimumStayNights: number;
  name: string;
  nightlyRate: number;
  ratePlanId: string;
  refundable: boolean;
  status: string;
  taxesAndFees: number;
};

type RoomType = {
  amenitiesJson: string;
  bedDescription: string;
  description: string;
  id: string;
  inventoryCount: number;
  imageUrl: string;
  maximumAdults: number;
  maximumChildren: number;
  maximumGuests: number;
  mealPlan: string;
  name: string;
  nightlyRate: number;
  ratePlanName: string;
  ratePlans: RatePlan[];
  roomTypeId: string;
  status: string;
  taxesAndFees: number;
};

export type ManagedProperty = {
  approvalNote: string;
  approvalStatus: string;
  amenitiesJson: string;
  checkInTime: string;
  checkOutTime: string;
  city: string;
  contactEmail: string;
  contactPhone: string;
  childrenAllowed: boolean;
  description: string;
  district: string;
  displayName: string;
  hotelSlug: string;
  imageUrl: string;
  imageUrlsJson: string;
  languagesJson: string;
  landmarksJson: string;
  id: string;
  locality: string;
  locationAliasesJson: string;
  minimumCheckInAge: number;
  petsAllowed: boolean;
  policiesJson: string;
  publicationStatus: string;
  propertyType: string;
  rooms: RoomType[];
  starRating: number;
  state: string;
  smokingAllowed: boolean;
  tehsil: string;
};

function messageFrom(result: { data?: unknown } | ApiErrorResponse | null, fallback: string) {
  return result && 'error' in result ? result.error.message : fallback;
}

function stringListFromJson(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

export function PartnerPropertyManager({
  canManage,
  initialProperties,
}: {
  canManage: boolean;
  initialProperties: ManagedProperty[];
}) {
  const [properties, setProperties] = useState<ManagedProperty[]>(initialProperties);
  const [activeRoomForm, setActiveRoomForm] = useState<string>();
  const [activeLocationForm, setActiveLocationForm] = useState<string>();
  const [activeRatePlanRoom, setActiveRatePlanRoom] = useState<string>();
  const [activeRoomEditor, setActiveRoomEditor] = useState<string>();
  const [activeRateEditor, setActiveRateEditor] = useState<string>();
  const [activeProfileForm, setActiveProfileForm] = useState<string>();
  const [activeContentForm, setActiveContentForm] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();

  const loadProperties = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/partner/properties');
      const result = await readJsonResponse<{ data: ManagedProperty[] } | ApiErrorResponse>(
        response,
      );
      if (!response.ok || !result || !('data' in result)) {
        setError(messageFrom(result, 'Properties could not be loaded.'));
        return;
      }
      setProperties(result.data);
    } catch {
      setError('The property service could not be reached.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  async function createProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const data = {
      ...Object.fromEntries(formData),
      amenities: formData.getAll('amenities').map(String).join(','),
      childrenAllowed: formData.get('childrenAllowed') === 'on',
      petsAllowed: formData.get('petsAllowed') === 'on',
      smokingAllowed: formData.get('smokingAllowed') === 'on',
    };
    setError(undefined);
    setSuccess(undefined);
    setIsSaving(true);
    try {
      const response = await fetch('/api/v1/partner/properties', {
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const result = await readJsonResponse<{ data: ManagedProperty } | ApiErrorResponse>(response);
      if (!response.ok || !result || !('data' in result)) {
        setError(messageFrom(result, 'The property could not be added.'));
        return;
      }
      form.reset();
      setActiveRoomForm(result.data.id);
      setSuccess(
        `${result.data.displayName} was saved as a draft. Add its first room to publish it.`,
      );
      await loadProperties();
    } catch {
      setError('The property service could not be reached.');
    } finally {
      setIsSaving(false);
    }
  }

  async function createRoom(event: FormEvent<HTMLFormElement>, property: ManagedProperty) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const data = {
      ...Object.fromEntries(formData),
      amenities: formData.getAll('amenities').map(String).join(','),
    };
    setError(undefined);
    setSuccess(undefined);
    setIsSaving(true);
    try {
      const response = await fetch(`/api/v1/partner/properties/${property.id}/rooms`, {
        body: JSON.stringify({ ...data, refundable: formData.get('refundable') === 'on' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const result = await readJsonResponse<{ data: RoomType } | ApiErrorResponse>(response);
      if (!response.ok || !result || !('data' in result)) {
        setError(messageFrom(result, 'The room type could not be added.'));
        return;
      }
      form.reset();
      setActiveRoomForm(undefined);
      setSuccess(
        property.approvalStatus === 'APPROVED'
          ? `${result.data.name} was added. ${property.displayName} is now visible in hotel search.`
          : `${result.data.name} was added. ${property.displayName} was submitted for platform review.`,
      );
      await loadProperties();
    } catch {
      setError('The room service could not be reached.');
    } finally {
      setIsSaving(false);
    }
  }

  async function changePublication(property: ManagedProperty) {
    const action =
      property.publicationStatus === 'PUBLISHED'
        ? 'PAUSE'
        : property.approvalStatus === 'APPROVED'
          ? 'PUBLISH'
          : 'SUBMIT_REVIEW';
    setError(undefined);
    setSuccess(undefined);
    setIsSaving(true);
    try {
      const response = await fetch(`/api/v1/partner/properties/${property.id}`, {
        body: JSON.stringify({ action }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      });
      const result = await readJsonResponse<{ data: ManagedProperty } | ApiErrorResponse>(response);
      if (!response.ok || !result || !('data' in result)) {
        setError(messageFrom(result, 'The publication status could not be updated.'));
        return;
      }
      setSuccess(
        action === 'SUBMIT_REVIEW'
          ? `${property.displayName} was submitted for platform review.`
          : action === 'PUBLISH'
            ? `${property.displayName} is now visible in hotel search.`
            : `${property.displayName} has been paused from new sales.`,
      );
      await loadProperties();
    } catch {
      setError('The property service could not be reached.');
    } finally {
      setIsSaving(false);
    }
  }

  async function createRatePlan(
    event: FormEvent<HTMLFormElement>,
    property: ManagedProperty,
    room: RoomType,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setError(undefined);
    setSuccess(undefined);
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/v1/partner/properties/${property.id}/rooms/${room.id}/rate-plans`,
        {
          body: JSON.stringify({
            ...Object.fromEntries(formData),
            refundable: formData.get('refundable') === 'on',
          }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        },
      );
      const result = await readJsonResponse<{ data: RatePlan } | ApiErrorResponse>(response);
      if (!response.ok || !result || !('data' in result)) {
        setError(messageFrom(result, 'The rate plan could not be added.'));
        return;
      }
      form.reset();
      setActiveRatePlanRoom(undefined);
      setSuccess(`${result.data.name} was added to ${room.name}.`);
      await loadProperties();
    } catch {
      setError('The rate service could not be reached.');
    } finally {
      setIsSaving(false);
    }
  }

  async function updateRoom(
    event: FormEvent<HTMLFormElement>,
    property: ManagedProperty,
    room: RoomType,
  ) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(undefined);
    setSuccess(undefined);
    setIsSaving(true);
    try {
      const response = await fetch(`/api/v1/partner/properties/${property.id}/rooms/${room.id}`, {
        body: JSON.stringify({
          ...Object.fromEntries(formData),
          amenities: formData.getAll('amenities').map(String).join(','),
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      });
      const result = await readJsonResponse<{ data: RoomType } | ApiErrorResponse>(response);
      if (!response.ok || !result || !('data' in result)) {
        setError(messageFrom(result, 'The room type could not be updated.'));
        return;
      }
      setActiveRoomEditor(undefined);
      setSuccess(`${result.data.name} was updated.`);
      await loadProperties();
    } catch {
      setError('The room service could not be reached.');
    } finally {
      setIsSaving(false);
    }
  }

  async function changeRoomStatus(property: ManagedProperty, room: RoomType) {
    const action = room.status === 'ACTIVE' ? 'PAUSE' : 'RESTORE';
    setError(undefined);
    setSuccess(undefined);
    setIsSaving(true);
    try {
      const response = await fetch(`/api/v1/partner/properties/${property.id}/rooms/${room.id}`, {
        body: JSON.stringify({ action }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      });
      const result = await readJsonResponse<{ data: RoomType } | ApiErrorResponse>(response);
      if (!response.ok || !result || !('data' in result)) {
        setError(messageFrom(result, 'The room status could not be updated.'));
        return;
      }
      setSuccess(`${room.name} was ${action === 'PAUSE' ? 'paused' : 'restored'}.`);
      await loadProperties();
    } catch {
      setError('The room service could not be reached.');
    } finally {
      setIsSaving(false);
    }
  }

  async function changeRatePlanStatus(property: ManagedProperty, room: RoomType, rate: RatePlan) {
    setError(undefined);
    setSuccess(undefined);
    setIsSaving(true);
    try {
      const action = rate.status === 'ACTIVE' ? 'PAUSE' : 'RESTORE';
      const response = await fetch(
        `/api/v1/partner/properties/${property.id}/rooms/${room.id}/rate-plans/${rate.id}`,
        {
          body: JSON.stringify({ action }),
          headers: { 'Content-Type': 'application/json' },
          method: 'PATCH',
        },
      );
      const result = await readJsonResponse<{ data: RatePlan } | ApiErrorResponse>(response);
      if (!response.ok || !result || !('data' in result)) {
        setError(messageFrom(result, 'The rate plan could not be paused.'));
        return;
      }
      setSuccess(
        `${rate.name} was ${action === 'PAUSE' ? 'paused' : 'restored'}. Existing history was retained.`,
      );
      await loadProperties();
    } catch {
      setError('The rate service could not be reached.');
    } finally {
      setIsSaving(false);
    }
  }

  async function updateRatePlan(
    event: FormEvent<HTMLFormElement>,
    property: ManagedProperty,
    room: RoomType,
    rate: RatePlan,
  ) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(undefined);
    setSuccess(undefined);
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/v1/partner/properties/${property.id}/rooms/${room.id}/rate-plans/${rate.id}`,
        {
          body: JSON.stringify({
            ...Object.fromEntries(formData),
            action: 'UPDATE',
            refundable: formData.get('refundable') === 'on',
          }),
          headers: { 'Content-Type': 'application/json' },
          method: 'PATCH',
        },
      );
      const result = await readJsonResponse<{ data: RatePlan } | ApiErrorResponse>(response);
      if (!response.ok || !result || !('data' in result)) {
        setError(messageFrom(result, 'The rate plan could not be updated.'));
        return;
      }
      setActiveRateEditor(undefined);
      setSuccess(`${result.data.name} was updated.`);
      await loadProperties();
    } catch {
      setError('The rate service could not be reached.');
    } finally {
      setIsSaving(false);
    }
  }

  async function updateLocation(event: FormEvent<HTMLFormElement>, property: ManagedProperty) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setError(undefined);
    setSuccess(undefined);
    setIsSaving(true);
    try {
      const response = await fetch(`/api/v1/partner/properties/${property.id}`, {
        body: JSON.stringify({ ...data, action: 'UPDATE_LOCATION' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      });
      const result = await readJsonResponse<{ data: ManagedProperty } | ApiErrorResponse>(response);
      if (!response.ok || !result || !('data' in result)) {
        setError(messageFrom(result, 'The searchable location could not be updated.'));
        return;
      }
      setActiveLocationForm(undefined);
      setSuccess(
        `${property.displayName} can now be found using its updated locality and aliases.`,
      );
      await loadProperties();
    } catch {
      setError('The property service could not be reached.');
    } finally {
      setIsSaving(false);
    }
  }

  async function updateProfile(event: FormEvent<HTMLFormElement>, property: ManagedProperty) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setError(undefined);
    setSuccess(undefined);
    setIsSaving(true);
    try {
      const response = await fetch(`/api/v1/partner/properties/${property.id}`, {
        body: JSON.stringify({ ...data, action: 'UPDATE_PROFILE' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      });
      const result = await readJsonResponse<{ data: ManagedProperty } | ApiErrorResponse>(response);
      if (!response.ok || !result || !('data' in result)) {
        setError(messageFrom(result, 'The property profile could not be updated.'));
        return;
      }
      setActiveProfileForm(undefined);
      setSuccess(`${result.data.displayName} public profile was updated.`);
      await loadProperties();
    } catch {
      setError('The property service could not be reached.');
    } finally {
      setIsSaving(false);
    }
  }

  async function updateContent(event: FormEvent<HTMLFormElement>, property: ManagedProperty) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const data = {
      ...Object.fromEntries(formData),
      action: 'UPDATE_CONTENT',
      amenities: formData.getAll('amenities').map(String).join(','),
      childrenAllowed: formData.get('childrenAllowed') === 'on',
      petsAllowed: formData.get('petsAllowed') === 'on',
      smokingAllowed: formData.get('smokingAllowed') === 'on',
    };
    setError(undefined);
    setSuccess(undefined);
    setIsSaving(true);
    try {
      const response = await fetch(`/api/v1/partner/properties/${property.id}`, {
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      });
      const result = await readJsonResponse<{ data: ManagedProperty } | ApiErrorResponse>(response);
      if (!response.ok || !result || !('data' in result)) {
        setError(messageFrom(result, 'The property content could not be updated.'));
        return;
      }
      setActiveContentForm(undefined);
      setSuccess(`${property.displayName} amenities, policies, and media were updated.`);
      await loadProperties();
    } catch {
      setError('The property service could not be reached.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="booking-page partner-property-manager">
      <div className="booking-page__container">
        <div className="partner-page__heading">
          <div>
            <p className="hotel-page__eyebrow">Hotel marketplace listings</p>
            <h1>Properties, rooms, and rates</h1>
            <p className="booking-page__intro">
              Create verified accommodation inventory, publish rooms to hotel search, and then
              manage daily availability from the Availability calendar.
            </p>
          </div>
          <div className="manage-booking__document-actions">
            <Link className="ui-button ui-button--secondary" href="/partner">
              Workspace
            </Link>
            <Link className="ui-button ui-button--secondary" href="/partner/inventory">
              Availability calendar
            </Link>
          </div>
        </div>

        {!canManage ? (
          <Card>
            <strong>View-only supplier access</strong>
            <p>Only the named supplier administrator can create properties and room types.</p>
          </Card>
        ) : (
          <Card className="partner-property-manager__setup">
            <div className="booking-confirmation__reference">
              <span>Step 1</span>
              <strong>Create a property</strong>
            </div>
            <p>The property remains private until its first sellable room and rate are added.</p>
            <form className="supplier-form" onSubmit={createProperty}>
              <div className="supplier-form__section-heading">
                <span>01</span>
                <div>
                  <strong>Property identity</strong>
                  <small>Public name, category, classification, and description</small>
                </div>
              </div>
              <div className="supplier-form__grid">
                <Input
                  label="Property name"
                  maxLength={140}
                  minLength={2}
                  name="displayName"
                  required
                />
                <label className="ui-field">
                  <span className="ui-field__label">Property type</span>
                  <select className="ui-input" defaultValue="HOTEL" name="propertyType" required>
                    <option value="HOTEL">Hotel</option>
                    <option value="RESORT">Resort</option>
                    <option value="HOMESTAY">Homestay</option>
                    <option value="GUEST_HOUSE">Guest house</option>
                    <option value="APARTMENT">Serviced apartment</option>
                    <option value="HOSTEL">Hostel</option>
                  </select>
                </label>
                <label className="ui-field">
                  <span className="ui-field__label">Star rating</span>
                  <select className="ui-input" defaultValue="3" name="starRating" required>
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <option key={rating} value={rating}>
                        {rating} star
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="ui-field">
                <span className="ui-field__label">Property description</span>
                <textarea
                  className="ui-input supplier-form__textarea"
                  maxLength={1500}
                  minLength={30}
                  name="description"
                  placeholder="Describe the property, setting, ideal guests, signature experiences, and key selling points."
                  required
                />
              </label>

              <div className="supplier-form__section-heading">
                <span>02</span>
                <div>
                  <strong>Location and map coordinates</strong>
                  <small>Complete address and precise map position used by hotel discovery</small>
                </div>
              </div>
              <div className="supplier-form__grid">
                <Input
                  label="Area / locality"
                  maxLength={100}
                  minLength={2}
                  name="locality"
                  placeholder="Bir Billing, Suja, Old Manali"
                  required
                />
                <Input label="Town / city" maxLength={80} minLength={2} name="city" required />
                <Input label="Tehsil (optional)" maxLength={80} name="tehsil" />
                <Input label="District" maxLength={80} minLength={2} name="district" required />
                <Input label="State" maxLength={80} minLength={2} name="state" required />
                <Input
                  defaultValue="India"
                  label="Country"
                  maxLength={80}
                  name="country"
                  required
                />
                <Input
                  label="Street address"
                  maxLength={240}
                  minLength={5}
                  name="streetAddress"
                  required
                />
                <Input label="Postal code" maxLength={20} name="postalCode" />
                <Input
                  label="Other searchable names (comma separated)"
                  maxLength={300}
                  name="locationAliases"
                  placeholder="Bir, Upper Bir, Billing"
                />
                <Input
                  label="Latitude"
                  max="90"
                  min="-90"
                  name="latitude"
                  placeholder="28.6139"
                  required
                  step="0.000001"
                  type="number"
                />
                <Input
                  label="Longitude"
                  max="180"
                  min="-180"
                  name="longitude"
                  placeholder="77.2090"
                  required
                  step="0.000001"
                  type="number"
                />
                <label className="ui-field">
                  <span className="ui-field__label">Timezone</span>
                  <select className="ui-input" defaultValue="Asia/Kolkata" name="timezone" required>
                    <option value="Asia/Kolkata">India Standard Time (Asia/Kolkata)</option>
                    <option value="Asia/Dubai">Gulf Standard Time (Asia/Dubai)</option>
                    <option value="Europe/London">United Kingdom (Europe/London)</option>
                    <option value="America/New_York">US Eastern (America/New_York)</option>
                  </select>
                </label>
                <label className="ui-field">
                  <span className="ui-field__label">Nearby landmarks (one per line)</span>
                  <textarea
                    className="ui-input supplier-form__compact-textarea"
                    name="landmarks"
                    placeholder={'Railway station - 2 km\nCity Palace - 4 km'}
                  />
                </label>
              </div>

              <div className="supplier-form__section-heading">
                <span>03</span>
                <div>
                  <strong>Property contact and operations</strong>
                  <small>Guest-facing contact, arrival times, languages, and facilities</small>
                </div>
              </div>
              <div className="supplier-form__grid">
                <Input
                  label="Property contact email"
                  maxLength={254}
                  name="contactEmail"
                  required
                  type="email"
                />
                <Input
                  label="Property contact phone"
                  maxLength={30}
                  name="contactPhone"
                  placeholder="+91 98765 43210"
                  required
                  type="tel"
                />
                <Input
                  defaultValue="14:00"
                  label="Check-in time"
                  name="checkInTime"
                  required
                  type="time"
                />
                <Input
                  defaultValue="11:00"
                  label="Check-out time"
                  name="checkOutTime"
                  required
                  type="time"
                />
                <Input
                  label="Languages spoken"
                  name="languages"
                  placeholder="Hindi, English, Punjabi"
                />
              </div>
              <AmenityChecklist
                groups={propertyAmenityGroups}
                legend="Property amenities"
                name="amenities"
              />

              <div className="supplier-form__section-heading">
                <span>04</span>
                <div>
                  <strong>Guest policies</strong>
                  <small>Eligibility and house rules shown before booking</small>
                </div>
              </div>
              <div className="supplier-form__grid">
                <Input
                  defaultValue="18"
                  label="Minimum check-in age"
                  max="30"
                  min="16"
                  name="minimumCheckInAge"
                  required
                  type="number"
                />
                <div className="supplier-form__policy-checks">
                  <label>
                    <input defaultChecked name="childrenAllowed" type="checkbox" /> Children are
                    welcome
                  </label>
                  <label>
                    <input name="petsAllowed" type="checkbox" /> Pets are allowed
                  </label>
                  <label>
                    <input name="smokingAllowed" type="checkbox" /> Smoking areas are available
                  </label>
                </div>
              </div>
              <label className="ui-field">
                <span className="ui-field__label">Guest policies (one per line)</span>
                <textarea
                  className="ui-input supplier-form__textarea"
                  name="policies"
                  placeholder={'Government ID required at check-in\nNo smoking in rooms'}
                />
              </label>
              <div className="supplier-form__section-heading">
                <span>05</span>
                <div>
                  <strong>Property media</strong>
                  <small>{MEDIA_UPLOAD_HELP}</small>
                </div>
              </div>
              <Input
                label="Cover photo URL (optional)"
                name="imageUrl"
                placeholder="Secure images.unsplash.com URL"
                type="url"
              />
              <small>{DIRECT_IMAGE_URL_HELP}</small>
              <label className="ui-field">
                <span className="ui-field__label">
                  Gallery photo URLs (one per line, maximum 12)
                </span>
                <textarea
                  className="ui-input supplier-form__textarea"
                  name="imageUrls"
                  placeholder={'https://images.unsplash.com/...\nhttps://images.unsplash.com/...'}
                />
                <small>{DIRECT_IMAGE_URL_HELP}</small>
              </label>
              <Button fullWidth isLoading={isSaving} type="submit" variant="primary">
                Save draft property
              </Button>
            </form>
          </Card>
        )}

        {error ? (
          <p className="booking-page__payment-error" role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="partner-property-manager__success" role="status">
            {success}
          </p>
        ) : null}

        <section className="partner-property-manager__catalogue">
          <div>
            <p className="hotel-page__eyebrow">Property catalogue</p>
            <h2>{isLoading ? 'Loading properties…' : `${properties.length} properties`}</h2>
          </div>
          {properties.map((property) => (
            <Card className="partner-property-manager__property" key={property.id}>
              <div className="partner-property-manager__property-heading">
                <div>
                  <span
                    className={`partner-property-manager__status partner-property-manager__status--${property.publicationStatus.toLowerCase()}`}
                  >
                    {property.publicationStatus}
                  </span>
                  <h2>{property.displayName}</h2>
                  <p>
                    {property.locality}, {property.district} · {property.starRating} star ·{' '}
                    {property.rooms.length} room types
                  </p>
                  <small>
                    Platform review: {property.approvalStatus.toLowerCase().replaceAll('_', ' ')}
                  </small>
                  {property.approvalNote ? <p>{property.approvalNote}</p> : null}
                </div>
                <div className="manage-booking__document-actions">
                  {property.publicationStatus === 'PUBLISHED' ? (
                    <Link
                      className="ui-button ui-button--secondary"
                      href={`/hotels/${property.hotelSlug}`}
                    >
                      View live listing
                    </Link>
                  ) : null}
                  {canManage ? (
                    <button
                      className="ui-button ui-button--secondary"
                      disabled={isSaving || property.approvalStatus === 'PENDING_REVIEW'}
                      onClick={() => void changePublication(property)}
                      type="button"
                    >
                      {property.publicationStatus === 'PUBLISHED'
                        ? 'Pause sales'
                        : property.approvalStatus === 'APPROVED'
                          ? 'Publish property'
                          : property.approvalStatus === 'PENDING_REVIEW'
                            ? 'Review pending'
                            : 'Submit for review'}
                    </button>
                  ) : null}
                </div>
              </div>
              {canManage ? (
                <button
                  className="home-card__link partner-property-manager__add-room"
                  onClick={() =>
                    setActiveProfileForm(
                      activeProfileForm === property.id ? undefined : property.id,
                    )
                  }
                  type="button"
                >
                  {activeProfileForm === property.id
                    ? 'Close profile editor'
                    : 'Edit property profile'}
                </button>
              ) : null}
              {activeProfileForm === property.id ? (
                <form
                  className="supplier-form partner-property-manager__room-form"
                  onSubmit={(event) => void updateProfile(event, property)}
                >
                  <div className="booking-confirmation__reference">
                    <span>Profile</span>
                    <strong>Public identity and operations</strong>
                  </div>
                  <div className="supplier-form__grid">
                    <Input
                      defaultValue={property.displayName}
                      label="Property name"
                      maxLength={140}
                      minLength={2}
                      name="displayName"
                      required
                    />
                    <label className="ui-field">
                      <span className="ui-field__label">Property type</span>
                      <select
                        className="ui-input"
                        defaultValue={property.propertyType}
                        name="propertyType"
                        required
                      >
                        <option value="HOTEL">Hotel</option>
                        <option value="RESORT">Resort</option>
                        <option value="HOMESTAY">Homestay</option>
                        <option value="GUEST_HOUSE">Guest house</option>
                        <option value="APARTMENT">Serviced apartment</option>
                        <option value="HOSTEL">Hostel</option>
                      </select>
                    </label>
                    <label className="ui-field">
                      <span className="ui-field__label">Star rating</span>
                      <select
                        className="ui-input"
                        defaultValue={property.starRating}
                        name="starRating"
                        required
                      >
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <option key={rating} value={rating}>
                            {rating} star
                          </option>
                        ))}
                      </select>
                    </label>
                    <Input
                      defaultValue={property.contactEmail}
                      label="Guest contact email"
                      maxLength={254}
                      name="contactEmail"
                      required
                      type="email"
                    />
                    <Input
                      defaultValue={property.contactPhone}
                      label="Guest contact phone"
                      maxLength={30}
                      name="contactPhone"
                      required
                      type="tel"
                    />
                    <Input
                      defaultValue={property.checkInTime}
                      label="Check-in time"
                      name="checkInTime"
                      required
                      type="time"
                    />
                    <Input
                      defaultValue={property.checkOutTime}
                      label="Check-out time"
                      name="checkOutTime"
                      required
                      type="time"
                    />
                    <Input
                      defaultValue={property.minimumCheckInAge}
                      label="Minimum check-in age"
                      max={30}
                      min={16}
                      name="minimumCheckInAge"
                      required
                      type="number"
                    />
                  </div>
                  <label className="ui-field">
                    <span className="ui-field__label">Property description</span>
                    <textarea
                      className="ui-input supplier-form__textarea"
                      defaultValue={property.description}
                      maxLength={1500}
                      minLength={30}
                      name="description"
                      required
                    />
                  </label>
                  <Button fullWidth isLoading={isSaving} type="submit">
                    Save property profile
                  </Button>
                </form>
              ) : null}
              {canManage ? (
                <button
                  className="home-card__link partner-property-manager__add-room"
                  onClick={() =>
                    setActiveContentForm(
                      activeContentForm === property.id ? undefined : property.id,
                    )
                  }
                  type="button"
                >
                  {activeContentForm === property.id
                    ? 'Close content editor'
                    : 'Edit amenities, policies, and media'}
                </button>
              ) : null}
              {activeContentForm === property.id ? (
                <form
                  className="supplier-form partner-property-manager__room-form"
                  onSubmit={(event) => void updateContent(event, property)}
                >
                  <div className="booking-confirmation__reference">
                    <span>Content</span>
                    <strong>Facilities, guest rules, and gallery</strong>
                  </div>
                  <div className="supplier-form__grid">
                    <Input
                      defaultValue={stringListFromJson(property.languagesJson).join(', ')}
                      label="Languages spoken"
                      name="languages"
                      placeholder="Hindi, English, Punjabi"
                    />
                    <label className="ui-field">
                      <span className="ui-field__label">Nearby landmarks (one per line)</span>
                      <textarea
                        className="ui-input supplier-form__compact-textarea"
                        defaultValue={stringListFromJson(property.landmarksJson).join('\n')}
                        name="landmarks"
                      />
                    </label>
                  </div>
                  <AmenityChecklist
                    defaultValues={stringListFromJson(property.amenitiesJson)}
                    groups={propertyAmenityGroups}
                    legend="Property amenities"
                    name="amenities"
                  />
                  <div className="supplier-form__policy-checks">
                    <label>
                      <input
                        defaultChecked={property.childrenAllowed}
                        name="childrenAllowed"
                        type="checkbox"
                      />{' '}
                      Children are welcome
                    </label>
                    <label>
                      <input
                        defaultChecked={property.petsAllowed}
                        name="petsAllowed"
                        type="checkbox"
                      />{' '}
                      Pets are allowed
                    </label>
                    <label>
                      <input
                        defaultChecked={property.smokingAllowed}
                        name="smokingAllowed"
                        type="checkbox"
                      />{' '}
                      Smoking areas are available
                    </label>
                  </div>
                  <label className="ui-field">
                    <span className="ui-field__label">Guest policies (one per line)</span>
                    <textarea
                      className="ui-input supplier-form__textarea"
                      defaultValue={stringListFromJson(property.policiesJson).join('\n')}
                      name="policies"
                    />
                  </label>
                  <Input
                    defaultValue={property.imageUrl}
                    label="Cover photo URL"
                    name="imageUrl"
                    required
                    type="url"
                  />
                  <small>{DIRECT_IMAGE_URL_HELP}</small>
                  <label className="ui-field">
                    <span className="ui-field__label">
                      Gallery photo URLs (one per line, maximum 12)
                    </span>
                    <textarea
                      className="ui-input supplier-form__textarea"
                      defaultValue={stringListFromJson(property.imageUrlsJson).join('\n')}
                      name="imageUrls"
                    />
                    <small>{DIRECT_IMAGE_URL_HELP}</small>
                  </label>
                  <Button fullWidth isLoading={isSaving} type="submit">
                    Save property content
                  </Button>
                </form>
              ) : null}
              <div className="partner-property-manager__rooms">
                {property.rooms.map((room) => (
                  <div key={room.id}>
                    <strong>
                      {room.name} · {room.status.toLowerCase()}
                    </strong>
                    <span>
                      {room.inventoryCount} rooms · ₹{room.nightlyRate.toLocaleString('en-IN')} + ₹
                      {room.taxesAndFees.toLocaleString('en-IN')} taxes
                    </span>
                    <small>
                      {room.ratePlans.filter((rate) => rate.status === 'ACTIVE').length || 1} active
                      rate plan(s)
                    </small>

                    {room.ratePlans.map((rate) => (
                      <div className="partner-property-manager__rate" key={rate.id}>
                        <small>
                          {rate.name} · ₹{rate.nightlyRate.toLocaleString('en-IN')} + ₹
                          {rate.taxesAndFees.toLocaleString('en-IN')} · {rate.minimumStayNights}–
                          {rate.maximumStayNights} nights · {rate.status.toLowerCase()}
                        </small>
                        {canManage ? (
                          <div className="manage-booking__document-actions">
                            <button
                              className="home-card__link"
                              onClick={() =>
                                setActiveRateEditor(
                                  activeRateEditor === rate.id ? undefined : rate.id,
                                )
                              }
                              type="button"
                            >
                              {activeRateEditor === rate.id ? 'Close editor' : 'Edit rate'}
                            </button>
                            <button
                              className="home-card__link"
                              disabled={
                                isSaving ||
                                (rate.status === 'ACTIVE' &&
                                  room.ratePlans.filter(
                                    (candidate) => candidate.status === 'ACTIVE',
                                  ).length === 1)
                              }
                              onClick={() => void changeRatePlanStatus(property, room, rate)}
                              type="button"
                            >
                              {rate.status === 'ACTIVE' ? 'Pause rate' : 'Restore rate'}
                            </button>
                          </div>
                        ) : null}
                        {activeRateEditor === rate.id ? (
                          <form
                            className="supplier-form partner-property-manager__room-form"
                            onSubmit={(event) => void updateRatePlan(event, property, room, rate)}
                          >
                            <div className="supplier-form__grid">
                              <Input
                                defaultValue={rate.name}
                                label="Rate plan name"
                                maxLength={100}
                                minLength={2}
                                name="name"
                                required
                              />
                              <Input
                                defaultValue={rate.nightlyRate}
                                label="Nightly rate (INR)"
                                max={5000000}
                                min={100}
                                name="nightlyRate"
                                required
                                type="number"
                              />
                              <Input
                                defaultValue={rate.taxesAndFees}
                                label="Taxes and fees (INR)"
                                max={1000000}
                                min={0}
                                name="taxesAndFees"
                                required
                                type="number"
                              />
                              <label className="ui-field">
                                <span className="ui-field__label">Meal plan</span>
                                <select
                                  className="ui-input"
                                  defaultValue={rate.mealPlan}
                                  name="mealPlan"
                                >
                                  <option value="room-only">Room only</option>
                                  <option value="breakfast-included">Breakfast included</option>
                                  <option value="half-board">Half board</option>
                                  <option value="full-board">Full board</option>
                                </select>
                              </label>
                              <Input
                                defaultValue={rate.minimumStayNights}
                                label="Minimum stay (nights)"
                                max={30}
                                min={1}
                                name="minimumStayNights"
                                required
                                type="number"
                              />
                              <Input
                                defaultValue={rate.maximumStayNights}
                                label="Maximum stay (nights)"
                                max={90}
                                min={1}
                                name="maximumStayNights"
                                required
                                type="number"
                              />
                              <Input
                                defaultValue={rate.freeCancellationHours}
                                label="Free cancellation cutoff (hours before check-in)"
                                max={720}
                                min={0}
                                name="freeCancellationHours"
                                required
                                type="number"
                              />
                            </div>
                            <label className="ui-field">
                              <span className="ui-field__label">Cancellation policy</span>
                              <textarea
                                className="ui-input supplier-form__textarea"
                                defaultValue={rate.cancellationDescription}
                                maxLength={300}
                                minLength={10}
                                name="cancellationDescription"
                                required
                              />
                            </label>
                            <label className="supplier-form__check">
                              <input
                                defaultChecked={rate.refundable}
                                name="refundable"
                                type="checkbox"
                              />{' '}
                              Refundable under the stated policy
                            </label>
                            <Button fullWidth isLoading={isSaving} type="submit">
                              Save rate plan
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    ))}
                    {canManage ? (
                      <div className="manage-booking__document-actions">
                        <button
                          className="home-card__link"
                          onClick={() =>
                            setActiveRoomEditor(activeRoomEditor === room.id ? undefined : room.id)
                          }
                          type="button"
                        >
                          {activeRoomEditor === room.id ? 'Close room editor' : 'Edit room details'}
                        </button>
                        <button
                          className="home-card__link"
                          disabled={isSaving}
                          onClick={() => void changeRoomStatus(property, room)}
                          type="button"
                        >
                          {room.status === 'ACTIVE' ? 'Pause room' : 'Restore room'}
                        </button>
                      </div>
                    ) : null}
                    {activeRoomEditor === room.id ? (
                      <form
                        className="supplier-form partner-property-manager__room-form"
                        onSubmit={(event) => void updateRoom(event, property, room)}
                      >
                        <div className="booking-confirmation__reference">
                          <span>Room</span>
                          <strong>Room definition and occupancy</strong>
                        </div>
                        <div className="supplier-form__grid">
                          <Input
                            defaultValue={room.name}
                            label="Room name"
                            maxLength={120}
                            minLength={2}
                            name="name"
                            required
                          />
                          <Input
                            defaultValue={room.bedDescription}
                            label="Bed configuration"
                            maxLength={160}
                            minLength={2}
                            name="bedDescription"
                            required
                          />
                          <Input
                            defaultValue={room.inventoryCount}
                            label="Number of rooms"
                            max={500}
                            min={1}
                            name="inventoryCount"
                            required
                            type="number"
                          />
                          <Input
                            defaultValue={room.maximumAdults}
                            label="Maximum adults"
                            max={20}
                            min={1}
                            name="maximumAdults"
                            required
                            type="number"
                          />
                          <Input
                            defaultValue={room.maximumChildren}
                            label="Maximum children"
                            max={20}
                            min={0}
                            name="maximumChildren"
                            required
                            type="number"
                          />
                          <Input
                            defaultValue={room.maximumGuests}
                            label="Maximum guests"
                            max={30}
                            min={1}
                            name="maximumGuests"
                            required
                            type="number"
                          />
                          <Input
                            defaultValue={room.imageUrl}
                            label="Room photo URL"
                            name="imageUrl"
                            required
                            type="url"
                          />
                          <small>{DIRECT_IMAGE_URL_HELP}</small>
                        </div>
                        <AmenityChecklist
                          defaultValues={stringListFromJson(room.amenitiesJson)}
                          groups={roomAmenityGroups}
                          legend="Room amenities"
                          name="amenities"
                        />
                        <label className="ui-field">
                          <span className="ui-field__label">Room description</span>
                          <textarea
                            className="ui-input supplier-form__textarea"
                            defaultValue={room.description}
                            maxLength={800}
                            minLength={20}
                            name="description"
                            required
                          />
                        </label>
                        <Button fullWidth isLoading={isSaving} type="submit">
                          Save room details
                        </Button>
                      </form>
                    ) : null}
                    {canManage ? (
                      <button
                        className="home-card__link"
                        onClick={() =>
                          setActiveRatePlanRoom(
                            activeRatePlanRoom === room.id ? undefined : room.id,
                          )
                        }
                        type="button"
                      >
                        {activeRatePlanRoom === room.id ? 'Close rate form' : 'Add rate plan'}
                      </button>
                    ) : null}
                    {activeRatePlanRoom === room.id ? (
                      <form
                        className="supplier-form partner-property-manager__room-form"
                        onSubmit={(event) => void createRatePlan(event, property, room)}
                      >
                        <div className="booking-confirmation__reference">
                          <span>Rate</span>
                          <strong>New sellable rate plan</strong>
                        </div>
                        <div className="supplier-form__grid">
                          <Input
                            label="Rate plan name"
                            maxLength={100}
                            minLength={2}
                            name="name"
                            required
                          />
                          <Input
                            label="Nightly rate (INR)"
                            max={5000000}
                            min={100}
                            name="nightlyRate"
                            required
                            type="number"
                          />
                          <Input
                            defaultValue="0"
                            label="Taxes and fees (INR)"
                            max={1000000}
                            min={0}
                            name="taxesAndFees"
                            required
                            type="number"
                          />
                          <label className="ui-field">
                            <span className="ui-field__label">Meal plan</span>
                            <select className="ui-input" defaultValue="room-only" name="mealPlan">
                              <option value="room-only">Room only</option>
                              <option value="breakfast-included">Breakfast included</option>
                              <option value="half-board">Half board</option>
                              <option value="full-board">Full board</option>
                            </select>
                          </label>
                          <Input
                            defaultValue="1"
                            label="Minimum stay (nights)"
                            max={30}
                            min={1}
                            name="minimumStayNights"
                            required
                            type="number"
                          />
                          <Input
                            defaultValue="30"
                            label="Maximum stay (nights)"
                            max={90}
                            min={1}
                            name="maximumStayNights"
                            required
                            type="number"
                          />
                          <Input
                            defaultValue="48"
                            label="Free cancellation cutoff (hours before check-in)"
                            max={720}
                            min={0}
                            name="freeCancellationHours"
                            required
                            type="number"
                          />
                        </div>
                        <label className="ui-field">
                          <span className="ui-field__label">Cancellation policy</span>
                          <textarea
                            className="ui-input supplier-form__textarea"
                            maxLength={300}
                            minLength={10}
                            name="cancellationDescription"
                            required
                          />
                        </label>
                        <label className="supplier-form__check">
                          <input defaultChecked name="refundable" type="checkbox" /> Refundable
                          under the stated policy
                        </label>
                        <Button fullWidth isLoading={isSaving} type="submit">
                          Add rate plan
                        </Button>
                      </form>
                    ) : null}
                  </div>
                ))}
                {property.rooms.length === 0 ? (
                  <p>No room types yet. This draft is not visible to customers.</p>
                ) : null}
              </div>
              {canManage ? (
                <button
                  className="home-card__link partner-property-manager__add-room"
                  onClick={() =>
                    setActiveLocationForm(
                      activeLocationForm === property.id ? undefined : property.id,
                    )
                  }
                  type="button"
                >
                  {activeLocationForm === property.id
                    ? 'Close location editor'
                    : 'Edit searchable location'}
                </button>
              ) : null}
              {activeLocationForm === property.id ? (
                <form
                  className="supplier-form partner-property-manager__room-form"
                  onSubmit={(event) => void updateLocation(event, property)}
                >
                  <div className="booking-confirmation__reference">
                    <span>Location</span>
                    <strong>Searchable destination details</strong>
                  </div>
                  <div className="supplier-form__grid">
                    <Input
                      defaultValue={property.locality}
                      label="Area / locality"
                      name="locality"
                      required
                    />
                    <Input defaultValue={property.city} label="Town / city" name="city" required />
                    <Input defaultValue={property.tehsil} label="Tehsil (optional)" name="tehsil" />
                    <Input
                      defaultValue={property.district}
                      label="District"
                      name="district"
                      required
                    />
                    <Input defaultValue={property.state} label="State" name="state" required />
                    <Input
                      defaultValue={stringListFromJson(property.locationAliasesJson).join(', ')}
                      label="Other searchable names"
                      name="locationAliases"
                      placeholder="Bir, Upper Bir, Billing"
                    />
                  </div>
                  <Button fullWidth isLoading={isSaving} type="submit">
                    Save searchable location
                  </Button>
                </form>
              ) : null}
              {canManage ? (
                <button
                  className="home-card__link partner-property-manager__add-room"
                  onClick={() =>
                    setActiveRoomForm(activeRoomForm === property.id ? undefined : property.id)
                  }
                  type="button"
                >
                  {activeRoomForm === property.id ? 'Close room form' : 'Add room type and rate'}
                </button>
              ) : null}
              {activeRoomForm === property.id ? (
                <form
                  className="supplier-form partner-property-manager__room-form"
                  onSubmit={(event) => void createRoom(event, property)}
                >
                  <div className="booking-confirmation__reference">
                    <span>Step 2</span>
                    <strong>Room and opening rate</strong>
                  </div>
                  <div className="supplier-form__grid">
                    <Input label="Room name" maxLength={120} minLength={2} name="name" required />
                    <Input
                      label="Bed configuration"
                      maxLength={160}
                      name="bedDescription"
                      placeholder="1 king bed"
                      required
                    />
                    <Input
                      defaultValue="10"
                      label="Number of rooms"
                      max={500}
                      min={1}
                      name="inventoryCount"
                      required
                      type="number"
                    />
                    <Input
                      defaultValue="2"
                      label="Maximum adults"
                      max={20}
                      min={1}
                      name="maximumAdults"
                      required
                      type="number"
                    />
                    <Input
                      defaultValue="1"
                      label="Maximum children"
                      max={20}
                      min={0}
                      name="maximumChildren"
                      required
                      type="number"
                    />
                    <Input
                      defaultValue="3"
                      label="Maximum guests"
                      max={30}
                      min={1}
                      name="maximumGuests"
                      required
                      type="number"
                    />
                    <Input
                      label="Nightly rate (INR)"
                      max={5000000}
                      min={100}
                      name="nightlyRate"
                      required
                      type="number"
                    />
                    <Input
                      defaultValue="0"
                      label="Taxes and fees (INR)"
                      max={1000000}
                      min={0}
                      name="taxesAndFees"
                      required
                      type="number"
                    />
                    <Input
                      defaultValue="Best available rate"
                      label="Rate plan name"
                      maxLength={100}
                      name="ratePlanName"
                      required
                    />
                    <label className="ui-field">
                      <span className="ui-field__label">Meal plan</span>
                      <select className="ui-input" defaultValue="room-only" name="mealPlan">
                        <option value="room-only">Room only</option>
                        <option value="breakfast-included">Breakfast included</option>
                        <option value="half-board">Half board</option>
                        <option value="full-board">Full board</option>
                      </select>
                    </label>
                    <Input
                      label="Room photo URL (optional)"
                      name="imageUrl"
                      placeholder="Secure images.unsplash.com URL"
                      type="url"
                    />
                    <small>{DIRECT_IMAGE_URL_HELP}</small>
                  </div>
                  <AmenityChecklist
                    groups={roomAmenityGroups}
                    legend="Room amenities"
                    name="amenities"
                  />
                  <label className="ui-field">
                    <span className="ui-field__label">Room description</span>
                    <textarea
                      className="ui-input supplier-form__textarea"
                      maxLength={800}
                      minLength={20}
                      name="description"
                      required
                    />
                  </label>
                  <label className="ui-field">
                    <span className="ui-field__label">Cancellation policy</span>
                    <textarea
                      className="ui-input supplier-form__textarea"
                      maxLength={300}
                      minLength={10}
                      name="cancellationDescription"
                      required
                    />
                  </label>
                  <label className="supplier-form__check">
                    <input defaultChecked name="refundable" type="checkbox" /> This rate is
                    refundable under the stated policy
                  </label>
                  <Input
                    defaultValue="48"
                    label="Free cancellation cutoff (hours before check-in)"
                    max={720}
                    min={0}
                    name="freeCancellationHours"
                    required
                    type="number"
                  />
                  <Button fullWidth isLoading={isSaving} type="submit" variant="primary">
                    Add room and publish property
                  </Button>
                </form>
              ) : null}
            </Card>
          ))}
          {!isLoading && properties.length === 0 ? (
            <Card>
              <strong>No properties yet.</strong>
              <p>Create the first property above, then add its room and rate.</p>
            </Card>
          ) : null}
        </section>
      </div>
    </div>
  );
}
