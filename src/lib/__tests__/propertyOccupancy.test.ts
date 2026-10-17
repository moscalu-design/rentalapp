import { describe, expect, it } from "vitest";
import { getPropertyOccupancy } from "../propertyOccupancy";

describe("property listing occupancy", () => {
  it("shows a whole property with an active hidden-room tenancy as tenanted", () => {
    const result = getPropertyOccupancy("FULL_PROPERTY", [{
      status: "OCCUPIED", monthlyRent: 1500, isDefaultWholePropertyRoom: true,
      occupancies: [{ status: "ACTIVE", monthlyRent: 1400 }],
    }]);
    expect(result).toMatchObject({ totalRooms: 0, totalUnits: 1, occupiedUnits: 1, vacantUnits: 0, monthlyIncome: 1400 });
  });

  it("uses active tenancy records rather than a stale occupied status", () => {
    expect(getPropertyOccupancy("FULL_PROPERTY", [{
      status: "OCCUPIED", monthlyRent: 1500, isDefaultWholePropertyRoom: true, occupancies: [],
    }])).toMatchObject({ totalUnits: 1, occupiedUnits: 0, vacantUnits: 1, monthlyIncome: 0 });
  });

  it("keeps normal room counts and contractual income intact", () => {
    expect(getPropertyOccupancy("ROOM_LEVEL", [
      { status: "VACANT", monthlyRent: 500, occupancies: [{ status: "ACTIVE", monthlyRent: 450 }] },
      { status: "VACANT", monthlyRent: 600, occupancies: [] },
    ])).toMatchObject({ totalUnits: 2, occupiedUnits: 1, vacantUnits: 1, monthlyIncome: 450 });
  });
});
