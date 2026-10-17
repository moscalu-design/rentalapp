# Local verification — Rental App and Verity connector

Verified on 16 October 2026. This document records the 16 October local tests. Production setup and release began on 17 October; see the deployment report for the live outcome.

## Implemented

- Verity family styling across the rental workspace, with clearer property, tenancy, payment, mortgage, cost and account screens.
- Accessible labels, focus handling, sign-in feedback, current-period payment filtering and whole-property occupancy handling.
- Correct cumulative payment editing and preservation of existing receipt metadata.
- Owner-scoped API connector with selected-account tokens, encrypted Rental credential storage, a transaction review screen and explicit matches.
- Rent evidence or new receipts, existing utility/property bill evidence, and actual mortgage cash payments kept separate from mortgage forecasts.
- Idempotent confirmations, allocation caps, source correction review, safe undo, reconnect and delivery retries.
- Locally bundled Inter fonts, so production builds do not depend on fetching font files from Google.

## Validation evidence

| Check | Result |
| --- | --- |
| Rental unit, SQLite integration and API security suite | 215 passing tests across 21 files |
| Verity connector SQL, HTTP and setup UI suite | 19 passing tests, including temporary PostgreSQL-compatible execution |
| Production build | Passed after locally bundling the font |
| Rental lint and TypeScript | Passed |
| Verity connector lint and full TypeScript | Passed in the current working tree |
| Browser navigation | Authenticated smoke passed; reviewed core desktop screens and existing mobile layouts |
| Mortgage workflow | Create, details, simulation, prepayments and cost integration passed |
| Property cost workflow | One-off and recurring cost creation, totals and reload persistence passed; test dates now follow the current month |
| Payment regression | Period changes, cumulative totals and existing receipt metadata passed |
| Connector browser flow | Synthetic rent, mortgage and electricity transactions matched against a disposable Rental database; three metadata confirmations returned to a fixture API |
| Duplicate behavior | Repeated confirmation returned the same allocation; repeating the import added zero transactions |
| Browser errors / overflow | None in the reviewed pages and connector desktop/mobile captures |
| Independent finish review | Original findings fixed; final disposition SHIP for those UI checks |

The connector browser test used a synthetic Verity HTTP fixture and a real disposable Rental SQLite database. Verity's SQL/API tests were separate. This does not establish a live connection between the two deployed apps, real Supabase authentication or production provider reconciliation.

## Before a live release

Apply both migration chains, configure the server origins and stable authentication secret, deploy the changes in both repositories, then create a scoped token from Verity and validate with the intended owner's accounts. Follow the [setup guide](verity-connector-setup.md).

The dependency audit was reduced from 46 advisories (including five critical) to 11 (10 high, 1 low, no critical). The remaining findings include tooling dependency chains. Some automatic remedies suggest incompatible package downgrades; they were not forced. Review those advisories before a production release. The exact audit is retained locally in `work/dependency-final.json`.

Version 1 uses manual complete imports, supports EUR allocations and limits one import to 10,000 transactions. It has no recurring auto-match rules or foreign-currency allocation conversion. Utility bills must already exist in Rental. The local preview uses sample rental data and has no live Verity connection.
