/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `SportClub` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `SportClub` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SportClub" ADD COLUMN     "slug" VARCHAR(150) NOT NULL;

-- AlterTable
ALTER TABLE "SportSession" ADD COLUMN     "slug" VARCHAR(350);

-- CreateIndex
CREATE UNIQUE INDEX "SportClub_slug_key" ON "SportClub"("slug");
