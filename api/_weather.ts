import type { IncomingMessage as HttpIncomingMessage, ServerResponse } from 'http';
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

export type WeatherFailureReason = 'MISSING_LOCATION' | 'NOT_FOUND' | 'PROVIDER_ERROR';

export type LiveWeatherResult =
  | { ok: true; data: LiveWeatherData; cached: boolean }
  | { ok: false; reason: WeatherFailureReason; error: string; target?: string };

export async function fetchLiveWeatherData(options: {
  locationQuery?: string;
  clientTimeZone?: string;
}): Promise<LiveWeatherResult> {
  const targetLocation =
    options.locationQuery?.trim() || inferCityFromTimeZone(options.clientTimeZone);

  if (!targetLocation) {
    return {
      ok: false,
      reason: 'MISSING_LOCATION',
      error: 'No city or location was specified.',
    };
  }

  const cacheKey = targetLocation.toLowerCase().trim();
  const cached = weatherCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ok: true, data: cached.data, cached: true };
  }

  try {
    const geo = await geocodeLocation(targetLocation);
    if (!geo) {
      return {
        ok: false,
        reason: 'NOT_FOUND',
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
        reason: 'PROVIDER_ERROR',
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
      cached: false,
    };
  } catch {
    return {
      ok: false,
      reason: 'PROVIDER_ERROR',
      target: targetLocation,
      error: `Unable to retrieve live weather data for "${targetLocation}" right now.`,
    };
  }
}

const CITY_STOPWORDS = new Set([
  'today',
  'todays',
  'tomorrow',
  'now',
  'currently',
  'right now',
  'please',
  'the',
  'aaj',
  'abhi',
  'weather',
  'forecast',
  'temperature',
  'temp',
  'rain',
  'umbrella',
  'jacket',
  'date',
  'time',
  'me',
  'my',
  'this',
  'that',
  'live',
  'morning',
  'afternoon',
  'evening',
  'night',
  'weekend',
]);

function extractAdditionalCityQueries(text: string, alreadyKnown: string[], limit: number): string[] {
  const seen = new Set(alreadyKnown.map((c) => c.toLowerCase()));
  const extra: string[] = [];

  const matches = [
    ...text.matchAll(
      /\b(?:in|at|for|of)\s+([A-Z\p{L}][\p{L}\p{N}'-]+(?:\s+[A-Z\p{L}][\p{L}\p{N}'-]+)?)(?=\s*(?:today|now|currently|right\s+now|and\b|or\b|vs\b|,|\.|\?|$))/giu,
    ),
    ...text.matchAll(
      /\b([A-Z\p{L}][\p{L}\p{N}'-]+)\s+(?:and|vs)\s+([A-Z\p{L}][\p{L}\p{N}'-]+)\b/giu,
    ),
  ];

  for (const m of matches) {
    for (let g = 1; g < m.length; g++) {
      const raw = m[g]?.trim();
      if (!raw) continue;
      const cleaned = raw
        .replace(/\b(today|now|currently|right\s+now|aaj|abhi|the)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      const lower = cleaned.toLowerCase();
      if (
        cleaned.length >= 2 &&
        cleaned.length <= 35 &&
        !CITY_STOPWORDS.has(lower) &&
        !seen.has(lower)
      ) {
        seen.add(lower);
        extra.push(cleaned);
        if (extra.length >= limit) return extra;
      }
    }
  }
  return extra;
}

