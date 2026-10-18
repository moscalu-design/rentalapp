# Rental App and Verity connector

The connector is deployed. Authenticated account linking and real imports remain separate from local synthetic validation. Follow the [setup guide](verity-connector-setup.md).

## Responsibility and financial meaning

Verity supplies canonical transaction evidence for explicitly selected accounts. Rental App owns properties, tenancies, rent obligations, bills and mortgage terms. Users sign in to each application independently and authorize the connection with a scoped Verity token; the current account email must match in both applications (case-insensitive, with surrounding whitespace ignored). Email matching is an additional check: it does not replace tokens, stable owner IDs or ownership checks.

Imports stage transactions for review. They do not record rent or automatically select a property. A user confirms each allocation, including its amount and rental target. Confirmed allocations return dedicated rental context to Verity; they never create another bank transaction or overwrite transaction amounts, categories, notes, tags or provider data.

| Workflow | Effect of confirmation | Preserved distinction |
| --- | --- | --- |
| Rent: already recorded | Links bank evidence to an existing unlinked portion of cumulative `Payment.amountPaid` | The paid amount does not increase |
| Rent: not recorded yet | Adds the confirmed amount to the selected tenancy and billing period, within the remaining rent due | Existing manual receipts must be linked first; deposits are separate |
| Utility: not recorded yet | Creates a one-off electricity, gas, water, heating or internet cost and links its debit atomically | Confirm the property, category and reporting month; payment date comes from Verity |
| Utility or property cost: already recorded | Links a debit to an existing `PropertyExpense`, within its unlinked amount | Create the bill first; its amount, reporting month, service coverage and receipt stay unchanged |
| Mortgage payment | Records an actual cash allocation against the selected mortgage | Loan terms, forecast principal/interest, prepayments and scenarios remain separate |

One transaction may be split across targets, and several transactions may cover one target. Source allocations cannot exceed the absolute bank amount. Rent needs a credit; utility and mortgage payments need a debit. Mortgage allocations appear in **Actual mortgage payments** at `/properties/[propertyId]/mortgages/[mortgageId]`.

## Source and ownership contract

Rental binds one authenticated local owner to one Verity owner. Matching emails are checked before linking, before transaction pages are fetched, again before imports are saved, before confirming allocations, and before sending rental context. A changed email blocks further imports and confirmations; disconnect and safe undo remain available. That binding survives disconnect and cannot be reassigned to another Verity owner; the same Verity owner cannot be attached to a second Rental account in this database. Each confirmation verifies ownership of the imported transaction and the rent, expense or mortgage target, including its property. Legacy records without an owner are not adopted. Rental accounts with the `VIEWER` role cannot mutate the connector.

The versioned Verity API exports canonical ledger transactions scoped to the token owner and selected accounts:

- Bank transactions need booked (`BOOK`) source evidence and consistent original amount, currency, date and identity. Original cash currency is used, rather than a converted reporting estimate.
- Statement transactions need owner-matched, confirmed/imported statement metadata without failure or replacement flags. Unbacked manual transactions and pending bank entries are excluded.
- The canonical transaction ID identifies the ledger row. When present, `sourceKey` carries the account-scoped bank transaction key; provider `transaction_id`, amount/date and descriptions are not substitute identities. The provider archive is not a second stream of money.

Rental retains the original and current import snapshots and an allocation-time source snapshot. Financial or provenance changes affecting confirmed allocations, and disappearance from a later snapshot, require review. Import does not silently reverse recorded money. Editable account names, display descriptions and transport timestamps do not alone invalidate a match. Provenance changes remain quarantined rather than guessed.

## Persistence and API

Rental's Prisma migration adds `VerityConnection`, `VerityTransaction` and `VerityAllocation`. The connection holds encrypted credentials and account permissions; transactions retain source identity and review state; allocations retain their confirmation, undo snapshots and pending context operation. Owner-scoped uniqueness prevents duplicate canonical transactions and repeated confirmation keys. A local database transaction serializes owner mutations and commits rent changes with their allocations and activity log.

Rental endpoints under `/api/integrations/verity` require the Rental session:

| Route | Methods | Purpose |
| --- | --- | --- |
| `/connection` | GET, POST, DELETE | Inspect, connect or disconnect |
| `/sync` | POST | Import a complete fresh snapshot |
| `/transactions` | GET | Read this owner's review inbox |
| `/allocations` | POST | Confirm an allocation |
| `/allocations/[id]` | DELETE | Undo an allocation |
| `/retry-context` | POST | Retry pending context or revocation |

