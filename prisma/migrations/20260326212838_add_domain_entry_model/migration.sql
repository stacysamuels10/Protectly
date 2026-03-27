-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'ADD_DOMAIN';
ALTER TYPE "AuditAction" ADD VALUE 'REMOVE_DOMAIN';

-- CreateTable
CREATE TABLE "domain_entries" (
    "id" TEXT NOT NULL,
    "allowlistId" TEXT NOT NULL,
    "domain" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domain_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "domain_entries_domain_idx" ON "domain_entries"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "domain_entries_allowlistId_domain_key" ON "domain_entries"("allowlistId", "domain");

-- AddForeignKey
ALTER TABLE "domain_entries" ADD CONSTRAINT "domain_entries_allowlistId_fkey" FOREIGN KEY ("allowlistId") REFERENCES "allowlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
