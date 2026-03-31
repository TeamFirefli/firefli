-- CreateTable
CREATE TABLE "SessionRoleTemplate" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" UUID,
    "hostRole" TEXT,
    "slots" INTEGER NOT NULL DEFAULT 1,
    "groupRoles" INTEGER[],
    "workspaceGroupId" INTEGER NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionRoleTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionRoleCategory" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "workspaceGroupId" INTEGER NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionRoleCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionRoleTemplate_id_key" ON "SessionRoleTemplate"("id");

-- CreateIndex
CREATE INDEX "SessionRoleTemplate_workspaceGroupId_idx" ON "SessionRoleTemplate"("workspaceGroupId");

-- CreateIndex
CREATE INDEX "SessionRoleTemplate_categoryId_idx" ON "SessionRoleTemplate"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionRoleCategory_id_key" ON "SessionRoleCategory"("id");

-- CreateIndex
CREATE INDEX "SessionRoleCategory_workspaceGroupId_idx" ON "SessionRoleCategory"("workspaceGroupId");

-- AddForeignKey
ALTER TABLE "SessionRoleTemplate" ADD CONSTRAINT "SessionRoleTemplate_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SessionRoleCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionRoleTemplate" ADD CONSTRAINT "SessionRoleTemplate_workspaceGroupId_fkey" FOREIGN KEY ("workspaceGroupId") REFERENCES "workspace"("groupId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionRoleCategory" ADD CONSTRAINT "SessionRoleCategory_workspaceGroupId_fkey" FOREIGN KEY ("workspaceGroupId") REFERENCES "workspace"("groupId") ON DELETE RESTRICT ON UPDATE CASCADE;
