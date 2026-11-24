import {
  buildStructuredDateTime,
  extractMentionedKnownCities,
  findKnownCity,
  formatDateTimeReply,
  isValidTimeZone,
} from '../src/lib/dateTimeHelper.js';

const WEATHER_TIMEOUT_MS = 4000;
const WEATHER_CACHE_TTL_MS = 3 * 60 * 1000;
const weatherCache = new Map<string, { expiresAt: number; data: LiveWeatherData }>();

interface GeoResult {
  name: string;
  country?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
}

interface OpenMeteoForecastResponse {
  timezone?: string;
  current?: {
    time?: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    apparent_temperature?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
  daily?: {
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
  };
}

export interface LiveWeatherData {
  location: string;
  timeZone: string;
  date: string;
  localTime: string;
  condition: string;
  conditionUrdu: string;
  temperatureC: number;
  feelsLikeC?: number;
  highC?: number;
  lowC?: number;
  humidityPercent?: number;
  windSpeedKmh?: number;
}

function describeWmoWeatherCode(code: number | undefined, preferUrdu: boolean): string {
  if (code === undefined) return preferUrdu ? 'Mausam ki tafseel' : 'Current conditions';
  if (code === 0) return preferUrdu ? 'Saaf aasman (Clear sky)' : 'Clear sky';
  if (code === 1) return preferUrdu ? 'Zyada tar saaf (Mainly clear)' : 'Mainly clear';
  if (code === 2) return preferUrdu ? 'Halke baadal (Partly cloudy)' : 'Partly cloudy';
  if (code === 3) return preferUrdu ? 'Ghanay baadal (Overcast)' : 'Overcast';
  if (code === 45 || code === 48) return preferUrdu ? 'Dhund (Fog)' : 'Foggy';
  if (code >= 51 && code <= 55) return preferUrdu ? 'Halki boonda-baandi (Drizzle)' : 'Drizzle';
  if (code === 56 || code === 57) return preferUrdu ? 'Sard boonda-baandi' : 'Freezing drizzle';
  if (code >= 61 && code <= 65) return preferUrdu ? 'Baarish (Rain)' : 'Rain';
  if (code === 66 || code === 67) return preferUrdu ? 'Sard baarish' : 'Freezing rain';
  if (code >= 71 && code <= 77) return preferUrdu ? 'Barf-baari (Snow)' : 'Snow';
  if (code >= 80 && code <= 82) return preferUrdu ? 'Tez baarish ke jhonke (Rain showers)' : 'Rain showers';
  if (code === 85 || code === 86) return preferUrdu ? 'Barf-baari ke jhonke' : 'Snow showers';
  if (code >= 95) return preferUrdu ? 'Garaj chamak ke sath toofan (Thunderstorm)' : 'Thunderstorm';
  return preferUrdu ? 'Mausam' : 'Mixed conditions';
}

export function parseWeatherQuery(text: string): { locationQuery?: string } | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 100) return null;

  const lower = trimmed.toLowerCase().replace(/[?.!,]+$/g, '').trim();

  const hasWeatherKeyword =
    /\b(weather|forecast|temperature|temp|mausam|mosam|barish|baarish|garmi|sardi)\b/i.test(
      lower,
    );
  if (!hasWeatherKeyword) return null;

  // Let Gemini + tool calling handle multi-city comparisons, date+weather questions, advice, or complex queries
  if (
    /\b(why\s+does|how\s+does|explain|define|what\s+causes|poem|story|code|api|app|should\s+i|compare|better|hotter|colder|warmer|cooler|umbrella|jacket|wear|travel|tomorrow|week|date|confirm|wrong|outdated|and\s+(?:in|what|how))\b/i.test(
      lower,
    )
  ) {
    return null;
  }

  const prepMatch =
    /\b(?:weather|forecast|temperature|temp|mausam|mosam)\s+(?:right\s+now\s+|today\s+|currently\s+)?(?:in|for|at|of)\s+([\p{L}\p{N}\s'-]{2,45})$/iu.exec(
      lower,
    ) ||
    /\b(?:in|for|at|of)\s+([\p{L}\p{N}\s'-]{2,45})\s+(?:today|now|currently|right\s+now)?$/iu.exec(
      lower,
    );

  if (prepMatch) {
    const cleaned = prepMatch[1]
      .replace(/\b(today|right\s+now|currently|now|please|aaj|abhi)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return { locationQuery: cleaned || undefined };
  }

  const prefixCityMatch =
    /^([\p{L}\p{N}\s'-]{2,35}?)\s+(?:ka|ki|ke|me|mein)?\s*(?:current\s+|today'?s?\s+)?(?:weather|forecast|temperature|mausam|mosam)(?:\s+(?:kaisa\s+hai|kya\s+hai|today|now))?$/iu.exec(
      lower,
    );

  if (prefixCityMatch) {
    const candidate = prefixCityMatch[1]
      .replace(
        /^(what\s+is|what'?s|tell\s+me|show\s+me|check|get|give\s+me|aaj|abhi|the|current|today'?s?)\s+/gi,
        '',
      )
      .trim();
    if (
      candidate &&
      !/^(what|tell|show|check|get|current|today|the|aaj|abhi|kaisa)$/i.test(candidate)
    ) {
      return { locationQuery: candidate };
    }
  }

  return { locationQuery: undefined };
}

async function fetchJsonWithTimeout<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEATHER_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`HTTP_${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function geocodeLocation(query: string): Promise<GeoResult | null> {
  const known = findKnownCity(query);
  if (known) {
    return {
      name: known.name,
      country: known.country,
      latitude: known.latitude,
      longitude: known.longitude,
      timezone: known.timeZone,
    };
  }

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    query,
  )}&count=1&language=en&format=json`;
  const data = await fetchJsonWithTimeout<{ results?: GeoResult[] }>(url);
  return data.results?.[0] ?? null;
}

export async function resolveDateTimeToolData(options: {
  locationQuery?: string;
  clientTimeZone?: string;
}) {
  if (!options.locationQuery) {
    const tz = isValidTimeZone(options.clientTimeZone) ? options.clientTimeZone : 'UTC';
    return { ok: true as const, ...buildStructuredDateTime(tz) };
  }

  try {
    const geo = await geocodeLocation(options.locationQuery);
    if (!geo || !isValidTimeZone(geo.timezone)) {
      return {
        ok: false as const,
        error: `Could not resolve timezone for "${options.locationQuery}".`,
      };
    }
    const label = geo.country && geo.country !== geo.name ? `${geo.name}, ${geo.country}` : geo.name;
    return {
      ok: true as const,
      ...buildStructuredDateTime(geo.timezone, label),
    };
  } catch {
    return {
      ok: false as const,
      error: `Unable to look up timezone for "${options.locationQuery}".`,
    };
  }
}

export async function resolveDynamicDateTimeReply(options: {
  kind: 'date' | 'time' | 'datetime';
  locationQuery?: string;
  clientTimeZone?: string;
  preferUrdu: boolean;
}): Promise<string | null> {
  if (!options.locationQuery) {
    const tz = isValidTimeZone(options.clientTimeZone) ? options.clientTimeZone : 'UTC';
    return formatDateTimeReply({
      kind: options.kind,
      timeZone: tz,
      preferUrdu: options.preferUrdu,
    });
  }

  try {
    const geo = await geocodeLocation(options.locationQuery);
    if (!geo || !isValidTimeZone(geo.timezone)) {
      return null;
    }
    const label = geo.country && geo.country !== geo.name ? `${geo.name}, ${geo.country}` : geo.name;
    return formatDateTimeReply({
      kind: options.kind,
      timeZone: geo.timezone,
      locationLabel: label,
      preferUrdu: options.preferUrdu,
    });
  } catch {
    return null;
  }
}

function inferCityFromTimeZone(tz?: string): string | undefined {
  if (!tz || !tz.includes('/')) return undefined;
  const cityPart = tz.split('/').pop();
  if (!cityPart) return undefined;
  return cityPart.replace(/_/g, ' ');
}

export async function fetchLiveWeatherData(options: {
  locationQuery?: string;
  clientTimeZone?: string;
}): Promise<{ ok: true; data: LiveWeatherData } | { ok: false; error: string; target?: string }> {
  const targetLocation =
    options.locationQuery || inferCityFromTimeZone(options.clientTimeZone);

  if (!targetLocation) {
    return {
      ok: false,
      error: 'No city or location was specified.',
    };
  }

  const cacheKey = targetLocation.toLowerCase().trim();
  const cached = weatherCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ok: true, data: cached.data };
  }

  try {
    const geo = await geocodeLocation(targetLocation);
    if (!geo) {
      return {
        ok: false,
        target: targetLocation,
        error: `Location "${targetLocation}" was not found.`,
      };
    }

    const forecastUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
      `&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`;

    const wx = await fetchJsonWithTimeout<OpenMeteoForecastResponse>(forecastUrl);
    if (!wx.current || typeof wx.current.temperature_2m !== 'number') {
      return {
        ok: false,
        target: targetLocation,
        error: 'Live weather fields were unavailable from the weather provider.',
      };
    }

    const tz = isValidTimeZone(wx.timezone)
      ? wx.timezone
      : isValidTimeZone(geo.timezone)
        ? geo.timezone
        : 'UTC';

    const { date, time: localTime } = buildStructuredDateTime(tz);
    const locationLabel =
      geo.country && geo.country !== geo.name ? `${geo.name}, ${geo.country}` : geo.name;

    const liveData: LiveWeatherData = {
      location: locationLabel,
      timeZone: tz,
      date,
      localTime,
      condition: describeWmoWeatherCode(wx.current.weather_code, false),
      conditionUrdu: describeWmoWeatherCode(wx.current.weather_code, true),
      temperatureC: Math.round(wx.current.temperature_2m),
      feelsLikeC:
        typeof wx.current.apparent_temperature === 'number'
          ? Math.round(wx.current.apparent_temperature)
          : undefined,
      highC:
        typeof wx.daily?.temperature_2m_max?.[0] === 'number'
          ? Math.round(wx.daily.temperature_2m_max[0])
          : undefined,
      lowC:
        typeof wx.daily?.temperature_2m_min?.[0] === 'number'
          ? Math.round(wx.daily.temperature_2m_min[0])
          : undefined,
      humidityPercent: wx.current.relative_humidity_2m,
      windSpeedKmh:
        typeof wx.current.wind_speed_10m === 'number'
          ? Math.round(wx.current.wind_speed_10m)
          : undefined,
    };

    if (weatherCache.size >= 100) {
      const oldestKey = weatherCache.keys().next().value;
      if (oldestKey) weatherCache.delete(oldestKey);
    }
    weatherCache.set(cacheKey, {
      expiresAt: Date.now() + WEATHER_CACHE_TTL_MS,
      data: liveData,
    });

    return {
      ok: true,
      data: liveData,
    };
  } catch {
    return {
      ok: false,
      target: targetLocation,
      error: `Unable to retrieve live weather data for "${targetLocation}" right now.`,
    };
  }
}

