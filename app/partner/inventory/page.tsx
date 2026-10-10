'use client';

import Link from 'next/link';
import { useState, useSyncExternalStore, type FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { readJsonResponse } from '@/lib/api/clientResponse';
import type {
  ApiErrorResponse,
  PartnerHotelCalendarRecord,
  PartnerInventoryRatePlanRecord,
  PartnerInventoryRecord,
} from '@/types/commerce';
import { inventorySourceLabel } from '@/lib/inventory/sourceLabels';
import { formatLocalCalendarDate, offsetLocalCalendarDate } from '@/utils/localDate';

export default function PartnerInventoryPage() {
  const today = useSyncExternalStore(
    () => () => undefined,
    () => formatLocalCalendarDate(new Date()),
    () => '',
  );
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [inventory, setInventory] = useState<PartnerInventoryRecord[]>([]);
  const [calendar, setCalendar] = useState<PartnerHotelCalendarRecord[]>([]);
  const [ratePlans, setRatePlans] = useState<PartnerInventoryRatePlanRecord[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState<string>();
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState('');
  const resolvedCheckInDate = checkInDate || offsetLocalCalendarDate(today, 1);
  const resolvedCheckOutDate = checkOutDate || offsetLocalCalendarDate(today, 4);

  async function loadInventory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsLoading(true);
    setHasLoaded(false);
    try {
      const params = new URLSearchParams({
        checkInDate: resolvedCheckInDate,
        checkOutDate: resolvedCheckOutDate,
      });
      const response = await fetch(`/api/v1/partner/inventory?${params}`);
      const result = await readJsonResponse<
        | {
            calendar: PartnerHotelCalendarRecord[];
            data: PartnerInventoryRecord[];
            ratePlans: PartnerInventoryRatePlanRecord[];
          }
        | ApiErrorResponse
      >(response);
      if (!response.ok || !result || !('data' in result)) {
        setError(
          result && 'error' in result ? result.error.message : 'Inventory could not be loaded.',
        );
        return;
      }
      setInventory(result.data);
      setCalendar(result.calendar);
      setRatePlans(result.ratePlans);
      setHasLoaded(true);
    } catch {
      setError('The partner service could not be reached.');
    } finally {
      setIsLoading(false);
    }
  }

  async function saveOverride(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setError(undefined);
    setSuccess(undefined);
    setIsSaving(true);
    try {
      const response = await fetch('/api/v1/partner/inventory', {
        body: JSON.stringify({
          availableRooms: Number(formData.get('availableRooms')),
          checkInDate: resolvedCheckInDate,
          checkOutDate: resolvedCheckOutDate,
          note: String(formData.get('note') ?? ''),
          nightlyRate: formData.get('nightlyRate')
            ? Number(formData.get('nightlyRate'))
            : undefined,
          ratePlanRecordId: String(formData.get('ratePlanRecordId') ?? '') || undefined,
          minimumStayNights: formData.get('minimumStayNights')
            ? Number(formData.get('minimumStayNights'))
            : undefined,
          maximumStayNights: formData.get('maximumStayNights')
            ? Number(formData.get('maximumStayNights'))
            : undefined,
          closedToArrival: formData.get('closedToArrival') === 'on',
          closedToDeparture: formData.get('closedToDeparture') === 'on',
          clearNightlyRate: formData.get('clearNightlyRate') === 'on',
          roomTypeId: String(formData.get('roomTypeId') ?? ''),
          stopSell: formData.get('stopSell') === 'on',
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const result = await readJsonResponse<{ data: PartnerInventoryRecord[] } | ApiErrorResponse>(
        response,
      );
      if (!response.ok || !result || !('data' in result)) {
        setError(
          result && 'error' in result
            ? result.error.message
            : 'The inventory limit could not be saved.',
        );
        return;
      }
      setInventory(result.data);
      form.reset();
      setSuccess(
        'The availability calendar controls were saved. Check inventory again to view each daily control.',
      );
    } catch {
      setError('The partner service could not be reached.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="booking-page partner-inventory">
      <div className="booking-page__container">
        <div className="partner-page__heading">
          <div>
            <p className="hotel-page__eyebrow">Partner operations</p>
            <h1>Inventory dashboard</h1>
            <p className="booking-page__intro">
              View confirmed allocations, temporary holds, and sellable rooms for any stay period.
            </p>
          </div>
          <div className="manage-booking__document-actions">
            <Link className="ui-button ui-button--secondary" href="/partner">
              Workspace
            </Link>
            <Link className="ui-button ui-button--secondary" href="/partner/bookings">
              Bookings
            </Link>
            <Link className="ui-button ui-button--secondary" href="/partner/properties">
              Properties
            </Link>
            <Link className="ui-button ui-button--secondary" href="/partner/amendments">
              Amendments
            </Link>
          </div>
        </div>
        <Card>
          <form className="booking-page__guest-form" onSubmit={loadInventory}>
            <div className="booking-page__payment-fields">
              <Input
                label="Check-in"
                min={today}
                name="checkInDate"
                onChange={(event) => setCheckInDate(event.target.value)}
                required
                type="date"
                value={resolvedCheckInDate}
              />
              <Input
                label="Check-out"
                min={resolvedCheckInDate}
                name="checkOutDate"
                onChange={(event) => setCheckOutDate(event.target.value)}
                required
                type="date"
                value={resolvedCheckOutDate}
              />
            </div>
            <Button fullWidth isLoading={isLoading} type="submit" variant="accent">
              Check inventory
            </Button>
            {error ? (
              <p className="booking-page__payment-error" role="alert">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="booking-page__success" role="status">
                {success}
              </p>
            ) : null}
          </form>
        </Card>
        {inventory.length > 0 ? (
          <Card className="partner-inventory__override-card">
            <h2>Room, rate, and stop-sell calendar</h2>
            <p>
              Control seasonal rates, room limits, stay rules, arrivals, departures, and stop-sell
              for the selected date range.
            </p>
            <form className="booking-page__guest-form" onSubmit={saveOverride}>
              <label className="ui-field">
                <span className="ui-field__label">Room type</span>
                <select
                  className="ui-input"
                  name="roomTypeId"
                  onChange={(event) => setSelectedRoomTypeId(event.target.value)}
                  required
                  value={selectedRoomTypeId}
                >
                  <option value="">Select a room</option>
                  {inventory.map((room) => (
                    <option key={room.roomTypeId} value={room.roomTypeId}>
                      {room.hotelName} - {room.roomName}
                    </option>
                  ))}
                </select>
              </label>
              <div className="booking-page__payment-fields">
                <Input
                  label="Available room limit"
                  min={0}
                  name="availableRooms"
                  required
                  type="number"
                />
                <Input
                  label="Nightly rate (INR, optional)"
                  min={100}
                  name="nightlyRate"
                  placeholder="Keep existing rate"
                  type="number"
                />
                <Input
                  label="Reason"
                  maxLength={200}
                  minLength={3}
                  name="note"
                  placeholder="Maintenance, allotment, or stop-sell"
                  required
                />
                <Input
                  label="Minimum stay (optional)"
                  max={30}
                  min={1}
                  name="minimumStayNights"
                  placeholder="No restriction"
                  type="number"
                />
                <label className="ui-field">
                  <span className="ui-field__label">Rate plan for seasonal price</span>
                  <select className="ui-input" name="ratePlanRecordId">
                    <option value="">No price change</option>
                    {ratePlans
                      .filter((ratePlan) => ratePlan.roomTypeId === selectedRoomTypeId)
                      .map((ratePlan) => (
                        <option key={ratePlan.id} value={ratePlan.id}>
                          {ratePlan.name} (
                          {inventory.find((room) => room.roomTypeId === ratePlan.roomTypeId)
                            ?.roomName ?? ratePlan.roomTypeId}
                          )
                        </option>
                      ))}
                  </select>
                </label>
                <Input
                  label="Maximum stay (optional)"
                  max={90}
                  min={1}
                  name="maximumStayNights"
                  placeholder="No restriction"
                  type="number"
                />
              </div>
              <label className="supplier-form__check">
                <input name="clearNightlyRate" type="checkbox" /> Clear the selected rate plan
                seasonal price and return to its base price
              </label>
              <label className="supplier-form__check">
                <input name="closedToArrival" type="checkbox" /> Do not allow check-in on these
                dates
              </label>
              <label className="supplier-form__check">
                <input name="closedToDeparture" type="checkbox" /> Do not allow check-out on these
                dates
              </label>
              <label className="supplier-form__check">
                <input name="stopSell" type="checkbox" /> Stop selling this room for the selected
                dates
              </label>
              <Button fullWidth isLoading={isSaving} type="submit" variant="primary">
                Save availability calendar
              </Button>
            </form>
          </Card>
        ) : null}
        {calendar.length > 0 ? (
          <Card className="partner-inventory__override-card">
            <h2>Saved daily controls</h2>
            <div className="partner-inventory__list">
              {calendar.map((day) => (
                <div
                  className="partner-inventory__room"
                  key={`${day.roomTypeId}-${day.ratePlanName ?? 'room'}-${day.stayDate}`}
                >
                  <strong>
                    {day.stayDate} · {day.hotelName} · {day.roomName}
                  </strong>
                  <small>
                    {day.availableRooms} rooms
                    {day.ratePlanName ? ` · ${day.ratePlanName}` : ''}
                    {day.nightlyRate ? ` · ₹${day.nightlyRate.toLocaleString('en-IN')}` : ''}
                    {day.minimumStayNights ? ` · min ${day.minimumStayNights} nights` : ''}
                    {day.maximumStayNights ? ` · max ${day.maximumStayNights} nights` : ''}
                    {day.closedToArrival ? ' · arrivals closed' : ''}
                    {day.closedToDeparture ? ' · departures closed' : ''}
                    {day.stopSell ? ' · stop-sell' : ''}
                  </small>
                  <span>{day.note}</span>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
        <div className="partner-inventory__list" aria-live="polite">
          {inventory.map((room) => {
            const used = room.activeHolds + room.allocatedRooms;
            const utilization =
              room.effectiveInventory === 0
                ? used > 0
                  ? 100
                  : 0
                : Math.round((used / room.effectiveInventory) * 100);
            return (
              <Card className="partner-inventory__room" key={room.roomTypeId}>
                <div className="booking-confirmation__reference">
                  <span>{room.hotelName}</span>
                  <strong>{room.roomName}</strong>
                </div>
                <div className="partner-inventory__metrics">
                  <div>
                    <span>{room.overrideApplied ? 'Effective limit' : 'Base stock'}</span>
                    <strong>{room.effectiveInventory}</strong>
                  </div>
                  <div>
                    <span>Confirmed</span>
                    <strong>{room.allocatedRooms}</strong>
                  </div>
                  <div>
                    <span>Active holds</span>
                    <strong>{room.activeHolds}</strong>
                  </div>
                  <div>
                    <span>Available</span>
                    <strong
                      className={
                        room.remainingRooms === 0
                          ? 'partner-inventory__sold-out'
                          : 'partner-inventory__available'
                      }
                    >
                      {room.remainingRooms}
                    </strong>
                  </div>
                </div>
                <div className="partner-inventory__utilization">
                  <span style={{ width: `${Math.min(100, utilization)}%` }} />
                </div>
                <small>
                  {utilization}% allocated or held · {inventorySourceLabel(room.inventorySource)}
                  {room.overrideApplied ? ` · override applied (base ${room.baseInventory})` : ''}
                </small>
              </Card>
            );
          })}
          {hasLoaded && inventory.length === 0 ? (
            <Card>
              <strong>No room inventory is configured.</strong>
              <p>
                Create a property and its first room type before using the availability calendar.
              </p>
              <Link className="home-card__link" href="/partner/properties">
                Open property setup
              </Link>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
