-- AlterTable
ALTER TABLE "workflow_runs" ADD COLUMN "completedAt" DATETIME;
ALTER TABLE "workflow_runs" ADD COLUMN "output" TEXT;
ALTER TABLE "workflow_runs" ADD COLUMN "startedAt" DATETIME;

-- CreateIndex
CREATE INDEX "workflow_runs_status_idx" ON "workflow_runs"("status");