export async function preGroundLiveWeatherContext(
  text: string,
  clientTimeZone?: string,
): Promise<{ groundedFacts: string; cityCount: number; hasProviderError: boolean }> {
  const knownCities = extractMentionedKnownCities(text, 3).map((c) => c.name);
  const extraCities =
    knownCities.length < 3
      ? extractAdditionalCityQueries(text, knownCities, 3 - knownCities.length)
      : [];

  let targetCities = [...knownCities, ...extraCities].slice(0, 3);
  if (targetCities.length === 0) {
    const tzCity = inferCityFromTimeZone(clientTimeZone);
    if (tzCity) {
      targetCities = [tzCity];
    }
  }

  if (targetCities.length === 0) {
    return { groundedFacts: '', cityCount: 0, hasProviderError: false };
  }

  let hasProviderError = false;
  const results = await Promise.all(
    targetCities.map(async (city) => {
      const res = await fetchLiveWeatherData({
        locationQuery: city,
        clientTimeZone,
      });
      if (res.ok) {
        return `${res.data.location} (${res.data.date} ${res.data.localTime}): ${res.data.condition}, ${res.data.temperatureC}°C (feels like ${res.data.feelsLikeC ?? res.data.temperatureC}°C), high/low ${res.data.highC ?? '-'}°C/${res.data.lowC ?? '-'}°C, humidity ${res.data.humidityPercent ?? '-'}%, wind ${res.data.windSpeedKmh ?? '-'} km/h.`;
      }
      if (res.reason === 'PROVIDER_ERROR') {
        hasProviderError = true;
      }
      return `${city}: live weather unavailable (${res.error}).`;
    }),
  );

  return {
    groundedFacts: results.join(' | '),
    cityCount: targetCities.length,
    hasProviderError,
  };
}

export function formatLiveWeatherReply(
  data: LiveWeatherData,
  preferUrdu: boolean,
): string {
  if (preferUrdu) {
    const lines = [
      `**${data.location} ka Live Mausam** (${data.date} · ${data.localTime})`,
      `- **Condition:** ${data.conditionUrdu}`,
      `- **Temperature:** ${data.temperatureC}°C${data.feelsLikeC !== undefined ? ` (Feels like ${data.feelsLikeC}°C)` : ''}`,
    ];
    if (data.highC !== undefined && data.lowC !== undefined) {
      lines.push(`- **Aaj ka High / Low:** ${data.highC}°C / ${data.lowC}°C`);
    }
    if (typeof data.humidityPercent === 'number') {
      lines.push(`- **Humidity:** ${data.humidityPercent}%`);
    }
    if (data.windSpeedKmh !== undefined) {
      lines.push(`- **Hawa (Wind):** ${data.windSpeedKmh} km/h`);
    }
    return lines.join('\n');
  }

  const lines = [
    `**Current Weather in ${data.location}** (${data.date} · ${data.localTime})`,
    `- **Condition:** ${data.condition}`,
    `- **Temperature:** ${data.temperatureC}°C${data.feelsLikeC !== undefined ? ` (Feels like ${data.feelsLikeC}°C)` : ''}`,
  ];
  if (data.highC !== undefined && data.lowC !== undefined) {
    lines.push(`- **Today's High / Low:** ${data.highC}°C / ${data.lowC}°C`);
  }
  if (typeof data.humidityPercent === 'number') {
    lines.push(`- **Humidity:** ${data.humidityPercent}%`);
  }
  if (data.windSpeedKmh !== undefined) {
    lines.push(`- **Wind:** ${data.windSpeedKmh} km/h`);
  }
  return lines.join('\n');
}

export async function fetchLiveWeatherReply(options: {
  locationQuery?: string;
  clientTimeZone?: string;
  preferUrdu: boolean;
}): Promise<
  | { ok: true; reply: string }
  | { ok: false; reason: WeatherFailureReason; reply: string }