Mutation requests require an `Origin` exactly matching the Rental request origin; if `Sec-Fetch-Site` is present it must be `same-origin`. JSON bodies are bounded. The browser calls its own Rental server, which uses a bearer token to call Verity. It does not call Verity with copied cookies.

Verity exposes `/api/integrations/rental/v1/connection`, `/transactions` and `/context`. Its owner-session provisioning endpoint is `/api/integrations/rental/connections`. See `docs/rental-api.md` in the Verity repository for the exact wire format and server authorization contract.

## Retry, undo and disconnection

Confirmation is idempotent for the same request key and payload. A conflicting payload is rejected. Context delivery happens after the local confirmation: a network failure leaves money saved once in Rental and marks its Verity update pending. **Retry pending updates** retries the metadata, not the receipt. An in-flight update followed by undo queues a deletion rather than treating the old update as final.

Undoing a newly created utility cost removes both the cost and its allocation only while the cost remains unchanged and has no dependent matches. An edited cost or added receipt blocks automatic deletion. Repeated confirmations and refreshes do not create another cost. Creation also rejects an existing cost with the same property, category and amount covering the reporting month, including recurring costs; link the existing bill instead.

Undoing a link removes the allocation while preserving manually recorded rent or the bill. Undoing a new rent receipt restores its previous monetary state only when safe. Undo split receipts in reverse order; a later financial edit or dependent match can block reversal. Notes and references are preserved. Mortgage undo removes the actual cash allocation without rewriting the loan model.

Disconnect stops local imports and requests revocation in Verity. Imported records and confirmed rental money remain. A network failure keeps revocation pending and blocks replacement until retried; an already expired or revoked token counts as inactive. To replace a token, disconnect first, create a new token for the same Verity owner, reconnect and import a fresh snapshot. Confirmed context is reattached only for eligible sources in the refreshed scope, without recording the money again.

## Version 1 limits and validation

Imports are manual, complete snapshots, not a scheduled sync or a durable change-event feed. Each refresh starts with no cursor. Rental fetches 500 transactions per page, up to 20 pages / 10,000 transactions; larger selections fail without importing a partial snapshot. Select fewer accounts to fit the limit. Repeated pages, duplicate source IDs and mismatched owners/accounts reject the import.

Only EUR can be allocated in Rental version 1. Other currencies remain visible as unsupported and are not converted. Matching is explicit: there are no automatic payer rules, automatic bill creation, deposit allocations or inferred mortgage principal/interest splits.

Local validation uses isolated SQLite for Rental persistence and isolated PGlite for Verity SQL, with synthetic owners and transactions. The local browser flow passed rent, utility and mortgage confirmations: three source transactions, three confirmed matches, three context records and no page errors. Repeating confirmation and refreshing produced no extra receipt. These checks exercise the implementation with fixtures; they do not prove production auth, a deployed database migration, or a real provider-backed end-to-end flow.

## Connection and import progress

The connection and import screens display server-reported stages, transaction counts and elapsed time. Counts during preparation are provisional until the complete database transaction commits. No simulated percentage or completion timer is used. Streaming clients request `application/x-ndjson`; ordinary JSON clients remain supported behind the same authentication and origin checks.

Imports save in batches of 250, including source updates and missing-source review flags, while retaining the single-transaction commit and original evidence snapshots. Review queries fetch transactions and allocations separately to avoid the database parameter limit on larger histories. The screen initially renders 100 matching transactions with a Show more control; search still covers the loaded import.

The progress stream belongs to the current page request, not a persistent background job. Keep the page open; after an interruption, reload to inspect the saved state before retrying. A successful import followed by a failed screen refresh is reported separately. Pending property-context updates remain retryable without posting receipts twice.

## Create a utility cost from Verity

In Settings → Verity connection, import transactions and open **Match** on a EUR debit. Choose **Utility or property cost**, then **Not recorded yet — create utility cost**. Confirm the property, utility category, title, optional provider and reporting month. The amount defaults to the unmatched bank amount and can be reduced for a split. **Create utility cost and match** saves both records together. The cost appears in the property's Costs page and reporting totals. It is a one-off actual payment; no recurrence or service coverage is inferred.

The allocation API accepts `mode: "create_expense"`, `kind: "expense"`, `targetId` equal to the owned property ID, and `newExpense` containing `title`, `category`, `reportingYear`, `reportingMonth` and optional `provider`. Saved allocations and outgoing Verity context use the created expense ID as their target. No database migration is required.
