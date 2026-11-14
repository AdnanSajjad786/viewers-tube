ALTER TABLE "Video"
ADD COLUMN "isShort" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Video_isShort_createdAt_idx"
ON "Video"("isShort", "createdAt");
