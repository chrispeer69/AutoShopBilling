-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'TECH');
CREATE TYPE "DocKind" AS ENUM ('ESTIMATE', 'WORKORDER', 'INVOICE');
CREATE TYPE "DocStatus" AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'DECLINED', 'CONVERTED', 'OPEN', 'PARTIAL', 'PAID', 'VOID');
CREATE TYPE "ItemType" AS ENUM ('PART', 'LABOR', 'FEE');
CREATE TYPE "FollowUpStatus" AS ENUM ('OPEN', 'DONE');

-- CreateTable Shop
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 7.25,
    "laborRate" INTEGER NOT NULL DEFAULT 12000,
    "invoiceFooter" TEXT NOT NULL DEFAULT 'Thank you for your business!',
    "suppliesPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "suppliesCapCents" INTEGER NOT NULL DEFAULT 0,
    "partsMarkupPct" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "cardSurchargePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "smtpHost" TEXT NOT NULL DEFAULT '',
    "smtpPort" INTEGER NOT NULL DEFAULT 587,
    "smtpUser" TEXT NOT NULL DEFAULT '',
    "smtpPassEnc" TEXT NOT NULL DEFAULT '',
    "smtpFrom" TEXT NOT NULL DEFAULT '',
    "stripeSecretEnc" TEXT NOT NULL DEFAULT '',
    "stripeWebhookSecretEnc" TEXT NOT NULL DEFAULT '',
    "twilioSid" TEXT NOT NULL DEFAULT '',
    "twilioTokenEnc" TEXT NOT NULL DEFAULT '',
    "twilioFrom" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable User
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'TECH',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable Customer
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable Vehicle
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "year" TEXT NOT NULL DEFAULT '',
    "make" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "engine" TEXT NOT NULL DEFAULT '',
    "vin" TEXT NOT NULL DEFAULT '',
    "plate" TEXT NOT NULL DEFAULT '',
    "mileage" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable Doc
CREATE TABLE "Doc" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "kind" "DocKind" NOT NULL,
    "number" TEXT NOT NULL,
    "status" "DocStatus" NOT NULL DEFAULT 'DRAFT',
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mileage" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "taxEnabled" BOOLEAN NOT NULL DEFAULT false,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "suppliesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "suppliesPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "suppliesCapCents" INTEGER NOT NULL DEFAULT 0,
    "publicToken" TEXT NOT NULL,
    "approvedName" TEXT NOT NULL DEFAULT '',
    "approvedAt" TIMESTAMP(3),
    "approvedIp" TEXT NOT NULL DEFAULT '',
    "signaturePng" TEXT NOT NULL DEFAULT '',
    "declineNote" TEXT NOT NULL DEFAULT '',
    "paymentLinkUrl" TEXT NOT NULL DEFAULT '',
    "convertedFromId" TEXT,
    "emailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Doc_pkey" PRIMARY KEY ("id")
);

-- CreateTable LineItem
CREATE TABLE "LineItem" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "type" "ItemType" NOT NULL DEFAULT 'PART',
    "description" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL DEFAULT '',
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPriceCents" INTEGER NOT NULL DEFAULT 0,
    "costCents" INTEGER,
    "techId" TEXT,
    "declined" BOOLEAN NOT NULL DEFAULT false,
    "sort" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "LineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable Payment
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'Cash',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT NOT NULL DEFAULT '',
    "stripeRef" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable PartItem
CREATE TABLE "PartItem" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "qtyOnHand" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable CannedJob
CREATE TABLE "CannedJob" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CannedJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable CannedJobItem
CREATE TABLE "CannedJobItem" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "type" "ItemType" NOT NULL DEFAULT 'PART',
    "description" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL DEFAULT '',
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPriceCents" INTEGER NOT NULL DEFAULT 0,
    "costCents" INTEGER,
    "sort" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CannedJobItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable FollowUp
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable AuditLog
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT '',
    "userName" TEXT NOT NULL DEFAULT '',
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL DEFAULT '',
    "entityId" TEXT NOT NULL DEFAULT '',
    "meta" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable DailyCounter
CREATE TABLE "DailyCounter" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "kind" "DocKind" NOT NULL,
    "dateKey" TEXT NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "DailyCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_shopId_idx" ON "User"("shopId");
CREATE INDEX "Customer_shopId_idx" ON "Customer"("shopId");
CREATE INDEX "Vehicle_shopId_idx" ON "Vehicle"("shopId");
CREATE INDEX "Vehicle_customerId_idx" ON "Vehicle"("customerId");
CREATE UNIQUE INDEX "Doc_publicToken_key" ON "Doc"("publicToken");
CREATE UNIQUE INDEX "Doc_convertedFromId_key" ON "Doc"("convertedFromId");
CREATE UNIQUE INDEX "Doc_shopId_number_key" ON "Doc"("shopId", "number");
CREATE INDEX "Doc_shopId_kind_idx" ON "Doc"("shopId", "kind");
CREATE INDEX "Doc_customerId_idx" ON "Doc"("customerId");
CREATE INDEX "LineItem_docId_idx" ON "LineItem"("docId");
CREATE INDEX "Payment_docId_idx" ON "Payment"("docId");
CREATE UNIQUE INDEX "PartItem_shopId_partNumber_key" ON "PartItem"("shopId", "partNumber");
CREATE INDEX "PartItem_shopId_idx" ON "PartItem"("shopId");
CREATE INDEX "CannedJob_shopId_idx" ON "CannedJob"("shopId");
CREATE INDEX "CannedJobItem_jobId_idx" ON "CannedJobItem"("jobId");
CREATE INDEX "FollowUp_shopId_status_idx" ON "FollowUp"("shopId", "status");
CREATE INDEX "AuditLog_shopId_createdAt_idx" ON "AuditLog"("shopId", "createdAt");
CREATE UNIQUE INDEX "DailyCounter_shopId_kind_dateKey_key" ON "DailyCounter"("shopId", "kind", "dateKey");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Doc" ADD CONSTRAINT "Doc_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Doc" ADD CONSTRAINT "Doc_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Doc" ADD CONSTRAINT "Doc_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Doc" ADD CONSTRAINT "Doc_convertedFromId_fkey" FOREIGN KEY ("convertedFromId") REFERENCES "Doc"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LineItem" ADD CONSTRAINT "LineItem_docId_fkey" FOREIGN KEY ("docId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LineItem" ADD CONSTRAINT "LineItem_techId_fkey" FOREIGN KEY ("techId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_docId_fkey" FOREIGN KEY ("docId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartItem" ADD CONSTRAINT "PartItem_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CannedJob" ADD CONSTRAINT "CannedJob_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CannedJobItem" ADD CONSTRAINT "CannedJobItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CannedJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailyCounter" ADD CONSTRAINT "DailyCounter_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
