-- CreateEnum
CREATE TYPE "PaymentFrequency" AS ENUM ('DAILY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('DAILY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ChitLiftingStatus" AS ENUM ('YES', 'NO');

-- AlterTable
ALTER TABLE "chit_schemes" ADD COLUMN     "paymentType" "PaymentType" NOT NULL DEFAULT 'DAILY',
ALTER COLUMN "dailyPayment" DROP NOT NULL;

-- AlterTable
ALTER TABLE "passbook_entries" ADD COLUMN     "chitLifting" "ChitLiftingStatus" NOT NULL DEFAULT 'NO',
ADD COLUMN     "paymentFrequency" "PaymentFrequency" NOT NULL DEFAULT 'DAILY',
ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH';
