export interface KnownCityInfo {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  timeZone: string;
}

const KNOWN_CITIES: Record<string, KnownCityInfo> = {
  karachi: {
    name: 'Karachi',
    country: 'Pakistan',
    latitude: 24.8608,
    longitude: 67.0104,
    timeZone: 'Asia/Karachi',
  },
  lahore: {
    name: 'Lahore',
    country: 'Pakistan',
    latitude: 31.558,
    longitude: 74.3507,
    timeZone: 'Asia/Karachi',
  },
  islamabad: {
    name: 'Islamabad',
    country: 'Pakistan',
    latitude: 33.7215,
    longitude: 73.0433,
    timeZone: 'Asia/Karachi',
  },
  rawalpindi: {
    name: 'Rawalpindi',
    country: 'Pakistan',
    latitude: 33.5973,
    longitude: 73.0479,
    timeZone: 'Asia/Karachi',
  },
  faisalabad: {
    name: 'Faisalabad',
    country: 'Pakistan',
    latitude: 31.4167,
    longitude: 73.0833,
    timeZone: 'Asia/Karachi',
  },
  multan: {
    name: 'Multan',
    country: 'Pakistan',
    latitude: 30.1968,
    longitude: 71.4782,
    timeZone: 'Asia/Karachi',
  },
  peshawar: {
    name: 'Peshawar',
    country: 'Pakistan',
    latitude: 34.008,
    longitude: 71.5785,
    timeZone: 'Asia/Karachi',
  },
  quetta: {
    name: 'Quetta',
    country: 'Pakistan',
    latitude: 30.1841,
    longitude: 67.0014,
    timeZone: 'Asia/Karachi',
  },
  hyderabad: {
    name: 'Hyderabad',
    country: 'Pakistan',
    latitude: 25.3924,
    longitude: 68.3737,
    timeZone: 'Asia/Karachi',
  },
  sialkot: {
    name: 'Sialkot',
    country: 'Pakistan',
    latitude: 32.4927,
    longitude: 74.5313,
    timeZone: 'Asia/Karachi',
  },
  pakistan: {
    name: 'Islamabad',
    country: 'Pakistan',
    latitude: 33.7215,
    longitude: 73.0433,
    timeZone: 'Asia/Karachi',
  },
  dubai: {
    name: 'Dubai',
    country: 'United Arab Emirates',
    latitude: 25.2048,
    longitude: 55.2708,
    timeZone: 'Asia/Dubai',
  },
  'abu dhabi': {
    name: 'Abu Dhabi',
    country: 'United Arab Emirates',
    latitude: 24.4539,
    longitude: 54.3773,
    timeZone: 'Asia/Dubai',
  },
  riyadh: {
    name: 'Riyadh',
    country: 'Saudi Arabia',
    latitude: 24.7136,
    longitude: 46.6753,
    timeZone: 'Asia/Riyadh',
  },
  jeddah: {
    name: 'Jeddah',
    country: 'Saudi Arabia',
    latitude: 21.4858,
    longitude: 39.1925,
    timeZone: 'Asia/Riyadh',
  },
  makkah: {
    name: 'Makkah',
    country: 'Saudi Arabia',
    latitude: 21.3891,
    longitude: 39.8579,
    timeZone: 'Asia/Riyadh',
  },
  doha: {
    name: 'Doha',
    country: 'Qatar',
    latitude: 25.2854,
    longitude: 51.531,
    timeZone: 'Asia/Qatar',
  },
  london: {
    name: 'London',
    country: 'United Kingdom',
    latitude: 51.5085,
    longitude: -0.1257,
    timeZone: 'Europe/London',
  },
  'new york': {
    name: 'New York',
    country: 'United States',
    latitude: 40.7128,
    longitude: -74.006,
    timeZone: 'America/New_York',
  },
  'los angeles': {
    name: 'Los Angeles',
    country: 'United States',
    latitude: 34.0522,
    longitude: -118.2437,
    timeZone: 'America/Los_Angeles',
  },
  chicago: {
    name: 'Chicago',
    country: 'United States',
    latitude: 41.8781,
    longitude: -87.6298,
    timeZone: 'America/Chicago',
  },
  toronto: {
    name: 'Toronto',
    country: 'Canada',
    latitude: 43.6532,
    longitude: -79.3832,
    timeZone: 'America/Toronto',
  },
  istanbul: {
    name: 'Istanbul',
    country: 'Turkey',
    latitude: 41.0082,
    longitude: 28.9784,
    timeZone: 'Europe/Istanbul',
  },
  paris: {
    name: 'Paris',
    country: 'France',
    latitude: 48.8566,
    longitude: 2.3522,
    timeZone: 'Europe/Paris',
  },
  berlin: {
    name: 'Berlin',
    country: 'Germany',
    latitude: 52.52,
    longitude: 13.405,
    timeZone: 'Europe/Berlin',
  },
  tokyo: {
    name: 'Tokyo',
    country: 'Japan',
    latitude: 35.6762,
    longitude: 139.6503,
    timeZone: 'Asia/Tokyo',
  },
  singapore: {
    name: 'Singapore',
    country: 'Singapore',
    latitude: 1.3521,
    longitude: 103.8198,
    timeZone: 'Asia/Singapore',
  },
  sydney: {
    name: 'Sydney',
    country: 'Australia',
    latitude: -33.8688,
    longitude: 151.2093,
    timeZone: 'Australia/Sydney',
  },
  delhi: {
    name: 'Delhi',
    country: 'India',
    latitude: 28.6139,
    longitude: 77.209,
    timeZone: 'Asia/Kolkata',
  },
  mumbai: {
    name: 'Mumbai',
    country: 'India',
    latitude: 19.076,
    longitude: 72.8777,
    timeZone: 'Asia/Kolkata',
  },
  dhaka: {
    name: 'Dhaka',
    country: 'Bangladesh',
    latitude: 23.8103,
    longitude: 90.4125,
    timeZone: 'Asia/Dhaka',
  },
  kabul: {
    name: 'Kabul',
    country: 'Afghanistan',
    latitude: 34.5553,
    longitude: 69.2075,
    timeZone: 'Asia/Kabul',
  },
  tehran: {
    name: 'Tehran',
    country: 'Iran',
    latitude: 35.6892,
    longitude: 51.389,
    timeZone: 'Asia/Tehran',
  },
  cairo: {
    name: 'Cairo',
    country: 'Egypt',
    latitude: 30.0444,
    longitude: 31.2357,
    timeZone: 'Africa/Cairo',
  },
  beijing: {
    name: 'Beijing',
    country: 'China',
    latitude: 39.9042,
    longitude: 116.4074,
    timeZone: 'Asia/Shanghai',
  },
  shanghai: {
    name: 'Shanghai',
    country: 'China',
    latitude: 31.2304,
    longitude: 121.4737,
    timeZone: 'Asia/Shanghai',
  },
  'kuala lumpur': {
    name: 'Kuala Lumpur',
    country: 'Malaysia',
    latitude: 3.139,
    longitude: 101.6869,
    timeZone: 'Asia/Kuala_Lumpur',
  },
};