> {
  const result = await fetchLiveWeatherData({
    locationQuery: options.locationQuery,
    clientTimeZone: options.clientTimeZone,
  });

  if (!result.ok) {
    if (result.reason === 'MISSING_LOCATION') {
      return {
        ok: false,
        reason: result.reason,
        reply: options.preferUrdu
          ? 'Barah-e-karam shehar ka naam batayein (maslan "Karachi ka mausam") taake main aap ko live weather bata sakoon.'
          : 'Please specify a city or location (for example, "weather in Karachi") so I can fetch live weather data.',
      };
    }
    if (result.reason === 'NOT_FOUND') {
      return {
        ok: false,
        reason: result.reason,
        reply: options.preferUrdu
          ? `Mujhe **${result.target ?? 'is shehar'}** ke liye live weather location nahi mil saki. Barah-e-karam shehar ka sahi naam likhein.`
          : `I could not find a matching city for **${result.target ?? 'that location'}**. Please check the city name and try again.`,
      };
    }
    return {
      ok: false,
      reason: result.reason,
      reply: options.preferUrdu
        ? `Is waqt **${result.target ?? 'mausam'}** ka live weather data haasil nahi ho saka. Barah-e-karam dobara koshish karein.`
        : `Live weather data for **${result.target ?? 'this location'}** is temporarily unavailable right now. Please try again.`,
    };
  }

  return {
    ok: true,
    reply: formatLiveWeatherReply(result.data, options.preferUrdu),
  };
}

function writeWeatherJson(
  res: ServerResponse,
  status: number,
  payload: unknown,
  cacheHeader = 'no-store',
): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cacheHeader);
  res.end(JSON.stringify(payload));
}

async function readWeatherPostBody(
  req: HttpIncomingMessage & { body?: unknown },
): Promise<{ city?: string; location?: string; timeZone?: string }> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      return JSON.parse(req.body) as { city?: string; location?: string; timeZone?: string };
    }
    return req.body as { city?: string; location?: string; timeZone?: string };
  }
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer | string) => {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      total += buf.length;
      if (total > 16 * 1024) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(buf);
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('INVALID_JSON'));
      }
    });
    req.on('error', reject);
  });
}

export async function handleWeatherRequest(
  req: HttpIncomingMessage & { body?: unknown },
  res: ServerResponse,
): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  let cityQuery: string | undefined;
  let timeZoneQuery: string | undefined;

  if (req.method === 'GET') {
    const parsedUrl = new URL(req.url ?? '/api/weather', 'http://localhost');
    cityQuery =
      parsedUrl.searchParams.get('city')?.trim() ||
      parsedUrl.searchParams.get('q')?.trim() ||
      parsedUrl.searchParams.get('location')?.trim() ||
      undefined;
    timeZoneQuery =
      parsedUrl.searchParams.get('tz')?.trim() ||
      parsedUrl.searchParams.get('timeZone')?.trim() ||
      undefined;
  } else if (req.method === 'POST') {
    try {
      const body = await readWeatherPostBody(req);
      cityQuery =
        (typeof body.city === 'string' && body.city.trim()) ||
        (typeof body.location === 'string' && body.location.trim()) ||
        undefined;
      timeZoneQuery =
        typeof body.timeZone === 'string' && body.timeZone.trim()
          ? body.timeZone.trim()
          : undefined;
    } catch {
      writeWeatherJson(res, 400, {
        ok: false,
        error: 'Invalid JSON request body.',
        code: 'INVALID_JSON',
        retryable: false,
      });
      return;
    }
  } else {
    writeWeatherJson(res, 405, {
      ok: false,
      error: 'Method not allowed.',
      code: 'METHOD_NOT_ALLOWED',
      retryable: false,
    });
    return;
  }

  const startMs = Date.now();
  const result = await fetchLiveWeatherData({
    locationQuery: cityQuery,
    clientTimeZone: isValidTimeZone(timeZoneQuery) ? timeZoneQuery : undefined,
  });
  const dur = Date.now() - startMs;
  res.setHeader('Server-Timing', `weather;desc="${result.ok && result.cached ? 'cache' : 'open-meteo'}";dur=${dur}`);

  if (!result.ok) {
    const status =
      result.reason === 'MISSING_LOCATION'
        ? 400
        : result.reason === 'NOT_FOUND'
          ? 404
          : 502;
    writeWeatherJson(res, status, {
      ok: false,
      error: result.error,
      code: result.reason,
      retryable: result.reason === 'PROVIDER_ERROR',
    });
    return;
  }

  writeWeatherJson(
    res,
    200,
    {
      ok: true,
      cached: result.cached,
      data: result.data,
    },
    'public, max-age=60, s-maxage=180',
  );
}
