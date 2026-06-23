-- D16 (§25): e-book delivered as a protected download link.
-- Product gains an editable link-message template; Delivery gains the unguessable download token.
ALTER TABLE "Product" ADD COLUMN "linkMessageTemplate" TEXT;

ALTER TABLE "Delivery" ADD COLUMN "downloadToken" TEXT;
CREATE UNIQUE INDEX "Delivery_downloadToken_key" ON "Delivery"("downloadToken");
