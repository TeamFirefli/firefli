// Multi Container schedule
export function getCurrentBatch(): number | null {
  const now = new Date();
  const hours = now.getUTCHours();
  const minutes = now.getUTCMinutes();
  const currentMinutes = hours * 60 + minutes;
  const cyclePosition = currentMinutes % 120;
  const isOddHour = Math.floor(currentMinutes / 60) % 2 === 1;
  const minuteInHour = currentMinutes % 60;
  
  if (isOddHour) {
    if (minuteInHour < 30) {
      return 1; // Batch 1
    } else {
      return 2; // Batch 2
    }
  } else {
    if (minuteInHour < 30) {
      return 3; // Batch 3
    } else {
      return 4; // Batch 4
    }
  }
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
