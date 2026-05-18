-- AlterTable: add placeIds column to ModerationCase
ALTER TABLE "ModerationCase" ADD COLUMN "placeIds" BIGINT[] NOT NULL DEFAULT '{}';
