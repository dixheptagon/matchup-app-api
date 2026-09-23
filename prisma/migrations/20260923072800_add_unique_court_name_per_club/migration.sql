/*
  Warnings:

  - A unique constraint covering the columns `[clubId,name]` on the table `Court` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "Court_clubId_displayOrder_idx" ON "Court"("clubId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Court_clubId_name_key" ON "Court"("clubId", "name");
