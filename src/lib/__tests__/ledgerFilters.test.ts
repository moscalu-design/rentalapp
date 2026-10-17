import { describe, expect, it } from "vitest";
import { parseLedgerFilters, paymentYearOptions } from "../ledgerFilters";

const now = new Date(2026, 0, 15);

describe("payment ledger filters", () => {
  it("keeps December and its selected prior year together", () => {
    expect(parseLedgerFilters({ month: "12", year: "2025", status: "OVERDUE" }, now))
      .toEqual({ month: 12, year: 2025, status: "OVERDUE" });
  });

  it.each(["0", "13", "1.5", "Infinity", "-1", "NaN", "1e1", "", ["2", "3"]])(
    "rejects invalid month %j", (month) => {
      expect(parseLedgerFilters({ month, year: "2025" }, now))
        .toEqual({ month: 1, year: 2025, status: "" });
    },
  );

  it.each(["0", "1899", "10000", "2026.5", "2026abc", ["2025", "2026"]])(
    "rejects invalid year %j", (year) => {
      expect(parseLedgerFilters({ year, month: "12" }, now))
        .toEqual({ month: 12, year: 2026, status: "" });
    },
  );

  it("uses the current period and all statuses for absent or unsupported filters", () => {
    expect(parseLedgerFilters({ status: "INVALID" }, now)).toEqual({ year: 2026, month: 1, status: "" });
    expect(parseLedgerFilters({ status: ["PAID", "UNPAID"] }, now).status).toBe("");
  });

  it("retains historical and directly selected years in descending order", () => {
    expect(paymentYearOptions([2021, 2025, 2025], 2027, 2026)).toEqual([2027, 2026, 2025, 2021]);
  });
});
