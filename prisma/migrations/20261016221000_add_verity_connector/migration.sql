-- CreateTable
CREATE TABLE "VerityConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "remoteOwnerId" TEXT NOT NULL,
    "remoteConnectionId" TEXT NOT NULL,
    "encryptedToken" TEXT,
    "accountsJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "revokePending" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" DATETIME,
    "lastError" TEXT,
    "contextLeaseToken" TEXT,
    "contextLeaseUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VerityConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerityTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "postedDate" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "counterpartyName" TEXT,
    "counterpartyIban" TEXT,
    "sourceKey" TEXT,
    "sourceUpdatedAt" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "originalJson" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "reviewReason" TEXT,
    "sourceMissing" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VerityTransaction_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "VerityConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerityAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetLabel" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "propertyName" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "sourceSnapshotJson" TEXT NOT NULL,
    "ledgerBeforeJson" TEXT,
    "ledgerAfterJson" TEXT,
    "contextPayloadJson" TEXT NOT NULL,
    "contextStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "contextOperation" TEXT NOT NULL DEFAULT 'UPSERT',
    "contextVersion" INTEGER NOT NULL DEFAULT 1,
    "contextAttempts" INTEGER NOT NULL DEFAULT 0,
    "contextError" TEXT,
    "contextSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "undoneAt" DATETIME,
    CONSTRAINT "VerityAllocation_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "VerityTransaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "VerityConnection_userId_key" ON "VerityConnection"("userId");

-- CreateIndex
CREATE INDEX "VerityTransaction_connectionId_status_idx" ON "VerityTransaction"("connectionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "VerityTransaction_userId_externalId_key" ON "VerityTransaction"("userId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "VerityTransaction_userId_sourceKey_key" ON "VerityTransaction"("userId", "sourceKey");

-- CreateIndex
CREATE INDEX "VerityAllocation_userId_kind_targetId_status_idx" ON "VerityAllocation"("userId", "kind", "targetId", "status");

-- CreateIndex
CREATE INDEX "VerityAllocation_userId_contextStatus_idx" ON "VerityAllocation"("userId", "contextStatus");

-- CreateIndex
CREATE UNIQUE INDEX "VerityAllocation_userId_idempotencyKey_key" ON "VerityAllocation"("userId", "idempotencyKey");


CREATE UNIQUE INDEX "VerityConnection_remoteOwnerId_key" ON "VerityConnection"("remoteOwnerId");