export function findKnownCity(query: string): KnownCityInfo | null {
  const cleaned = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  return KNOWN_CITIES[cleaned] ?? null;
}

export function isValidTimeZone(tz?: string): tz is string {
  if (!tz || typeof tz !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export interface DateTimeQuery {
  kind: 'date' | 'time' | 'datetime';
  locationQuery?: string;
}

function cleanLocationFragment(raw: string): string | undefined {
  const cleaned = raw
    .replace(/\b(today|right\s+now|currently|now|please|aaj|abhi|is\s+waqt)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > 1 ? cleaned : undefined;
}

export function parseDateTimeQuery(text: string): DateTimeQuery | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 90) return null;

  const lower = trimmed.toLowerCase().replace(/[?.!,]+$/g, '').trim();

  // Reject multi-topic or complex questions (e.g., "What is today's date in history?")
  if (
    /\b(history|born|event|holiday|astrology|zodiac|calculate|convert|difference|between|days\s+until|how\s+many\s+days)\b/i.test(
      lower,
    )
  ) {
    return null;
  }

  const hasDateAndTime =
    /\b(date\s+and\s+time|time\s+and\s+date|tareekh\s+aur\s+waqt|date\s+aur\s+time)\b/i.test(
      lower,
    );
  const asksDate =
    /^(what\s+is\s+|what'?s\s+|tell\s+me\s+|check\s+)?(today'?s?|the\s+current|current|the)?\s*(date|day\s+and\s+date|day\s+of\s+(?:the\s+)?week)(\s+(today|right\s+now|in\s+.+|at\s+.+|for\s+.+|of\s+.+))?$/i.test(
      lower,
    ) ||
    /^(today'?s?\s+date|current\s+date|what\s+day\s+is\s+(?:it|today)|aaj\s+(?:ki\s+)?(?:date|tareekh|tarikh|din)\s*(?:kya\s+hai|kia\s+hai|kon\s*sa\s+hai)?|(?:date|tareekh)\s+(?:in|of)\s+.+)$/i.test(
      lower,
    ) ||
    /^(?:[a-z\s]+?)\s+(?:me|mein)\s+aaj\s+(?:ki\s+)?(?:date|tareekh)\s*(?:kya\s+hai)?$/i.test(
      lower,
    ) ||
    /^[a-z\s-]{2,30}\s+(?:today'?s?\s+)?date$/i.test(lower);

  const asksTime =
    /^(what\s+is\s+|what'?s\s+|tell\s+me\s+|check\s+)?(the\s+)?(current\s+|local\s+)?time(\s+(is\s+it|now|right\s+now|in\s+.+|at\s+.+|for\s+.+|of\s+.+))?$/i.test(
      lower,
    ) ||
    /^(what\s+time\s+is\s+it|abhi\s+kya\s+(?:time|waqt)\s+(?:hua\s+)?hai|time\s+kya\s+hua\s+hai)(.*)$/i.test(
      lower,
    ) ||
    /^(?:[a-z\s]+?)\s+(?:me|mein)\s+(?:abhi\s+)?kya\s+(?:time|waqt)\s+(?:hua\s+)?hai$/i.test(
      lower,
    ) ||
    /^[a-z\s-]{2,30}\s+(?:current\s+|local\s+)?time$/i.test(lower);

  if (!hasDateAndTime && !asksDate && !asksTime) {
    return null;
  }

  let locationQuery: string | undefined;
  const prepMatch = /\b(?:in|at|for|of)\s+([a-zA-Z\s-]{2,40})$/i.exec(lower);
  if (prepMatch) {
    locationQuery = cleanLocationFragment(prepMatch[1]);
  } else {
    const urduCityMatch = /^([a-zA-Z\s-]{2,30})\s+(?:me|mein)\s+/i.exec(lower);
    if (urduCityMatch) {
      locationQuery = cleanLocationFragment(urduCityMatch[1]);
    } else {
      const prefixCityMatch =
        /^([a-zA-Z\s-]{2,30}?)\s+(?:current\s+|local\s+|today'?s?\s+)?(?:date|time)$/i.exec(
          lower,
        );
      if (prefixCityMatch) {
        const candidate = cleanLocationFragment(prefixCityMatch[1]);
        if (
          candidate &&
          !/^(today|todays|current|local|the|what|whats|check|tell|me)$/i.test(candidate)
        ) {
          locationQuery = candidate;
        }
      }
    }
  }

  return {
    kind: hasDateAndTime ? 'datetime' : asksTime && !asksDate ? 'time' : 'date',
    locationQuery,
  };
}

export function buildStructuredDateTime(timeZone: string, locationLabel?: string, now = new Date()) {
  const tz = isValidTimeZone(timeZone) ? timeZone : 'UTC';
  const date = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(now);
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(now);
  const isoDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return {
    location: locationLabel ?? tz,
    timeZone: tz,
    date,
    isoDate,
    time,
  };
}

export function formatDateTimeReply(options: {
  kind: 'date' | 'time' | 'datetime';
  timeZone: string;
  locationLabel?: string;
  preferUrdu?: boolean;
  now?: Date;
}): string {
  const { date: dateStr, time: timeStr } = buildStructuredDateTime(
    options.timeZone,
    options.locationLabel,
    options.now,
  );

  const where = options.locationLabel ? ` in **${options.locationLabel}**` : '';
  const whereUrdu = options.locationLabel ? ` **${options.locationLabel}** mein` : '';

  if (options.preferUrdu) {
    if (options.kind === 'time') {
      return `Abhi${whereUrdu} waqt **${timeStr}** hai (${dateStr}).`;
    }
    if (options.kind === 'datetime') {
      return `Aaj${whereUrdu} tareekh **${dateStr}** aur waqt **${timeStr}** hai.`;
    }
    return `Aaj${whereUrdu} **${dateStr}** hai (local time: ${timeStr}).`;
  }

  if (options.kind === 'time') {
    return `The current time${where} is **${timeStr}** (${dateStr}).`;
  }
  if (options.kind === 'datetime') {
    return `Current date and time${where}: **${dateStr}**, **${timeStr}**.`;
  }
  return `Today's date${where} is **${dateStr}** (current local time: ${timeStr}).`;
}
