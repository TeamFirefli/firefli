-- AlterTable
ALTER TABLE "_ContainerToDepartment" ADD CONSTRAINT "_ContainerToDepartment_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_ContainerToDepartment_AB_unique";

-- AlterTable
ALTER TABLE "_ContainerToRole" ADD CONSTRAINT "_ContainerToRole_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_ContainerToRole_AB_unique";

-- AlterTable
ALTER TABLE "_DocumentToContainer" ADD CONSTRAINT "_DocumentToContainer_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_DocumentToContainer_AB_unique";

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "setOOBE" BOOLEAN;
