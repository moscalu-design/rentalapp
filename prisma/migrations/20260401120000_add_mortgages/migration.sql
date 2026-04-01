-- CreateTable
CREATE TABLE "Mortgage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "label" TEXT,
    "lender" TEXT,
    "startDate" DATETIME NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "initialBalance" REAL NOT NULL,
    "interestRate" REAL NOT NULL,
    "monthlyPayment" REAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Mortgage_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
