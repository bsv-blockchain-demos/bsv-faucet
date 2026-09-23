-- CreateEnum
CREATE TYPE "AuthMethod" AS ENUM ('email', 'wallet');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "authMethod" "AuthMethod" NOT NULL DEFAULT 'email',
ADD COLUMN     "identityKey" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- Wallet accounts have no email and store NULL. The Clerk webhook used to
-- write '' for a missing email, so convert any such row now. Postgres allows
-- any number of NULLs in a unique column, but only one ''.
UPDATE "User" SET "email" = NULL WHERE "email" = '';

-- CreateTable
CREATE TABLE "AuthNonce" (
    "nonce" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthNonce_pkey" PRIMARY KEY ("nonce")
);

-- CreateIndex
CREATE INDEX "AuthNonce_expiresAt_idx" ON "AuthNonce"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_identityKey_key" ON "User"("identityKey");

