-- AlterTable
ALTER TABLE "SessionRoleCategory" ADD COLUMN     "weight" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SessionRoleTemplate" ADD COLUMN     "weight" INTEGER NOT NULL DEFAULT 0;
