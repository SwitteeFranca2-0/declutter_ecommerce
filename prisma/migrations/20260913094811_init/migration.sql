-- CreateEnum
CREATE TYPE "Role" AS ENUM ('buyer', 'seller', 'admin');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('pending_review', 'rejected', 'listed', 'on_hold', 'sold', 'completed');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('deposit_paid', 'balance_paid', 'completed', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('electronics', 'furniture', 'appliances', 'fashion', 'books', 'other');

-- CreateEnum
CREATE TYPE "Condition" AS ENUM ('like_new', 'good', 'fair');

-- CreateEnum
CREATE TYPE "ThreadType" AS ENUM ('relay', 'direct');

-- CreateEnum
CREATE TYPE "ThreadStatus" AS ENUM ('open', 'locked');

-- CreateEnum
CREATE TYPE "MessageVisibility" AS ENUM ('both', 'admin_only', 'buyer_and_admin', 'seller_and_admin');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('due', 'paid');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "condition" "Condition" NOT NULL,
    "sellerPayoutAmount" DECIMAL(12,2) NOT NULL,
    "listedPrice" DECIMAL(12,2) NOT NULL,
    "status" "ItemStatus" NOT NULL DEFAULT 'pending_review',
    "rejectionReason" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_images" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "item_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "depositAmount" DECIMAL(12,2) NOT NULL,
    "balanceAmount" DECIMAL(12,2) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'deposit_paid',
    "pinHash" TEXT,
    "pinIssuedAt" TIMESTAMP(3),
    "pinRedeemedAt" TIMESTAMP(3),
    "holdExpiresAt" TIMESTAMP(3) NOT NULL,
    "meetupLat" DOUBLE PRECISION,
    "meetupLng" DOUBLE PRECISION,
    "meetupLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "threads" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "orderId" TEXT,
    "threadType" "ThreadType" NOT NULL,
    "status" "ThreadStatus" NOT NULL DEFAULT 'open',
    "lockedReason" TEXT,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibleTo" "MessageVisibility" NOT NULL DEFAULT 'both',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'due',
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "items_status_category_idx" ON "items"("status", "category");

-- CreateIndex
CREATE INDEX "items_sellerId_idx" ON "items"("sellerId");

-- CreateIndex
CREATE INDEX "item_images_itemId_idx" ON "item_images"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "item_images_itemId_sortOrder_key" ON "item_images"("itemId", "sortOrder");

-- CreateIndex
CREATE INDEX "orders_buyerId_idx" ON "orders"("buyerId");

-- CreateIndex
CREATE INDEX "orders_itemId_idx" ON "orders"("itemId");

-- CreateIndex
CREATE INDEX "threads_itemId_idx" ON "threads"("itemId");

-- CreateIndex
CREATE INDEX "threads_orderId_idx" ON "threads"("orderId");

-- CreateIndex
CREATE INDEX "messages_threadId_createdAt_idx" ON "messages"("threadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_orderId_key" ON "payouts"("orderId");

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_images" ADD CONSTRAINT "item_images_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threads" ADD CONSTRAINT "threads_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threads" ADD CONSTRAINT "threads_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One active order per item, enforced by the database rather than by
-- application code. Two concurrent deposit attempts against the same item must
-- result in exactly one success and one constraint violation, which the route
-- handler turns into a 409.
--
-- Prisma's schema language cannot express a partial unique index, so this is
-- raw DDL. It is the single most important index in the project. PRD §8.
CREATE UNIQUE INDEX "orders_one_active_per_item"
    ON "orders" ("itemId")
    WHERE "status" IN ('deposit_paid', 'balance_paid');
