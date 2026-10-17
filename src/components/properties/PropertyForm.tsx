"use client";

import { useId, useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createPropertyFromState,
  updatePropertyFromState,
  type PropertyActionState,
} from "@/actions/properties";
import type { Property } from "@/generated/prisma/client";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      data-testid="property-form-submit"
      className="bg-primary hover:bg-primary disabled:opacity-60 text-white font-medium text-sm px-5 py-2.5 rounded-lg transition-colors"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

interface PropertyFormProps {
  property?: Property;
}

const initialState: PropertyActionState = { error: null };

export function PropertyForm({ property }: PropertyFormProps) {
  const formId = useId();
  const action = property
    ? updatePropertyFromState.bind(null, property.id)
    : createPropertyFromState;
  const [state, formAction] = useActionState<PropertyActionState, FormData>(
    action,
    initialState
  );
  const [rentalMode, setRentalMode] = useState<"ROOM_LEVEL" | "FULL_PROPERTY">(
    (property?.rentalMode as "ROOM_LEVEL" | "FULL_PROPERTY" | undefined) ?? "ROOM_LEVEL"
  );

  return (
    <form aria-describedby={state.error ? `${formId}-error` : undefined} action={formAction} className="space-y-6 max-w-2xl">
      {state.error && (
        <div id={`${formId}-error`}
          role="alert"
          data-testid="property-form-error"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {state.error}
        </div>
      )}

      {/* Rental Mode */}
      <div className="bg-card border border-border rounded-xl p-5 sm:p-6 space-y-4">
        <div>
          <h2 id={`${formId}-rental-mode-label`} className="text-sm font-semibold text-foreground">How do you rent this property?</h2>
          <p id={`${formId}-rental-mode-hint`} className="text-xs text-muted-foreground mt-1">
            Switching modes is blocked while there are active tenancies.
          </p>
        </div>

        <div role="radiogroup" aria-labelledby={`${formId}-rental-mode-label`} aria-describedby={`${formId}-rental-mode-hint`} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label
            className={`cursor-pointer rounded-lg border px-4 py-3 transition-colors ${
              rentalMode === "ROOM_LEVEL"
                ? "border-primary bg-accent"
                : "border-border hover:border-input"
            }`}
          >
            <input
              type="radio"
              name="rentalMode"
              value="ROOM_LEVEL"
              checked={rentalMode === "ROOM_LEVEL"}
              onChange={() => setRentalMode("ROOM_LEVEL")}
              data-testid="rental-mode-room-level"
              className="sr-only"
            />
            <p className="font-medium text-sm text-foreground">Room by room</p>
            <p className="text-xs text-muted-foreground mt-1">
              Multiple rentable rooms with individual tenancies.
            </p>
          </label>

          <label
            className={`cursor-pointer rounded-lg border px-4 py-3 transition-colors ${
              rentalMode === "FULL_PROPERTY"
                ? "border-primary bg-accent"
                : "border-border hover:border-input"
            }`}
          >
            <input
              type="radio"
              name="rentalMode"
              value="FULL_PROPERTY"
              checked={rentalMode === "FULL_PROPERTY"}
              onChange={() => setRentalMode("FULL_PROPERTY")}
              data-testid="rental-mode-full-property"
              className="sr-only"
            />
            <p className="font-medium text-sm text-foreground">Whole property</p>
            <p className="text-xs text-muted-foreground mt-1">
              One tenancy for the entire property — no room records needed.
            </p>
          </label>
        </div>

        {rentalMode === "FULL_PROPERTY" && (
          <div data-testid="property-monthly-rent-block">
            <label htmlFor={`${formId}-monthlyRent`} className="block text-sm font-medium text-foreground mb-1.5">
              Monthly Rent (€) <span className="text-red-500">*</span>
            </label>
            <input aria-describedby={`${formId}-monthlyRent-hint`} id={`${formId}-monthlyRent`}
              name="monthlyRent"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={property?.monthlyRent ?? ""}
              placeholder="1500"
              data-testid="property-monthly-rent-input"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
            <p id={`${formId}-monthlyRent-hint`} className="text-xs text-muted-foreground mt-1">
              Used to bill the whole-property tenant each month.
            </p>
          </div>
        )}
      </div>

      {/* Basic Info */}
      <div className="bg-card border border-border rounded-xl p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Property Details</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor={`${formId}-name`} className="block text-sm font-medium text-foreground mb-1.5">
              Property Name <span className="text-red-500">*</span>
            </label>
            <input id={`${formId}-name`}
              name="name"
              defaultValue={property?.name}
              required
              placeholder="e.g. Oak Street House"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor={`${formId}-address`} className="block text-sm font-medium text-foreground mb-1.5">
              Address <span className="text-red-500">*</span>
            </label>
            <input id={`${formId}-address`}
              name="address"
              defaultValue={property?.address}
              required
              placeholder="123 Oak Street"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-city`} className="block text-sm font-medium text-foreground mb-1.5">
              City <span className="text-red-500">*</span>
            </label>
            <input id={`${formId}-city`}
              name="city"
              defaultValue={property?.city}
              required
              placeholder="London"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-postcode`} className="block text-sm font-medium text-foreground mb-1.5">Postcode</label>
            <input id={`${formId}-postcode`}
              name="postcode"
              defaultValue={property?.postcode ?? ""}
              placeholder="SW1A 1AA"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-propertyType`} className="block text-sm font-medium text-foreground mb-1.5">Property Type</label>
            <select id={`${formId}-propertyType`}
              name="propertyType"
              defaultValue={property?.propertyType ?? "HOUSE"}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            >
              <option value="HOUSE">House</option>
              <option value="APARTMENT">Apartment</option>
              <option value="HMO">HMO</option>
              <option value="STUDIO">Studio</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor={`${formId}-status`} className="block text-sm font-medium text-foreground mb-1.5">Status</label>
            <select id={`${formId}-status`}
              name="status"
              defaultValue={property?.status ?? "ACTIVE"}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {/* Static info */}
      <div className="bg-card border border-border rounded-xl p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Property Information</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Static details describing the building itself.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label htmlFor={`${formId}-totalRoomCount`} className="block text-sm font-medium text-foreground mb-1.5">Total Rooms</label>
            <input id={`${formId}-totalRoomCount`}
              name="totalRoomCount"
              type="number"
              min="0"
              step="1"
              defaultValue={property?.totalRoomCount ?? ""}
              placeholder="5"
              data-testid="property-total-room-count-input"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-bedroomCount`} className="block text-sm font-medium text-foreground mb-1.5">Bedrooms</label>
            <input id={`${formId}-bedroomCount`}
              name="bedroomCount"
              type="number"
              min="0"
              step="1"
              defaultValue={property?.bedroomCount ?? ""}
              placeholder="3"
              data-testid="property-bedroom-count-input"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-bathroomCount`} className="block text-sm font-medium text-foreground mb-1.5">Bathrooms</label>
            <input id={`${formId}-bathroomCount`}
              name="bathroomCount"
              type="number"
              min="0"
              step="1"
              defaultValue={property?.bathroomCount ?? ""}
              placeholder="2"
              data-testid="property-bathroom-count-input"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-surfaceAreaSqm`} className="block text-sm font-medium text-foreground mb-1.5">Surface (m²)</label>
            <input id={`${formId}-surfaceAreaSqm`}
              name="surfaceAreaSqm"
              type="number"
              min="0"
              step="0.1"
              defaultValue={property?.surfaceAreaSqm ?? ""}
              placeholder="80"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {(
            [
              { name: "hasTerrace", label: "Terrace" },
              { name: "hasBalcony", label: "Balcony" },
              { name: "hasGarden", label: "Garden" },
              { name: "hasParking", label: "Parking" },
              { name: "isFurnished", label: "Furnished" },
            ] as const
          ).map((feature) => {
            const checked = Boolean(
              property?.[feature.name as keyof Property] as boolean | undefined
            );
            return (
              <label key={feature.name} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name={feature.name}
                  defaultChecked={checked}
                  value="true"
                  data-testid={`property-${feature.name}-input`}
                  className="w-4 h-4 rounded border-input text-primary focus:ring-ring"
                />
                <span className="text-sm font-medium text-foreground">{feature.label}</span>
              </label>
            );
          })}
        </div>

        <div>
          <label htmlFor={`${formId}-description`} className="block text-sm font-medium text-foreground mb-1.5">Description</label>
          <textarea id={`${formId}-description`}
            name="description"
            defaultValue={property?.description ?? ""}
            rows={3}
            placeholder="Public description of the property…"
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none"
          />
        </div>

        <div>
          <label htmlFor={`${formId}-notes`} className="block text-sm font-medium text-foreground mb-1.5">Internal Notes</label>
          <textarea id={`${formId}-notes`}
            name="notes"
            defaultValue={property?.notes ?? ""}
            rows={3}
            placeholder="Private notes about this property…"
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton label={property ? "Save Changes" : "Create Property"} />
        <a href={property ? `/properties/${property.id}` : "/properties"} className="text-sm text-muted-foreground hover:text-foreground">
          Cancel
        </a>
      </div>
    </form>
  );
}
