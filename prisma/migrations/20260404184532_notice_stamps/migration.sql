-- AlterTable
ALTER TABLE "inactivityNotice" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "reviewedByUserId" BIGINT,
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "revokedByUserId" BIGINT;
