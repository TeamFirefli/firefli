// Multi Container batch schedule
export function getCurrentBatch(): number | null {
  const now = new Date();
  const hours = now.getUTCHours();
  const minutes = now.getUTCMinutes();
  const currentMinutes = hours * 60 + minutes;
  const cyclePosition = currentMinutes % 120;
  const batchId = Math.floor(cyclePosition / 15) + 1;
  return batchId;
}

export function getActiveBatch(): number | null {
  const isMultiContainer = process.env.NEXT_MULTI === 'true';
  
  if (!isMultiContainer) {
    return null;
  }
  
  return getCurrentBatch();
}

export function logBatchSchedule(): void {
  const batchId = getCurrentBatch();
  const now = new Date();
  const timeStr = now.toISOString();
  
  console.log(`[BATCH-SCHEDULER] Current time: ${timeStr}`);
  console.log(`[BATCH-SCHEDULER] Active batch: ${batchId}`);
  console.log(`[BATCH-SCHEDULER] Multi-container mode: ${process.env.NEXT_MULTI?.toLowerCase() === 'true'}`);
}
