-- AlterTable
ALTER TABLE "allyVisit" ADD COLUMN     "description" TEXT,
ADD COLUMN     "eventType" TEXT NOT NULL DEFAULT 'visit',
ADD COLUMN     "hostRole" TEXT NOT NULL DEFAULT 'host';

-- RenameIndex
ALTER INDEX "UserQuotaCompletion_quotaId_userId_workspaceGroupId_archive_arc" RENAME TO "UserQuotaCompletion_quotaId_userId_workspaceGroupId_archive_key";
