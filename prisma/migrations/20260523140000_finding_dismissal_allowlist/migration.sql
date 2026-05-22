CREATE TABLE "FindingDismissal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "extensionVersion" TEXT,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FindingDismissal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExtensionDomainAllowlist" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "note" TEXT,
    "addedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtensionDomainAllowlist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FindingDismissal_userId_storeId_issueId_key" ON "FindingDismissal"("userId", "storeId", "issueId");
CREATE INDEX "FindingDismissal_userId_storeId_idx" ON "FindingDismissal"("userId", "storeId");

CREATE UNIQUE INDEX "ExtensionDomainAllowlist_storeId_domain_key" ON "ExtensionDomainAllowlist"("storeId", "domain");
CREATE INDEX "ExtensionDomainAllowlist_storeId_idx" ON "ExtensionDomainAllowlist"("storeId");

ALTER TABLE "FindingDismissal" ADD CONSTRAINT "FindingDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtensionDomainAllowlist" ADD CONSTRAINT "ExtensionDomainAllowlist_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtensionDomainAllowlist" ADD CONSTRAINT "ExtensionDomainAllowlist_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "GlobalExtension"("storeId") ON DELETE CASCADE ON UPDATE CASCADE;
