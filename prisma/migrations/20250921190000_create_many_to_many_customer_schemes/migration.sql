-- CreateTable
CREATE TABLE "customer_schemes" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "amountPerDay" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "durationType" "DurationType" NOT NULL DEFAULT 'MONTHS',
    "startDate" TIMESTAMP(3) NOT NULL,
    "lastDate" TIMESTAMP(3),
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_schemes_pkey" PRIMARY KEY ("id")
);

-- Migrate existing customer-scheme relationships
INSERT INTO "customer_schemes" (
    "id",
    "customerId", 
    "schemeId",
    "enrolledAt",
    "status",
    "amountPerDay",
    "duration",
    "durationType",
    "startDate",
    "lastDate",
    "balance",
    "createdAt",
    "updatedAt"
)
SELECT 
    gen_random_uuid()::text as "id",
    "id" as "customerId",
    "schemeId",
    "createdAt" as "enrolledAt",
    "status",
    "amountPerDay",
    "duration",
    "durationType",
    "startDate",
    "lastDate",
    "balance",
    "createdAt",
    "updatedAt"
FROM "customers"
WHERE "schemeId" IS NOT NULL;

-- Add customerSchemeId to passbook_entries
ALTER TABLE "passbook_entries" ADD COLUMN "customerSchemeId" TEXT;

-- Update passbook_entries with customerSchemeId
UPDATE "passbook_entries" 
SET "customerSchemeId" = (
    SELECT cs."id" 
    FROM "customer_schemes" cs 
    WHERE cs."customerId" = "passbook_entries"."customerId"
    LIMIT 1
);

-- Make customerSchemeId required
ALTER TABLE "passbook_entries" ALTER COLUMN "customerSchemeId" SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE "passbook_entries" ADD CONSTRAINT "passbook_entries_customerSchemeId_fkey" FOREIGN KEY ("customerSchemeId") REFERENCES "customer_schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Remove old foreign key constraint
ALTER TABLE "passbook_entries" DROP CONSTRAINT "passbook_entries_customerId_fkey";

-- Remove old customerId column
ALTER TABLE "passbook_entries" DROP COLUMN "customerId";

-- Add unique constraint
ALTER TABLE "customer_schemes" ADD CONSTRAINT "customer_schemes_customerId_schemeId_key" UNIQUE ("customerId", "schemeId");

-- Add foreign key constraints
ALTER TABLE "customer_schemes" ADD CONSTRAINT "customer_schemes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_schemes" ADD CONSTRAINT "customer_schemes_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "chit_schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Remove schemeId from customers
ALTER TABLE "customers" DROP COLUMN "schemeId";
