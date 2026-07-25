-- CreateTable
CREATE TABLE "BalanceCache" (
    "address" TEXT NOT NULL,
    "balance" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BalanceCache_pkey" PRIMARY KEY ("address")
);
