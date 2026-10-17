# Set up the Verity connector

The connector is implemented. The production release applies the reviewed additive migrations before use. This guide covers configuration, account linking and first use. The [integration contract](verity-integration.md) explains the financial behavior and limits.

## Configure the servers

Keep the applications' databases and authentication separate. Rental needs the following server environment values:

| Variable | Value and purpose |
| --- | --- |
| `DATABASE_URL` | Rental's existing SQLite/LibSQL database URL; use a dedicated local database for testing |
| `DATABASE_AUTH_TOKEN` | LibSQL authentication token when the selected remote database requires it |
| `AUTH_SECRET` | A stable secret of at least 32 characters, also used to derive the encryption key for saved Verity tokens |
| `AUTH_URL` | Rental's own externally visible authentication origin; the existing local test configuration also sets `NEXTAUTH_URL` to the same origin |
| `VERITY_API_BASE_URL` | Verity's origin only, for example `https://verity.example.com`; do not append `/api` or another path |

`VERITY_API_BASE_URL` must use HTTPS. Only nonproduction execution permits HTTP for `localhost`, `127.0.0.1` or `[::1]`. Credentials, query strings and fragments are rejected, and redirects are not followed. A browser on one hostname should not submit mutations to an alias hostname: Rental requires an exact same-origin `Origin` header.

Preserve `AUTH_SECRET` across restarts and deployments alongside the database. Connector tokens are encrypted with AES-256-GCM and bound to the local user ID. Changing the secret makes existing saved tokens unreadable; plan explicit token revocation/reconnection when rotating it. Do not expose this secret, the LibSQL token or the Verity connection key through `NEXT_PUBLIC_` variables or logs. The Verity key is entered through Rental's connection form, not an environment variable.

Verity retains its existing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and server `DATABASE_URL` configuration. Its integration queries run through the direct server database client with explicit ownership checks. Rental does not need Verity's Supabase service-role key, database credentials, provider credentials or browser cookies.

## Apply both migration chains

1. **Verity:** apply `supabase/migrations/20261016191159_rental_app_integration.sql` after its existing migrations, including the unified-bank-ledger migration. Use the intended environment's normal migration process. The connector creates server-only connection, account-scope and context tables, enables RLS, revokes public/anonymous/authenticated access and grants table access to `service_role`. It depends on the existing owned-account constraint.
2. **Rental:** apply `prisma/migrations/20261016221000_add_verity_connector/migration.sql` after the existing migration chain, then regenerate Prisma. For a dedicated local SQLite database, set `DATABASE_URL` to that database and run `npx prisma migrate deploy` followed by `npx prisma generate` from the Rental repository. For hosted LibSQL, apply the migration through that environment's existing LibSQL migration procedure; generating the Prisma client alone does not change the database.
3. Start or rebuild both applications with their configured environments. For a development pair, run them on different loopback ports and set `VERITY_API_BASE_URL` to Verity's actual origin.

These instructions do not apply migrations to any live environment. Keep local fixture databases separate from existing rental and bank data; production release requires the same migration/configuration preparation and a deployment of both applications.

## Create and connect a token

1. Sign in to Verity and open `/integrations/rental` (**Rental App connection**).
2. Select the accounts to share and an expiry of 7, 30 or 90 days. Create the connection and copy the token while it is displayed. Verity stores only its hash and display prefix; the full token is shown on creation and is not saved to browser localStorage.
3. Sign in to Rental, open **Settings → Verity connection** at `/settings/verity`, paste the token and select **Connect Verity**.
4. Select **Import transactions**. The complete selected-account snapshot must fit within 10,000 transactions. Non-EUR transactions are visible but cannot be allocated.
5. Review each bank line and select **Match**. Choose the target and amount; a connection/import alone does not post money.

Both accounts must belong to the intended person. Rental binds the returned Verity owner ID, not an email address. Changing the Verity owner of an existing Rental connection is deliberately blocked.

## Confirm the three supported payment types

- **Rent received:** choose the tenancy and rent period. Select **Already recorded — link evidence only** for rent already included in the cumulative paid amount. Link all existing manual money first. Select **Not recorded yet — add this receipt** only for a new receipt. A split may cover multiple periods or properties, within the bank amount and each period's remaining due.
- **Utility or property cost:** create the bill in the property's Costs page first, with its real reporting month and service period. Select **Utility or property cost** and the existing bill. Matching supplies payment evidence; it does not create another expense or change the service period.
- **Mortgage payment:** select the property's mortgage. This records an actual bank payment shown on the mortgage detail page. It does not revise loan terms, forecast principal/interest, or modeled prepayments.

If Verity metadata delivery fails, Rental displays an update pending. Use **Retry pending updates**; do not record the same receipt manually. Use **All imported transactions** to find fully matched lines. **Undo match** reverses the allocation according to the safety checks; undo split rent receipts in reverse order.

## Renew, disconnect or resolve a failure

Use **Disconnect → Confirm disconnect** in Rental before replacing a token. Existing imported evidence and rental records are retained. Rental revokes the old key remotely; already inactive keys are accepted as revoked. If access cannot be reached, use **Retry revocation**. Reconnection waits for that revocation to complete. You can also revoke the token directly in Verity, then retry revocation in Rental.

Create a replacement token for the same Verity owner, reconnect and import again. A fresh snapshot is required before confirming new allocations or replaying retained context. Accounts omitted from the replacement scope do not receive replayed context; affected retained allocations remain for review.

| Message or state | Action |
| --- | --- |
| Server setup required | Configure `VERITY_API_BASE_URL` and apply both migration chains |
| Token verification failed | Check the correct Verity origin, token and expiry; authenticate in each application independently |
| More than 10,000 transactions | Reconnect using a smaller account selection |
| Source changed / needs review | Inspect the source and affected matches; undo safely and import again as appropriate. Money is not automatically reversed |
| Unsupported currency | Keep the transaction unallocated; version 1 supports EUR only |
| Rent contains unlinked paid money | Match the existing recorded receipt before adding new money |
| Ledger changed since receipt | Review the later financial edit or dependent match; automatic undo cannot overwrite it |
| Pending update | Retry metadata delivery; the Rental confirmation is already saved |

## Local verification

From the Rental repository, run `npx vitest run src/lib/verity/__tests__/service.test.ts src/lib/__tests__/verity-transport.test.ts`. From the Verity repository, run `npx vitest run tests/unit/rental-integration.test.ts tests/unit/rental-connection-ui.test.tsx`.

The recorded local browser exercise used synthetic source data and passed all three allocation types, duplicate retry and repeated import, with three confirmed allocations, three remote context records and no page errors. It does not establish production database readiness or live bank reconciliation.

## Rental production release migration

The production build runs `scripts/prepare-verity-release.mjs`. It applies only the connector migration when `VERITY_APPLY_MIGRATION=20261016221000` is explicitly configured. The operation is transactional, refuses partial schemas, verifies all expected columns and indexes, and never seeds or alters existing rental records. Remove this flag after the successful release. Production builds with the connector configured also validate the HTTPS origins and stable authentication secret.
