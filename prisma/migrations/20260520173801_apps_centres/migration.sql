-- CreateTable
CREATE TABLE "ApplicationForm" (
    "id" UUID NOT NULL,
    "workspaceGroupId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "passingScore" INTEGER,
    "maxAttempts" INTEGER,
    "cooldownMinutes" INTEGER,
    "requireManualReview" BOOLEAN NOT NULL DEFAULT false,
    "allowRetake" BOOLEAN NOT NULL DEFAULT true,
    "rankActionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "passRankId" BIGINT,
    "requiredRankId" BIGINT,
    "createdById" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationQuestion" (
    "id" UUID NOT NULL,
    "formId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "points" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationSubmission" (
    "id" UUID NOT NULL,
    "formId" UUID NOT NULL,
    "workspaceGroupId" BIGINT NOT NULL,
    "userId" BIGINT NOT NULL,
    "username" TEXT,
    "answers" JSONB NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "maxScore" INTEGER NOT NULL DEFAULT 0,
    "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "markingBreakdown" JSONB NOT NULL,
    "rankActionResult" JSONB,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" BIGINT,

    CONSTRAINT "ApplicationSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApplicationForm_workspaceGroupId_idx" ON "ApplicationForm"("workspaceGroupId");

-- CreateIndex
CREATE INDEX "ApplicationForm_workspaceGroupId_enabled_idx" ON "ApplicationForm"("workspaceGroupId", "enabled");

-- CreateIndex
CREATE INDEX "ApplicationQuestion_formId_order_idx" ON "ApplicationQuestion"("formId", "order");

-- CreateIndex
CREATE INDEX "ApplicationSubmission_formId_userId_idx" ON "ApplicationSubmission"("formId", "userId");

-- CreateIndex
CREATE INDEX "ApplicationSubmission_workspaceGroupId_userId_idx" ON "ApplicationSubmission"("workspaceGroupId", "userId");

-- CreateIndex
CREATE INDEX "ApplicationSubmission_submittedAt_idx" ON "ApplicationSubmission"("submittedAt");

-- CreateIndex
CREATE INDEX "ApplicationSubmission_formId_status_idx" ON "ApplicationSubmission"("formId", "status");

-- AddForeignKey
ALTER TABLE "ApplicationForm" ADD CONSTRAINT "ApplicationForm_workspaceGroupId_fkey" FOREIGN KEY ("workspaceGroupId") REFERENCES "workspace"("groupId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationQuestion" ADD CONSTRAINT "ApplicationQuestion_formId_fkey" FOREIGN KEY ("formId") REFERENCES "ApplicationForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationSubmission" ADD CONSTRAINT "ApplicationSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "ApplicationForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationSubmission" ADD CONSTRAINT "ApplicationSubmission_workspaceGroupId_fkey" FOREIGN KEY ("workspaceGroupId") REFERENCES "workspace"("groupId") ON DELETE RESTRICT ON UPDATE CASCADE;
