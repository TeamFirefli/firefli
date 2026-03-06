-- AlterTable
ALTER TABLE "DiscordIntegration" ADD COLUMN     "sessionReviewEmbedColor" TEXT,
ADD COLUMN     "sessionReviewEmbedDescription" TEXT,
ADD COLUMN     "sessionReviewEmbedFooter" TEXT,
ADD COLUMN     "sessionReviewEmbedTitle" TEXT;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "banReason" TEXT,
ADD COLUMN     "banned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bannedAt" TIMESTAMP(3),
ADD COLUMN     "bannedBy" TEXT;

-- CreateTable
CREATE TABLE "GameServer" (
    "id" UUID NOT NULL,
    "jobId" TEXT NOT NULL,
    "placeId" BIGINT NOT NULL,
    "workspaceGroupId" INTEGER NOT NULL,
    "players" JSONB NOT NULL,
    "playerCount" INTEGER NOT NULL,
    "maxPlayers" INTEGER NOT NULL,
    "lastHeartbeat" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameServer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemoteCommand" (
    "id" UUID NOT NULL,
    "workspaceGroupId" INTEGER NOT NULL,
    "jobId" TEXT NOT NULL,
    "commandType" TEXT NOT NULL,
    "targetUserId" BIGINT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "issuedById" BIGINT NOT NULL,
    "executedAt" TIMESTAMP(3),
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemoteCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerBan" (
    "id" UUID NOT NULL,
    "workspaceGroupId" INTEGER NOT NULL,
    "userId" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "bannedById" BIGINT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "duration" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unbannedAt" TIMESTAMP(3),
    "unbannedById" BIGINT,

    CONSTRAINT "PlayerBan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerReport" (
    "id" UUID NOT NULL,
    "workspaceGroupId" INTEGER NOT NULL,
    "reporterUserId" BIGINT NOT NULL,
    "reportedUserId" BIGINT,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "jobId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedById" BIGINT,
    "reviewNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminMessageLog" (
    "id" UUID NOT NULL,
    "workspaceGroupId" INTEGER NOT NULL,
    "sentById" BIGINT NOT NULL,
    "targetUserId" BIGINT,
    "message" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminMessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameServer_workspaceGroupId_active_idx" ON "GameServer"("workspaceGroupId", "active");

-- CreateIndex
CREATE INDEX "GameServer_lastHeartbeat_idx" ON "GameServer"("lastHeartbeat");

-- CreateIndex
CREATE UNIQUE INDEX "GameServer_workspaceGroupId_jobId_key" ON "GameServer"("workspaceGroupId", "jobId");

-- CreateIndex
CREATE INDEX "RemoteCommand_workspaceGroupId_jobId_status_idx" ON "RemoteCommand"("workspaceGroupId", "jobId", "status");

-- CreateIndex
CREATE INDEX "RemoteCommand_workspaceGroupId_createdAt_idx" ON "RemoteCommand"("workspaceGroupId", "createdAt");

-- CreateIndex
CREATE INDEX "PlayerBan_workspaceGroupId_userId_active_idx" ON "PlayerBan"("workspaceGroupId", "userId", "active");

-- CreateIndex
CREATE INDEX "PlayerBan_workspaceGroupId_active_idx" ON "PlayerBan"("workspaceGroupId", "active");

-- CreateIndex
CREATE INDEX "PlayerReport_workspaceGroupId_status_idx" ON "PlayerReport"("workspaceGroupId", "status");

-- CreateIndex
CREATE INDEX "PlayerReport_workspaceGroupId_createdAt_idx" ON "PlayerReport"("workspaceGroupId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminMessageLog_workspaceGroupId_createdAt_idx" ON "AdminMessageLog"("workspaceGroupId", "createdAt");

-- AddForeignKey
ALTER TABLE "GameServer" ADD CONSTRAINT "GameServer_workspaceGroupId_fkey" FOREIGN KEY ("workspaceGroupId") REFERENCES "workspace"("groupId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteCommand" ADD CONSTRAINT "RemoteCommand_workspaceGroupId_fkey" FOREIGN KEY ("workspaceGroupId") REFERENCES "workspace"("groupId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerBan" ADD CONSTRAINT "PlayerBan_workspaceGroupId_fkey" FOREIGN KEY ("workspaceGroupId") REFERENCES "workspace"("groupId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerReport" ADD CONSTRAINT "PlayerReport_workspaceGroupId_fkey" FOREIGN KEY ("workspaceGroupId") REFERENCES "workspace"("groupId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminMessageLog" ADD CONSTRAINT "AdminMessageLog_workspaceGroupId_fkey" FOREIGN KEY ("workspaceGroupId") REFERENCES "workspace"("groupId") ON DELETE RESTRICT ON UPDATE CASCADE;
