import { describe, expect, it } from "vitest";
import { getPaymentAction } from "../paymentNavigation";

const occupancy = {
  status: "ACTIVE", tenantId: "tenant-1", roomId: "room-1",
  room: { propertyId: "property-1", isDefaultWholePropertyRoom: false },
};

describe("ledger payment links", () => {
  it("takes active room arrears to its payment form", () => {
    expect(getPaymentAction({ derivedStatus: "OVERDUE", occupancy }))
      .toEqual({ href: "/rooms/room-1#record-payment", label: "Record payment" });
  });
  it("takes whole-property arrears to the property's payment form", () => {
    expect(getPaymentAction({ derivedStatus: "PARTIAL", occupancy: { ...occupancy, room: { ...occupancy.room, isDefaultWholePropertyRoom: true } } }))
      .toEqual({ href: "/properties/property-1#record-payment", label: "Record payment" });
  });
  it.each(["PAID", "WAIVED"])("does not offer a second payment for %s rent", (derivedStatus) => {
    expect(getPaymentAction({ derivedStatus, occupancy })).toEqual({ href: "/rooms/room-1", label: "View tenancy" });
  });
  it("does not send ended-tenancy arrears to a replacement tenant's payment form", () => {
    expect(getPaymentAction({ derivedStatus: "OVERDUE", occupancy: { ...occupancy, status: "ENDED" } }))
      .toEqual({ href: "/tenants/tenant-1", label: "View tenant" });
  });
});
