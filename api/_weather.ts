import {
  findKnownCity,
  formatDateTimeReply,
  isValidTimeZone,
} from '../src/lib/dateTimeHelper.js';

const WEATHER_TIMEOUT_MS = 5000;

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

  // Avoid hijacking unrelated general questions like "why does weather change" or "how does temperature affect batteries"
  if (
    /\b(why\s+does|how\s+does|explain|define|what\s+causes|poem|story|code|api|app)\b/i.test(
      lower,
    )
  ) {
    return null;
  }

  const prepMatch =
    /\b(?:weather|forecast|temperature|temp|mausam|mosam)\s+(?:right\s+now\s+|today\s+|currently\s+)?(?:in|for|at|of)\s+([a-zA-Z\s-]{2,40})$/i.exec(
      lower,
    ) ||
    /\b(?:in|for|at|of)\s+([a-zA-Z\s-]{2,40})\s+(?:today|now|currently|right\s+now)?$/i.exec(
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
    /^([a-zA-Z\s-]{2,30}?)\s+(?:ka|ki|ke|me|mein)?\s*(?:current\s+|today'?s?\s+)?(?:weather|forecast|temperature|mausam|mosam)(?:\s+(?:kaisa\s+hai|kya\s+hai|today|now))?$/i.exec(
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

export async function fetchLiveWeatherReply(options: {
  locationQuery?: string;
  clientTimeZone?: string;
  preferUrdu: boolean;
}): Promise<string> {
  const targetLocation =
    options.locationQuery || inferCityFromTimeZone(options.clientTimeZone);

  if (!targetLocation) {
    return options.preferUrdu
      ? 'Barah-e-karam shehar ka naam batayein (maslan "Karachi ka mausam") taake main aap ko live weather bata sakoon.'
      : 'Please specify a city or location (for example, "weather in Karachi") so I can fetch live weather data.';
  }

  try {
    const geo = await geocodeLocation(targetLocation);
    if (!geo) {
      return options.preferUrdu
        ? `Maaf kijiye, "${targetLocation}" ke liye live weather data nahi mil saka. Barah-e-karam kisi mashhoor shehar ka naam dobara check karein.`
        : `I couldn't find live weather data for "${targetLocation}". Please check the city name and try again.`;
    }

    const forecastUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
      `&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`;

    const wx = await fetchJsonWithTimeout<OpenMeteoForecastResponse>(forecastUrl);
    if (!wx.current || typeof wx.current.temperature_2m !== 'number') {
      throw new Error('WEATHER_DATA_MISSING');
    }

    const tz = isValidTimeZone(wx.timezone)
      ? wx.timezone
      : isValidTimeZone(geo.timezone)
        ? geo.timezone
        : 'UTC';

    const now = new Date();
    const dateStr = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(now);
    const timeStr = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    }).format(now);

    const locationLabel =
      geo.country && geo.country !== geo.name ? `${geo.name}, ${geo.country}` : geo.name;
    const tempC = Math.round(wx.current.temperature_2m);
    const feelsC =
      typeof wx.current.apparent_temperature === 'number'
        ? Math.round(wx.current.apparent_temperature)
        : undefined;
    const humidity = wx.current.relative_humidity_2m;
    const wind =
      typeof wx.current.wind_speed_10m === 'number'
        ? Math.round(wx.current.wind_speed_10m)
        : undefined;
    const highC =
      typeof wx.daily?.temperature_2m_max?.[0] === 'number'
        ? Math.round(wx.daily.temperature_2m_max[0])
        : undefined;
    const lowC =
      typeof wx.daily?.temperature_2m_min?.[0] === 'number'
        ? Math.round(wx.daily.temperature_2m_min[0])
        : undefined;
    const condition = describeWmoWeatherCode(wx.current.weather_code, options.preferUrdu);

    if (options.preferUrdu) {
      const lines = [
        `**${locationLabel} ka Live Mausam** (${dateStr} · ${timeStr})`,
        `- **Condition:** ${condition}`,
        `- **Temperature:** ${tempC}°C${feelsC !== undefined ? ` (Feels like ${feelsC}°C)` : ''}`,
      ];
      if (highC !== undefined && lowC !== undefined) {
        lines.push(`- **Aaj ka High / Low:** ${highC}°C / ${lowC}°C`);
      }
      if (typeof humidity === 'number') {
        lines.push(`- **Humidity:** ${humidity}%`);
      }
      if (wind !== undefined) {
        lines.push(`- **Hawa (Wind):** ${wind} km/h`);
      }
      return lines.join('\n');
    }

    const lines = [
      `**Current Weather in ${locationLabel}** (${dateStr} · ${timeStr})`,
      `- **Condition:** ${condition}`,
      `- **Temperature:** ${tempC}°C${feelsC !== undefined ? ` (Feels like ${feelsC}°C)` : ''}`,
    ];
    if (highC !== undefined && lowC !== undefined) {
      lines.push(`- **Today's High / Low:** ${highC}°C / ${lowC}°C`);
    }
    if (typeof humidity === 'number') {
      lines.push(`- **Humidity:** ${humidity}%`);
    }
    if (wind !== undefined) {
      lines.push(`- **Wind:** ${wind} km/h`);
    }
    return lines.join('\n');
  } catch {
    return options.preferUrdu
      ? `Is waqt **${targetLocation}** ka live weather data haasil nahi ho saka. Barah-e-karam kuch dair baad dobara koshish karein.`
      : `Live weather data for **${targetLocation}** is temporarily unavailable right now. Please try again in a moment.`;
  }
}
