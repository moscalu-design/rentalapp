type PaymentNavigationSource = {
  derivedStatus: string;
  occupancy: {
    status: string;
    tenantId: string;
    roomId: string;
    room: { propertyId: string; isDefaultWholePropertyRoom: boolean };
  };
};

/** A former tenancy must never send the user to its replacement tenant's payment form. */
export function getPaymentAction(payment: PaymentNavigationSource) {
  if (payment.occupancy.status !== "ACTIVE") {
    return { href: `/tenants/${payment.occupancy.tenantId}`, label: "View tenant" };
  }
  const href = payment.occupancy.room.isDefaultWholePropertyRoom
    ? `/properties/${payment.occupancy.room.propertyId}`
    : `/rooms/${payment.occupancy.roomId}`;
  if (["PAID", "WAIVED"].includes(payment.derivedStatus)) {
    return { href, label: "View tenancy" };
  }
  return { href: `${href}#record-payment`, label: "Record payment" };
}
