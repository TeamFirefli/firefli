-- CreateTable
CREATE TABLE "ModerationCase" (
    "id" UUID NOT NULL,
    "workspaceGroupId" BIGINT NOT NULL,
    "targetUserId" BIGINT NOT NULL,
    "targetUsername" TEXT,
    "reportedBy" BIGINT,
    "createdBy" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "action" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" BIGINT,
    "expiresAt" TIMESTAMP(3),
    "internalNotes" TEXT,
    "publicNote" TEXT,
    "banDuration" INTEGER,
    "isPermanent" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" BIGINT,
    "revokeReason" TEXT,

    CONSTRAINT "ModerationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationEvidence" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "uploadedBy" BIGINT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationLog" (
    "id" UUID NOT NULL,
    "workspaceGroupId" BIGINT NOT NULL,
    "actionBy" BIGINT NOT NULL,
    "action" TEXT NOT NULL,
    "targetUser" BIGINT,
    "targetUsername" TEXT,
    "caseId" UUID,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModerationCase_workspaceGroupId_status_idx" ON "ModerationCase"("workspaceGroupId", "status");

-- CreateIndex
CREATE INDEX "ModerationCase_targetUserId_workspaceGroupId_idx" ON "ModerationCase"("targetUserId", "workspaceGroupId");

-- CreateIndex
CREATE INDEX "ModerationCase_createdAt_idx" ON "ModerationCase"("createdAt");

-- CreateIndex
CREATE INDEX "ModerationEvidence_caseId_idx" ON "ModerationEvidence"("caseId");

-- CreateIndex
CREATE INDEX "ModerationEvidence_uploadedBy_idx" ON "ModerationEvidence"("uploadedBy");

-- CreateIndex
CREATE INDEX "ModerationLog_workspaceGroupId_createdAt_idx" ON "ModerationLog"("workspaceGroupId", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationLog_actionBy_idx" ON "ModerationLog"("actionBy");

-- CreateIndex
CREATE INDEX "ModerationLog_targetUser_idx" ON "ModerationLog"("targetUser");

-- AddForeignKey
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_workspaceGroupId_fkey" FOREIGN KEY ("workspaceGroupId") REFERENCES "workspace"("groupId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "user"("userid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("userid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "user"("userid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_reportedBy_fkey" FOREIGN KEY ("reportedBy") REFERENCES "user"("userid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_revokedBy_fkey" FOREIGN KEY ("revokedBy") REFERENCES "user"("userid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationEvidence" ADD CONSTRAINT "ModerationEvidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ModerationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationEvidence" ADD CONSTRAINT "ModerationEvidence_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "user"("userid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationLog" ADD CONSTRAINT "ModerationLog_workspaceGroupId_fkey" FOREIGN KEY ("workspaceGroupId") REFERENCES "workspace"("groupId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationLog" ADD CONSTRAINT "ModerationLog_actionBy_fkey" FOREIGN KEY ("actionBy") REFERENCES "user"("userid") ON DELETE RESTRICT ON UPDATE CASCADE;
