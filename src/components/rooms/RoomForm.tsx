"use client";

import { useId, useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createRoomFromState,
  updateRoomFromState,
  type RoomActionState,
} from "@/actions/rooms";
import type { Room } from "@/generated/prisma/client";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary hover:bg-primary disabled:opacity-60 text-white font-medium text-sm px-5 py-2.5 rounded-lg transition-colors"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

interface RoomFormProps {
  propertyId: string;
  room?: Room;
}

export function RoomForm({ propertyId, room }: RoomFormProps) {
  const formId = useId();
  const action = room
    ? updateRoomFromState.bind(null, room.id, propertyId)
    : createRoomFromState.bind(null, propertyId);
  const [state, formAction] = useActionState<RoomActionState, FormData>(
    action,
    { error: null }
  );

  return (
    <form aria-describedby={state.error ? `${formId}-error` : undefined} action={formAction} className="space-y-6 max-w-2xl">
      <div className="bg-card border border-border rounded-xl p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Room Details</h2>

        {state.error && (
          <div id={`${formId}-error`}
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {state.error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor={`${formId}-name`} className="block text-sm font-medium text-foreground mb-1.5">
              Room Name <span className="text-red-500">*</span>
            </label>
            <input id={`${formId}-name`}
              name="name"
              defaultValue={room?.name}
              required
              placeholder="e.g. Blue Room, Garden Room, Room 1"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-floor`} className="block text-sm font-medium text-foreground mb-1.5">Floor</label>
            <input id={`${formId}-floor`}
              name="floor"
              defaultValue={room?.floor ?? ""}
              placeholder="Ground, First, 2..."
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-sizeM2`} className="block text-sm font-medium text-foreground mb-1.5">Size (m²)</label>
            <input id={`${formId}-sizeM2`}
              name="sizeM2"
              type="number"
              step="0.1"
              min="0"
              defaultValue={room?.sizeM2 ?? ""}
              placeholder="e.g. 14.5"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-monthlyRent`} className="block text-sm font-medium text-foreground mb-1.5">
              Monthly Rent (£) <span className="text-red-500">*</span>
            </label>
            <input id={`${formId}-monthlyRent`}
              name="monthlyRent"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={room?.monthlyRent}
              placeholder="900"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-depositAmount`} className="block text-sm font-medium text-foreground mb-1.5">
              Deposit (£) <span className="text-red-500">*</span>
            </label>
            <input id={`${formId}-depositAmount`}
              name="depositAmount"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={room?.depositAmount}
              placeholder="900"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-status`} className="block text-sm font-medium text-foreground mb-1.5">Status</label>
            <select id={`${formId}-status`}
              name="status"
              defaultValue={room?.status ?? "VACANT"}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            >
              <option value="VACANT">Vacant</option>
              <option value="OCCUPIED">Occupied</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="RESERVED">Reserved</option>
            </select>
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="furnished"
              defaultChecked={room?.furnished ?? true}
              value="true"
              className="w-4 h-4 rounded border-input text-primary focus:ring-ring"
            />
            <span className="text-sm font-medium text-foreground">Furnished</span>
          </label>
        </div>

        <div>
          <label htmlFor={`${formId}-notes`} className="block text-sm font-medium text-foreground mb-1.5">Notes</label>
          <textarea id={`${formId}-notes`}
            name="notes"
            defaultValue={room?.notes ?? ""}
            rows={3}
            placeholder="Any notes about this room…"
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton label={room ? "Save Changes" : "Create Room"} />
        <a
          href={room ? `/rooms/${room.id}` : `/properties/${propertyId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
