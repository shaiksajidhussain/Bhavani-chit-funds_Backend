-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "durationType" "DurationType" NOT NULL DEFAULT 'MONTHS',
ADD COLUMN     "lastDate" TIMESTAMP(3),
ADD COLUMN     "photo" TEXT;
