"use client";

import { deleteRoom } from "@/actions/rooms";

interface DeleteRoomFormProps {
  roomId: string;
  propertyId: string;
}

export function DeleteRoomForm({ roomId, propertyId }: DeleteRoomFormProps) {
  return (
    <form action={deleteRoom.bind(null, roomId, propertyId)}>
      <button
        type="submit"
        data-testid="delete-room-button"
        className="text-sm font-medium text-red-600 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
        onClick={(event) => {
          if (!confirm("Delete this room? This action cannot be undone.")) {
            event.preventDefault();
          }
        }}
      >
        Delete Room
      </button>
    </form>
  );
}
