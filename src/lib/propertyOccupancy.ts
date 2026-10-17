import { isRoomOccupied, summarizeRooms } from "./roomOccupancy";

/** Whole-property tenancies use a hidden room; regular room counts exclude it. */
export function getPropertyOccupancy(
  rentalMode: string,
  rooms: Parameters<typeof summarizeRooms>[0],
) {
  const summary = summarizeRooms(rooms);
  if (rentalMode !== "FULL_PROPERTY") {
    return { ...summary, totalUnits: summary.totalRooms, occupiedUnits: summary.occupiedRooms, vacantUnits: summary.vacantRooms };
  }

  const occupiedUnits = rooms.some((room) => room.isDefaultWholePropertyRoom && isRoomOccupied(room)) ? 1 : 0;
  return { ...summary, totalUnits: 1, occupiedUnits, vacantUnits: 1 - occupiedUnits };
}
