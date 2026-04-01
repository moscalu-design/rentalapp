-- CreateTable
CREATE TABLE "MortgagePrepayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mortgageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "frequency" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MortgagePrepayment_mortgageId_fkey" FOREIGN KEY ("mortgageId") REFERENCES "Mortgage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
