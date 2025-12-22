-- CreateEnum
CREATE TYPE "GuestCheckMode" AS ENUM ('STRICT', 'PRIMARY_ONLY', 'ANY_APPROVED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "guestCheckMode" "GuestCheckMode" NOT NULL DEFAULT 'STRICT';
ALTER TABLE "users" ADD COLUMN "guestCancelMessage" TEXT NOT NULL DEFAULT 'This meeting was cancelled because one or more guest emails are not on the approved list. Please re-book without unapproved guests, or contact the host to have them added.';

