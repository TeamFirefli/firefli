-- CreateTable
CREATE TABLE "DocumentContainer" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "workspaceGroupId" BIGINT NOT NULL,
    "ownerId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentContainer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentContainer_id_key" ON "DocumentContainer"("id");

-- CreateIndex
CREATE INDEX "DocumentContainer_workspaceGroupId_idx" ON "DocumentContainer"("workspaceGroupId");

-- CreateTable (join: documents <-> containers)
CREATE TABLE "_DocumentToContainer" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_DocumentToContainer_AB_unique" ON "_DocumentToContainer"("A", "B");
CREATE INDEX "_DocumentToContainer_B_index" ON "_DocumentToContainer"("B");

-- CreateTable (join: containers <-> departments)
CREATE TABLE "_ContainerToDepartment" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ContainerToDepartment_AB_unique" ON "_ContainerToDepartment"("A", "B");
CREATE INDEX "_ContainerToDepartment_B_index" ON "_ContainerToDepartment"("B");

-- CreateTable (join: containers <-> roles)
CREATE TABLE "_ContainerToRole" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ContainerToRole_AB_unique" ON "_ContainerToRole"("A", "B");
CREATE INDEX "_ContainerToRole_B_index" ON "_ContainerToRole"("B");

-- AddForeignKey
ALTER TABLE "DocumentContainer" ADD CONSTRAINT "DocumentContainer_workspaceGroupId_fkey" FOREIGN KEY ("workspaceGroupId") REFERENCES "workspace"("groupId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentContainer" ADD CONSTRAINT "DocumentContainer_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("userid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DocumentToContainer" ADD CONSTRAINT "_DocumentToContainer_A_fkey" FOREIGN KEY ("A") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DocumentToContainer" ADD CONSTRAINT "_DocumentToContainer_B_fkey" FOREIGN KEY ("B") REFERENCES "DocumentContainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContainerToDepartment" ADD CONSTRAINT "_ContainerToDepartment_A_fkey" FOREIGN KEY ("A") REFERENCES "DocumentContainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContainerToDepartment" ADD CONSTRAINT "_ContainerToDepartment_B_fkey" FOREIGN KEY ("B") REFERENCES "department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContainerToRole" ADD CONSTRAINT "_ContainerToRole_A_fkey" FOREIGN KEY ("A") REFERENCES "DocumentContainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContainerToRole" ADD CONSTRAINT "_ContainerToRole_B_fkey" FOREIGN KEY ("B") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
