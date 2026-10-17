# Rental App

## Product and audience

Rental App is an owner workspace for managing rental properties, tenancies, rent records, deposits and property finances. The user has chosen the current Verity application as its visual reference: the two applications should feel like the same family, while Rental App stays specialized for a rental business. Keep the Rental App name and rental-specific language.

## Existing workflows

- **Portfolio:** create and edit properties; distinguish room-by-room rentals from whole-property rentals; review property details, occupancy and finances. Whole-property rental uses the existing internal default room to keep the tenancy and billing model consistent.
- **Tenancies:** maintain tenant records, assign an existing tenant or create one during assignment, record lease and move-in dates, edit tenancy terms and end a tenancy. Rooms retain their own rent, deposit, status and inventory information.
- **Rent:** inspect billing records and statuses, record cumulative amounts paid, review balances and filter the ledger. A payment record represents one tenancy billing period, not necessarily one bank transaction or receipt.
- **Deposits:** record receipts, deductions, refunds and adjustments, with transaction history and refund-due information. Deposit balances are separate from rent income.
- **Mortgages:** maintain loan terms, view schedules, record prepayments, compare the baseline with the modeled actual path and explore hypothetical scenarios. A calculated schedule is not bank evidence. Applying a scenario remains an explicit action.
- **Property costs:** maintain one-time and recurring costs with reporting periods and coverage dates, and review month/year summaries.
- **Records:** retain tenant documents, contracts, room inventory and inspection records. Existing routes include document retrieval, inspection-photo handling, inspection-report PDFs and exports.
- **Account:** sign up and sign in, use optional two-factor authentication, review account information and export account data.

These statements reflect existing routes, components, schema and domain helpers. They do not imply live provider access or production validation.

## Ownership and financial meaning

Preserve authenticated user ownership checks in server actions, API routes and queries. UI changes do not authorize cross-account reads or writes. Continue using the existing `userId` relationships and `requireUser`/ownership helpers.

Preserve billing grain, tenancy lifecycle rules, deposit accounting, mortgage schedules and existing expense-period logic. Do not relabel forecasts as receipts or merge deposits into rent. The current currency formatter defaults to EUR; currency/locale preferences remain on the settings roadmap.

The property Payments header totals cover every stored billing period attached to active tenancies for that owned property, including historical and future billing records. Outstanding sums each nonnegative due-minus-paid balance, including amounts not yet due. The status filter changes table rows only. Existing status derivation treats partially paid bills as partial and preserves waived status; the styling pass does not change those finance rules.

## Current change and verification boundary

The current pass aligns the desktop experience with Verity’s pearl, graphite, blue and Inter system, improves navigation and content hierarchy, associates form labels and feedback, and makes financial scope clearer. Existing responsive compositions are preserved. See `DESIGN.md` for the implemented visual system.

The checked-in seed creates synthetic local development records. Local preview and test fixtures must not be presented as real rental accounts or production financial results. Tests and local browser checks provide only the evidence they exercise; they do not prove a live bank connection, deployed tenant behavior or production reconciliation. No deployment or production-data claim is established by this document.

## Verity connection

The connector is implemented and validated locally with synthetic data. Rental's `/settings/verity` page connects an explicitly authorized Verity owner, imports scoped canonical transactions and requires confirmation of each rent, property-cost or mortgage allocation. Rent can link existing manual receipts or add new paid money; costs link existing bills; mortgage allocations record actual bank payments separately from loan forecasts. Dedicated context returns to Verity without inserting duplicate bank transactions.

Version 1 uses manual complete imports, supports EUR allocations and limits each snapshot to 10,000 transactions. Owner checks, encrypted tokens, idempotent confirmation, bounded splits, source-change review, safe undo and revocation are implemented. Local browser validation covered all three payment types, duplicate retry and repeated import, with three confirmed matches, three remote context records and no page errors.

See `docs/verity-integration.md` for the implemented contract and `docs/verity-connector-setup.md` for configuration, migrations and operation. Production migrations and deployment have not been performed; local tests do not prove live provider access or reconciliation of real accounts.

## Scope limits

The settings page still labels password changes, overdue-email notifications, payment-history CSV export, currency/locale settings and multi-user access as roadmap items. Existing route-specific exports do not prove the entire roadmap is implemented. Do not add marketing claims, invented user counts, guarantees, provider eligibility or automatic reconciliation claims to fill a screen.

## Source anchors

- Routes: `src/app/(app)` and `src/app/api`.
- Ownership/authentication: `src/lib/currentUser.ts`, `src/lib/auth.ts`, server actions and API handlers.
- Data grain: `prisma/schema.prisma`; finance: `src/lib/billing.ts`, `mortgage.ts`, `depositUtils.ts`, `expenses.ts`, `utils.ts`.
- Synthetic fixtures: `prisma/seed.ts` and local test setup.
- Visual source: `src/app/globals.css` and the components listed in `DESIGN.md`.

Reviewed against the local working source on 16 October 2026.
