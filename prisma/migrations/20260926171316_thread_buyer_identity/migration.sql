-- AlterTable
ALTER TABLE "threads" ADD COLUMN     "buyerId" TEXT;

-- CreateIndex
CREATE INDEX "threads_buyerId_idx" ON "threads"("buyerId");

-- AddForeignKey
ALTER TABLE "threads" ADD CONSTRAINT "threads_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One relay thread per buyer per item, enforced by the database rather than by
-- application code. A buyer asking a second question continues their existing
-- conversation; two questions sent at the same moment produce one thread and
-- one constraint violation, which the route handler turns into a conflict.
--
-- Partial because it applies to relay threads only: a direct thread hangs off
-- an order, and a buyer may have several orders for different items. Prisma's
-- schema language cannot express a partial unique index, so this is raw DDL.
-- ADR-0002, and the same technique as orders_one_active_per_item.
CREATE UNIQUE INDEX "threads_one_relay_per_buyer_per_item"
    ON "threads" ("itemId", "buyerId")
    WHERE "threadType" = 'relay';
