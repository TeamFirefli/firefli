-- Drop existing constraints and indexes
ALTER TABLE "_DocumentToContainer" DROP CONSTRAINT IF EXISTS "_DocumentToContainer_A_fkey";
ALTER TABLE "_DocumentToContainer" DROP CONSTRAINT IF EXISTS "_DocumentToContainer_B_fkey";
DROP INDEX IF EXISTS "_DocumentToContainer_AB_unique";
DROP INDEX IF EXISTS "_DocumentToContainer_B_index";

-- Swap column names (A <-> B)
ALTER TABLE "_DocumentToContainer" RENAME COLUMN "A" TO "_swap_tmp";
ALTER TABLE "_DocumentToContainer" RENAME COLUMN "B" TO "A";
ALTER TABLE "_DocumentToContainer" RENAME COLUMN "_swap_tmp" TO "B";

-- Recreate indexes
CREATE UNIQUE INDEX "_DocumentToContainer_AB_unique" ON "_DocumentToContainer"("A", "B");
CREATE INDEX "_DocumentToContainer_B_index" ON "_DocumentToContainer"("B");

-- Recreate foreign keys with corrected references
ALTER TABLE "_DocumentToContainer"
  ADD CONSTRAINT "_DocumentToContainer_A_fkey"
  FOREIGN KEY ("A") REFERENCES "DocumentContainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_DocumentToContainer"
  ADD CONSTRAINT "_DocumentToContainer_B_fkey"
  FOREIGN KEY ("B") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
