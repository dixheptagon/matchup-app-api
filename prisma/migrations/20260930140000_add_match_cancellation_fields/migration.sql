-- Track soft-cancellation of live matches
ALTER TABLE "SessionMatch" ADD COLUMN "cancelReason" TEXT;
ALTER TABLE "SessionMatch" ADD COLUMN "cancelledAt" TIMESTAMP(3);