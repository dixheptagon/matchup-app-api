/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `SportSession` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "SportSession_slug_key" ON "SportSession"("slug");
