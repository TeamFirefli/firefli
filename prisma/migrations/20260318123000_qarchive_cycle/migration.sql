-- AlterTable
ALTER TABLE "UserQuotaCompletion"
ADD COLUMN "archiveCycleId" TEXT NOT NULL DEFAULT 'active';

-- DropIndex
DROP INDEX IF EXISTS "UserQuotaCompletion_quotaId_userId_workspaceGroupId_archive_key";

-- Deduplicate rows before creating unique constraint
DELETE FROM "UserQuotaCompletion"
WHERE "id" NOT IN (
    SELECT DISTINCT ON ("quotaId", "userId", "workspaceGroupId", "archived") "id"
    FROM "UserQuotaCompletion"
    ORDER BY "quotaId", "userId", "workspaceGroupId", "archived",
             "completedAt" DESC NULLS LAST, "id" DESC
);

-- CreateIndex
CREATE UNIQUE INDEX "UserQuotaCompletion_quotaId_userId_workspaceGroupId_archive_archiveCycleId_key"
ON "UserQuotaCompletion"("quotaId", "userId", "workspaceGroupId", "archived", "archiveCycleId");
