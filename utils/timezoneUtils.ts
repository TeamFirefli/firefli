/**
 * Timezone utilities for area-based (UTC offset) timezone handling
 * Uses formats like GMT+1, EST, PST, UTC, etc.
 */

export interface TimezoneOption {
  label: string;
  offset: number; // in hours
  abbreviations: string[];
}

export const areaBasedTimezones: TimezoneOption[] = [
  // UTC-12
  { label: 'UTC-12:00', offset: -12, abbreviations: [] },
  // UTC-11
  { label: 'UTC-11:00 (SST)', offset: -11, abbreviations: ['SST'] },
  // UTC-10
  { label: 'UTC-10:00 (HST)', offset: -10, abbreviations: ['HST'] },
  // UTC-9
  { label: 'UTC-09:00 (AKST)', offset: -9, abbreviations: ['AKST'] },
  // UTC-8
  { label: 'UTC-08:00 (PST)', offset: -8, abbreviations: ['PST', 'PT'] },
  // UTC-7
  { label: 'UTC-07:00 (MST)', offset: -7, abbreviations: ['MST', 'MT', 'PDT'] },
  // UTC-6
  { label: 'UTC-06:00 (CST)', offset: -6, abbreviations: ['CST', 'CT', 'MDT'] },
  // UTC-5
  { label: 'UTC-05:00 (EST)', offset: -5, abbreviations: ['EST', 'ET', 'CDT'] },
  // UTC-4
  { label: 'UTC-04:00 (EDT)', offset: -4, abbreviations: ['EDT', 'AST'] },
  // UTC-3
  { label: 'UTC-03:00 (ART)', offset: -3, abbreviations: ['ART', 'BRT'] },
  // UTC-2
  { label: 'UTC-02:00', offset: -2, abbreviations: [] },
  // UTC-1
  { label: 'UTC-01:00', offset: -1, abbreviations: ['AZOT'] },
  // UTC
  { label: 'UTC±00:00 (GMT)', offset: 0, abbreviations: ['GMT', 'UTC', 'WET'] },
  // UTC+1
  { label: 'UTC+01:00 (CET)', offset: 1, abbreviations: ['CET', 'WET', 'IST'] },
  // UTC+2
  { label: 'UTC+02:00 (EET)', offset: 2, abbreviations: ['EET', 'CAT', 'SAST'] },
  // UTC+3
  { label: 'UTC+03:00 (EAT)', offset: 3, abbreviations: ['EAT', 'MSK'] },
  // UTC+4
  { label: 'UTC+04:00 (GST)', offset: 4, abbreviations: ['GST', 'AMT'] },
  // UTC+5
  { label: 'UTC+05:00 (PKT)', offset: 5, abbreviations: ['PKT', 'YEKT'] },
  // UTC+5:30
  { label: 'UTC+05:30 (IST)', offset: 5.5, abbreviations: ['IST'] },
  // UTC+6
  { label: 'UTC+06:00 (BST)', offset: 6, abbreviations: ['BST', 'OMST'] },
  // UTC+7
  { label: 'UTC+07:00 (ICT)', offset: 7, abbreviations: ['ICT', 'WIB', 'KRAT'] },
  // UTC+8
  { label: 'UTC+08:00 (CST)', offset: 8, abbreviations: ['CST', 'SGT', 'PHT', 'IRKT'] },
  // UTC+9
  { label: 'UTC+09:00 (JST)', offset: 9, abbreviations: ['JST', 'KST', 'YAKT'] },
  // UTC+10
  { label: 'UTC+10:00 (AEST)', offset: 10, abbreviations: ['AEST', 'VLAT'] },
  // UTC+11
  { label: 'UTC+11:00', offset: 11, abbreviations: ['MAGT'] },
  // UTC+12
  { label: 'UTC+12:00 (NZST)', offset: 12, abbreviations: ['NZST'] },
];

/**
 * Get the user's browser timezone offset in hours
 */
export function getBrowserTimezoneOffset(): number {
  const now = new Date();
  const offsetInMinutes = now.getTimezoneOffset();
  return -offsetInMinutes / 60; // negative because getTimezoneOffset returns opposite sign
}

/**
 * Find the closest timezone option based on UTC offset
 * @param offset - UTC offset in hours (positive for east, negative for west)
 */
export function findClosestTimezone(offset: number): TimezoneOption {
  let closest = areaBasedTimezones[0];
  let minDifference = Math.abs(areaBasedTimezones[0].offset - offset);

  for (const tz of areaBasedTimezones) {
    const difference = Math.abs(tz.offset - offset);
    if (difference < minDifference) {
      minDifference = difference;
      closest = tz;
    }
  }

  return closest;
}

/**
 * Detect user's timezone option based on browser settings
 */
export function detectUserTimezone(): TimezoneOption {
  const offset = getBrowserTimezoneOffset();
  return findClosestTimezone(offset);
}

/**
 * Format timezone for display
 * @param timezone - timezone label (e.g., "UTC+05:30 (IST)")
 */
export function formatTimezoneDisplay(timezone: string | null | undefined): string {
  if (!timezone) return 'Not set';
  return timezone;
}

/**
 * Parse timezone label to get offset
 * @param label - timezone label (e.g., "UTC+05:30 (IST)" or "UTC±00:00 (GMT)")
 */
export function parseTimezoneOffset(label: string): number {
  // Handle both + and - signs, including ±
  const match = label.match(/UTC([±+\-])(\d{1,2}):?(\d{0,2})/);
  if (!match) return 0;

  const sign = match[1] === '-' ? -1 : 1;
  const hours = parseInt(match[2], 10);
  const minutes = match[3] ? parseInt(match[3], 10) : 0;

  return sign * (hours + minutes / 60);
}

/**
 * Convert legacy location-based timezone to area-based equivalent
 * @param locationTimezone - legacy timezone like "America/New_York"
 */
export function convertLegacyTimezone(locationTimezone: string): string {
  const legacyMappings: Record<string, number> = {
    'UTC': 0,
    'GMT': 0,
    'America/New_York': -5,
    'America/Chicago': -6,
    'America/Denver': -7,
    'America/Los_Angeles': -8,
    'America/Toronto': -5,
    'America/Vancouver': -8,
    'Europe/London': 0,
    'Europe/Paris': 1,
    'Europe/Berlin': 1,
    'Europe/Madrid': 1,
    'Europe/Rome': 1,
    'Asia/Dubai': 4,
    'Asia/Kolkata': 5.5,
    'Asia/Singapore': 8,
    'Asia/Tokyo': 9,
    'Asia/Shanghai': 8,
    'Australia/Sydney': 10,
    'Pacific/Auckland': 12,
  };

  const offset = legacyMappings[locationTimezone];
  if (offset === undefined) {
    // Default to UTC if not found
    return 'UTC±00:00 (GMT)';
  }

  const found = findClosestTimezone(offset);
  return found.label;
}

/**
 * Get all timezone options as a simple array of labels
 */
export function getTimezoneOptions(): string[] {
  return areaBasedTimezones.map((tz) => tz.label);
}

/**
 * Validate if a timezone label is valid
 * @param label - timezone label to validate
 */
export function isValidTimezone(label: string): boolean {
  return areaBasedTimezones.some((tz) => tz.label === label);
}
