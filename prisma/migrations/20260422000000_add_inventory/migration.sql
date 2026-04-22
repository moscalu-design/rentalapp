-- CreateTable
CREATE TABLE "RoomInventoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'FURNITURE',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "estimatedValue" REAL,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RoomInventoryItem_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryInspection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "occupancyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryInspection_occupancyId_fkey" FOREIGN KEY ("occupancyId") REFERENCES "Occupancy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryInspectionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inspectionId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryInspectionItem_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "InventoryInspection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryInspectionItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "RoomInventoryItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryInspectionItem_inspectionId_inventoryItemId_key" ON "InventoryInspectionItem"("inspectionId", "inventoryItemId");