export async function preGroundLiveWeatherContext(
  text: string,
  clientTimeZone?: string,
): Promise<{ groundedFacts: string; cityCount: number }> {
  const cities = extractMentionedKnownCities(text, 3);
  if (cities.length === 0) {
    return { groundedFacts: '', cityCount: 0 };
  }

  const results = await Promise.all(
    cities.map(async (city) => {
      const res = await fetchLiveWeatherData({
        locationQuery: city.name,
        clientTimeZone,
      });
      return res.ok
        ? `${res.data.location} (${res.data.date} ${res.data.localTime}): ${res.data.condition}, ${res.data.temperatureC}°C (feels like ${res.data.feelsLikeC ?? res.data.temperatureC}°C), high/low ${res.data.highC ?? '-'}°C/${res.data.lowC ?? '-'}°C, humidity ${res.data.humidityPercent ?? '-'}%, wind ${res.data.windSpeedKmh ?? '-'} km/h.`
        : `${city.name}: live weather unavailable (${res.error}).`;
    }),
  );

  return {
    groundedFacts: results.join(' | '),
    cityCount: cities.length,
  };
}

export async function fetchLiveWeatherReply(options: {
  locationQuery?: string;
  clientTimeZone?: string;
  preferUrdu: boolean;
}): Promise<string> {
  const result = await fetchLiveWeatherData({
    locationQuery: options.locationQuery,
    clientTimeZone: options.clientTimeZone,
  });

  if (!result.ok) {
    if (!result.target) {
      return options.preferUrdu
        ? 'Barah-e-karam shehar ka naam batayein (maslan "Karachi ka mausam") taake main aap ko live weather bata sakoon.'
        : 'Please specify a city or location (for example, "weather in Karachi") so I can fetch live weather data.';
    }
    return options.preferUrdu
      ? `Is waqt **${result.target}** ka live weather data haasil nahi ho saka. Barah-e-karam kuch dair baad dobara koshish karein.`
      : `Live weather data for **${result.target}** is temporarily unavailable right now. Please try again in a moment.`;
  }

  const d = result.data;

  if (options.preferUrdu) {
    const lines = [
      `**${d.location} ka Live Mausam** (${d.date} · ${d.localTime})`,
      `- **Condition:** ${d.conditionUrdu}`,
      `- **Temperature:** ${d.temperatureC}°C${d.feelsLikeC !== undefined ? ` (Feels like ${d.feelsLikeC}°C)` : ''}`,
    ];
    if (d.highC !== undefined && d.lowC !== undefined) {
      lines.push(`- **Aaj ka High / Low:** ${d.highC}°C / ${d.lowC}°C`);
    }
    if (typeof d.humidityPercent === 'number') {
      lines.push(`- **Humidity:** ${d.humidityPercent}%`);
    }
    if (d.windSpeedKmh !== undefined) {
      lines.push(`- **Hawa (Wind):** ${d.windSpeedKmh} km/h`);
    }
    return lines.join('\n');
  }

  const lines = [
    `**Current Weather in ${d.location}** (${d.date} · ${d.localTime})`,
    `- **Condition:** ${d.condition}`,
    `- **Temperature:** ${d.temperatureC}°C${d.feelsLikeC !== undefined ? ` (Feels like ${d.feelsLikeC}°C)` : ''}`,
  ];
  if (d.highC !== undefined && d.lowC !== undefined) {
    lines.push(`- **Today's High / Low:** ${d.highC}°C / ${d.lowC}°C`);
  }
  if (typeof d.humidityPercent === 'number') {
    lines.push(`- **Humidity:** ${d.humidityPercent}%`);
  }
  if (d.windSpeedKmh !== undefined) {
    lines.push(`- **Wind:** ${d.windSpeedKmh} km/h`);
  }
  return lines.join('\n');
}
