// server.ts
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// api/_gemini.ts
import dotenv from "dotenv";
import {
  GoogleGenAI,
  ThinkingLevel,
  Type
} from "@google/genai";

// src/lib/dateTimeHelper.ts
var KNOWN_CITIES = {
  karachi: {
    name: "Karachi",
    country: "Pakistan",
    latitude: 24.8608,
    longitude: 67.0104,
    timeZone: "Asia/Karachi"
  },
  lahore: {
    name: "Lahore",
    country: "Pakistan",
    latitude: 31.558,
    longitude: 74.3507,
    timeZone: "Asia/Karachi"
  },
  islamabad: {
    name: "Islamabad",
    country: "Pakistan",
    latitude: 33.7215,
    longitude: 73.0433,
    timeZone: "Asia/Karachi"
  },
  rawalpindi: {
    name: "Rawalpindi",
    country: "Pakistan",
    latitude: 33.5973,
    longitude: 73.0479,
    timeZone: "Asia/Karachi"
  },
  faisalabad: {
    name: "Faisalabad",
    country: "Pakistan",
    latitude: 31.4167,
    longitude: 73.0833,
    timeZone: "Asia/Karachi"
  },
  multan: {
    name: "Multan",
    country: "Pakistan",
    latitude: 30.1968,
    longitude: 71.4782,
    timeZone: "Asia/Karachi"
  },
  peshawar: {
    name: "Peshawar",
    country: "Pakistan",
    latitude: 34.008,
    longitude: 71.5785,
    timeZone: "Asia/Karachi"
  },
  quetta: {
    name: "Quetta",
    country: "Pakistan",
    latitude: 30.1841,
    longitude: 67.0014,
    timeZone: "Asia/Karachi"
  },
  hyderabad: {
    name: "Hyderabad",
    country: "Pakistan",
    latitude: 25.3924,
    longitude: 68.3737,
    timeZone: "Asia/Karachi"
  },
  sialkot: {
    name: "Sialkot",
    country: "Pakistan",
    latitude: 32.4927,
    longitude: 74.5313,
    timeZone: "Asia/Karachi"
  },
  pakistan: {
    name: "Islamabad",
    country: "Pakistan",
    latitude: 33.7215,
    longitude: 73.0433,
    timeZone: "Asia/Karachi"
  },
  dubai: {
    name: "Dubai",
    country: "United Arab Emirates",
    latitude: 25.2048,
    longitude: 55.2708,
    timeZone: "Asia/Dubai"
  },
  "abu dhabi": {
    name: "Abu Dhabi",
    country: "United Arab Emirates",
    latitude: 24.4539,
    longitude: 54.3773,
    timeZone: "Asia/Dubai"
  },
  riyadh: {
    name: "Riyadh",
    country: "Saudi Arabia",
    latitude: 24.7136,
    longitude: 46.6753,
    timeZone: "Asia/Riyadh"
  },
  jeddah: {
    name: "Jeddah",
    country: "Saudi Arabia",
    latitude: 21.4858,
    longitude: 39.1925,
    timeZone: "Asia/Riyadh"
  },
  makkah: {
    name: "Makkah",
    country: "Saudi Arabia",
    latitude: 21.3891,
    longitude: 39.8579,
    timeZone: "Asia/Riyadh"
  },
  doha: {
    name: "Doha",
    country: "Qatar",
    latitude: 25.2854,
    longitude: 51.531,
    timeZone: "Asia/Qatar"
  },
  london: {
    name: "London",
    country: "United Kingdom",
    latitude: 51.5085,
    longitude: -0.1257,
    timeZone: "Europe/London"
  },
  "new york": {
    name: "New York",
    country: "United States",
    latitude: 40.7128,
    longitude: -74.006,
    timeZone: "America/New_York"
  },
  "los angeles": {
    name: "Los Angeles",
    country: "United States",
    latitude: 34.0522,
    longitude: -118.2437,
    timeZone: "America/Los_Angeles"
  },
  chicago: {
    name: "Chicago",
    country: "United States",
    latitude: 41.8781,
    longitude: -87.6298,
    timeZone: "America/Chicago"
  },
  toronto: {
    name: "Toronto",
    country: "Canada",
    latitude: 43.6532,
    longitude: -79.3832,
    timeZone: "America/Toronto"
  },
  istanbul: {
    name: "Istanbul",
    country: "Turkey",
    latitude: 41.0082,
    longitude: 28.9784,
    timeZone: "Europe/Istanbul"
  },
  paris: {
    name: "Paris",
    country: "France",
    latitude: 48.8566,
    longitude: 2.3522,
    timeZone: "Europe/Paris"
  },
  berlin: {
    name: "Berlin",
    country: "Germany",
    latitude: 52.52,
    longitude: 13.405,
    timeZone: "Europe/Berlin"
  },
  tokyo: {
    name: "Tokyo",
    country: "Japan",
    latitude: 35.6762,
    longitude: 139.6503,
    timeZone: "Asia/Tokyo"
  },
  singapore: {
    name: "Singapore",
    country: "Singapore",
    latitude: 1.3521,
    longitude: 103.8198,
    timeZone: "Asia/Singapore"
  },
  sydney: {
    name: "Sydney",
    country: "Australia",
    latitude: -33.8688,
    longitude: 151.2093,
    timeZone: "Australia/Sydney"
  },
  delhi: {
    name: "Delhi",
    country: "India",
    latitude: 28.6139,
    longitude: 77.209,
    timeZone: "Asia/Kolkata"
  },
  mumbai: {
    name: "Mumbai",
    country: "India",
    latitude: 19.076,
    longitude: 72.8777,
    timeZone: "Asia/Kolkata"
  },
  dhaka: {
    name: "Dhaka",
    country: "Bangladesh",
    latitude: 23.8103,
    longitude: 90.4125,
    timeZone: "Asia/Dhaka"
  },
  kabul: {
    name: "Kabul",
    country: "Afghanistan",
    latitude: 34.5553,
    longitude: 69.2075,
    timeZone: "Asia/Kabul"
  },
  tehran: {
    name: "Tehran",
    country: "Iran",
    latitude: 35.6892,
    longitude: 51.389,
    timeZone: "Asia/Tehran"
  },
  cairo: {
    name: "Cairo",
    country: "Egypt",
    latitude: 30.0444,
    longitude: 31.2357,
    timeZone: "Africa/Cairo"
  },
  beijing: {
    name: "Beijing",
    country: "China",
    latitude: 39.9042,
    longitude: 116.4074,
    timeZone: "Asia/Shanghai"
  },
  shanghai: {
    name: "Shanghai",
    country: "China",
    latitude: 31.2304,
    longitude: 121.4737,
    timeZone: "Asia/Shanghai"
  },
  "kuala lumpur": {
    name: "Kuala Lumpur",
    country: "Malaysia",
    latitude: 3.139,
    longitude: 101.6869,
    timeZone: "Asia/Kuala_Lumpur"
  }
};
function findKnownCity(query) {
  const cleaned = query.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return KNOWN_CITIES[cleaned] ?? null;
}
var KNOWN_CITY_KEYS = Object.keys(KNOWN_CITIES).sort((a, b) => b.length - a.length);
function extractMentionedKnownCities(text, limit = 3) {
  const normalized = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim()} `;
  const found = [];
  const seenNames = /* @__PURE__ */ new Set();
  for (const key of KNOWN_CITY_KEYS) {
    if (normalized.includes(` ${key} `)) {
      const city = KNOWN_CITIES[key];
      if (!seenNames.has(city.name)) {
        seenNames.add(city.name);
        found.push(city);
        if (found.length >= limit) break;
      }
    }
  }
  return found;
}
function isValidTimeZone(tz) {
  if (!tz || typeof tz !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(/* @__PURE__ */ new Date());
    return true;
  } catch {
    return false;
  }
}
function cleanLocationFragment(raw) {
  const cleaned = raw.replace(/\b(today|right\s+now|currently|now|please|aaj|abhi|is\s+waqt)\b/gi, " ").replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
  return cleaned.length > 1 ? cleaned : void 0;
}
function parseDateTimeQuery(text) {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 90) return null;
  const lower = trimmed.toLowerCase().replace(/[?.!,]+$/g, "").trim();
  if (/\b(history|born|event|holiday|astrology|zodiac|calculate|convert|difference|between|days\s+until|how\s+many\s+days)\b/i.test(
    lower
  )) {
    return null;
  }
  const hasDateAndTime = /\b(date\s+and\s+time|time\s+and\s+date|tareekh\s+aur\s+waqt|date\s+aur\s+time)\b/i.test(
    lower
  );
  const asksDate = /^(what\s+is\s+|what'?s\s+|tell\s+me\s+|check\s+|give\s+me\s+)?(today'?s?|the\s+current|current|the)?\s*(date|day\s+and\s+date|day\s+of\s+(?:the\s+)?week)(\s+(today|right\s+now|please|in\s+.+|at\s+.+|for\s+.+|of\s+.+))?$/i.test(
    lower
  ) || /^(today'?s?\s+date|today\s+date|current\s+date|date\s+please|what\s+day\s+is\s+(?:it|today)|aaj\s+(?:ki\s+)?(?:kya\s+)?(?:date|tareekh|tarikh|din)\s*(?:kya\s+hai|kia\s+hai|kon\s*sa\s+hai|hai)?|(?:date|tareekh)\s+(?:kya\s+hai|kia\s+hai|in\s+.+|of\s+.+))$/i.test(
    lower
  ) || /^(?:[a-z\s]+?)\s+(?:me|mein)\s+aaj\s+(?:ki\s+)?(?:kya\s+)?(?:date|tareekh)\s*(?:kya\s+hai|hai)?$/i.test(
    lower
  ) || /^[a-z\s-]{2,30}\s+(?:today'?s?\s+)?date$/i.test(lower);
  const asksTime = /^(what\s+is\s+|what'?s\s+|tell\s+me\s+|check\s+|give\s+me\s+)?(the\s+)?(current\s+|local\s+)?time(\s+(is\s+it|now|right\s+now|please|in\s+.+|at\s+.+|for\s+.+|of\s+.+))?$/i.test(
    lower
  ) || /^(what\s+time\s+is\s+it|time\s+please|abhi\s+kya\s+(?:time|waqt)\s+(?:hua\s+)?hai|time\s+kya\s+hua\s+hai)(.*)$/i.test(
    lower
  ) || /^(?:[a-z\s]+?)\s+(?:me|mein)\s+(?:abhi\s+)?kya\s+(?:time|waqt)\s+(?:hua\s+)?hai$/i.test(
    lower
  ) || /^[a-z\s-]{2,30}\s+(?:current\s+|local\s+)?time$/i.test(lower);
  if (!hasDateAndTime && !asksDate && !asksTime) {
    return null;
  }
  let locationQuery;
  const prepMatch = /\b(?:in|at|for|of)\s+([a-zA-Z\s-]{2,40})$/i.exec(lower);
  if (prepMatch) {
    const candidate = cleanLocationFragment(prepMatch[1]);
    if (candidate && !/^(today|todays|the\s+week|week|month|year|day|now|right\s+now)$/i.test(candidate)) {
      locationQuery = candidate;
    }
  } else {
    const urduCityMatch = /^([a-zA-Z\s-]{2,30})\s+(?:mein|me)\s+(?:aaj|abhi|kya|date|tareekh|tarikh|time|waqt)\b/i.exec(
      lower
    );
    if (urduCityMatch) {
      const candidate = cleanLocationFragment(urduCityMatch[1]);
      if (candidate && !/^(tell|give|show|ask|let|help|remind|send|what|check)$/i.test(candidate)) {
        locationQuery = candidate;
      }
    } else {
      const strippedPrefix = lower.replace(
        /^(?:please\s+|can\s+you\s+)?(?:what\s+is\s+|what'?s\s+|tell\s+me\s+|give\s+me\s+|show\s+me\s+|check\s+)?(?:the\s+)?/i,
        ""
      ).trim();
      const prefixCityMatch = /^([a-zA-Z\s-]{2,30}?)\s+(?:current\s+|local\s+|today'?s?\s+)?(?:date|time)$/i.exec(
        strippedPrefix
      );
      if (prefixCityMatch) {
        const candidate = cleanLocationFragment(prefixCityMatch[1]);
        if (candidate && !/^(today|todays|current|local|the|what|what\s+is|whats|check|tell|tell\s+me|give|give\s+me|me|is)$/i.test(
          candidate
        )) {
          locationQuery = candidate;
        }
      }
    }
  }
  return {
    kind: hasDateAndTime ? "datetime" : asksTime && !asksDate ? "time" : "date",
    locationQuery
  };
}
function buildStructuredDateTime(timeZone, locationLabel, now = /* @__PURE__ */ new Date()) {
  const tz = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(now);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short"
  }).format(now);
  const isoDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
  return {
    location: locationLabel ?? tz,
    timeZone: tz,
    date,
    isoDate,
    time
  };
}
function formatDateTimeReply(options) {
  const { date: dateStr, time: timeStr } = buildStructuredDateTime(
    options.timeZone,
    options.locationLabel,
    options.now
  );
  const where = options.locationLabel ? ` in **${options.locationLabel}**` : "";
  const whereUrdu = options.locationLabel ? ` **${options.locationLabel}** mein` : "";
  if (options.preferUrdu) {
    if (options.kind === "time") {
      return `Abhi${whereUrdu} waqt **${timeStr}** hai (${dateStr}).`;
    }
    if (options.kind === "datetime") {
      return `Aaj${whereUrdu} tareekh **${dateStr}** aur waqt **${timeStr}** hai.`;
    }
    return `Aaj${whereUrdu} **${dateStr}** hai (local time: ${timeStr}).`;
  }
  if (options.kind === "time") {
    return `The current time${where} is **${timeStr}** (${dateStr}).`;
  }
  if (options.kind === "datetime") {
    return `Current date and time${where}: **${dateStr}**, **${timeStr}**.`;
  }
  return `Today's date${where} is **${dateStr}** (current local time: ${timeStr}).`;
}

// src/lib/quickReplies.ts
function normalizePhrase(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}
function isUrduScript(text) {
  return /[\u0600-\u06FF]/.test(text);
}
function looksLikeRomanUrdu(text) {
  const norm = ` ${normalizePhrase(text)} `;
  if (/\s(urdu|roman\s+urdu)\s+(me|main|mein)\s/.test(norm)) {
    return true;
  }
  return /\s(kya|kaise|kese|haal|hai|hain|hoon|hun|mujhe|mjhe|batao|btao|samjhao|likho|karo|kro|krna|karna|nahi|nhi|haan|aap|mein|shukriya|madad|chahiye|chahie|zaroor|theek|bilkul|kyun|kahan|kab|kon|kaun)\s/.test(
    norm
  );
}
function matchInstantReply(text, currentLanguage = "auto", clientTimeZone) {
  const rawTrimmed = text.trim();
  if (!rawTrimmed || rawTrimmed.length > 90) return null;
  const norm = normalizePhrase(rawTrimmed);
  if (!norm) return null;
  if (/^(please\s+)?(can\s+you\s+)?(urdu\s*(me|mein|main|mai|m)?\s*(bat|baat|jawab)\s*(karo|kro|kren|karein|karen|karain|bol|bolo|do|dein|den)|speak\s+in\s+urdu|talk\s+in\s+urdu|reply\s+in\s+urdu|urdu\s+please|urdu)$/.test(
    norm
  ) || rawTrimmed === "\u0627\u0631\u062F\u0648 \u0645\u06CC\u06BA \u0628\u0627\u062A \u06A9\u0631\u0648" || rawTrimmed === "\u0627\u0631\u062F\u0648 \u0645\u06CC\u06BA \u062C\u0648\u0627\u0628 \u062F\u0648") {
    return {
      reply: "Bilkul! Ab main aap se Urdu mein baat karunga. Aap kya poochna chahte hain?",
      nextLanguage: "urdu"
    };
  }
  if (/^(please\s+)?(can\s+you\s+)?(english\s*(me|mein|main|mai|m)?\s*(bat|baat|jawab)\s*(karo|kro|kren|karein|do|dein)|speak\s+in\s+english|talk\s+in\s+english|reply\s+in\s+english|english\s+please)$/.test(
    norm
  )) {
    return {
      reply: "Sure! I'll respond in English from now on. How can I help you?",
      nextLanguage: "english"
    };
  }
  const preferUrdu = currentLanguage === "urdu" || isUrduScript(rawTrimmed) || looksLikeRomanUrdu(rawTrimmed);
  const dateQuery = parseDateTimeQuery(rawTrimmed);
  if (dateQuery) {
    if (!dateQuery.locationQuery) {
      const tz = isValidTimeZone(clientTimeZone) ? clientTimeZone : "UTC";
      return {
        reply: formatDateTimeReply({
          kind: dateQuery.kind,
          timeZone: tz,
          preferUrdu
        })
      };
    }
    const city = findKnownCity(dateQuery.locationQuery);
    if (city) {
      const label = city.country && city.country !== city.name ? `${city.name}, ${city.country}` : city.name;
      return {
        reply: formatDateTimeReply({
          kind: dateQuery.kind,
          timeZone: city.timeZone,
          locationLabel: label,
          preferUrdu
        })
      };
    }
    return null;
  }
  if (rawTrimmed.length > 60) return null;
  if (/^(as+\s*s?alam\s*(o|u|al)?\s*(a?l+a?[iy]+k+u?m|ale?kum|alikum)|aslam\s*(o|u)?\s*(alaikum|alikum|alekum|alaykum)|salam(\s+alaikum|\s+alikum|\s+alaykum)?|aoa|walaikum\s*assalam)$/.test(
    norm
  ) || rawTrimmed === "\u0627\u0644\u0633\u0644\u0627\u0645 \u0639\u0644\u06CC\u06A9\u0645" || rawTrimmed === "\u0633\u0644\u0627\u0645") {
    return {
      reply: "Wa Alaikum Assalam! Kya haal hain? Main aap ki kya madad kar sakta hoon?"
    };
  }
  if (/^(hi+(\s+there)?|hello+(\s+there)?|helo+|hey+(\s+there)?|hlo|good\s+(morning|afternoon|evening))$/.test(norm)) {
    if (currentLanguage === "urdu") {
      return {
        reply: "Assalam Alaikum! Main aap ki kya madad kar sakta hoon?"
      };
    }
    if (norm.startsWith("good morning")) {
      return { reply: "Good morning! How can I help you today?" };
    }
    if (norm.startsWith("good afternoon")) {
      return { reply: "Good afternoon! How can I help you today?" };
    }
    if (norm.startsWith("good evening")) {
      return { reply: "Good evening! How can I help you today?" };
    }
    return {
      reply: "Hi! How can I help you?"
    };
  }
  if (/^(how\s+(are|r)\s+(you|u)|how\s+do\s+you\s+do|kya\s+haal\s+(hai|hain)|kese\s+ho|kaise\s+ho|theek\s+ho|ap\s+kaise\s+hain|aap\s+kaise\s+hain)$/.test(
    norm
  )) {
    if (preferUrdu) {
      return {
        reply: "Alhamdulillah, main bilkul theek hoon! Aap sunayein, main aap ki kya madad kar sakta hoon?"
      };
    }
    return {
      reply: "I'm doing great, thanks for asking! How can I help you?"
    };
  }
  if (/^(thanks|thank\s+you|thank\s+u|thx|ty|shukriya|shukria|jazakallah(\s+khair)?|meherbani)$/.test(
    norm
  )) {
    if (preferUrdu) {
      return {
        reply: "Aap ka shukriya! Agar koi aur sawal ho to zaroor poochein."
      };
    }
    return {
      reply: "You're welcome! Let me know if you need anything else."
    };
  }
  if (/^(bye+|goodbye|see\s+you|allah\s+hafiz|khuda\s+hafiz)$/.test(norm)) {
    if (preferUrdu || norm.includes("hafiz")) {
      return {
        reply: "Allah Hafiz! Jab zaroorat ho dobara baat karein."
      };
    }
    return {
      reply: "Goodbye! Feel free to come back anytime."
    };
  }
  return null;
}

// api/_weather.ts
var WEATHER_TIMEOUT_MS = 4e3;
var WEATHER_CACHE_TTL_MS = 3 * 60 * 1e3;
var weatherCache = /* @__PURE__ */ new Map();
function describeWmoWeatherCode(code, preferUrdu) {
  if (code === void 0) return preferUrdu ? "Mausam ki tafseel" : "Current conditions";
  if (code === 0) return preferUrdu ? "Saaf aasman (Clear sky)" : "Clear sky";
  if (code === 1) return preferUrdu ? "Zyada tar saaf (Mainly clear)" : "Mainly clear";
  if (code === 2) return preferUrdu ? "Halke baadal (Partly cloudy)" : "Partly cloudy";
  if (code === 3) return preferUrdu ? "Ghanay baadal (Overcast)" : "Overcast";
  if (code === 45 || code === 48) return preferUrdu ? "Dhund (Fog)" : "Foggy";
  if (code >= 51 && code <= 55) return preferUrdu ? "Halki boonda-baandi (Drizzle)" : "Drizzle";
  if (code === 56 || code === 57) return preferUrdu ? "Sard boonda-baandi" : "Freezing drizzle";
  if (code >= 61 && code <= 65) return preferUrdu ? "Baarish (Rain)" : "Rain";
  if (code === 66 || code === 67) return preferUrdu ? "Sard baarish" : "Freezing rain";
  if (code >= 71 && code <= 77) return preferUrdu ? "Barf-baari (Snow)" : "Snow";
  if (code >= 80 && code <= 82) return preferUrdu ? "Tez baarish ke jhonke (Rain showers)" : "Rain showers";
  if (code === 85 || code === 86) return preferUrdu ? "Barf-baari ke jhonke" : "Snow showers";
  if (code >= 95) return preferUrdu ? "Garaj chamak ke sath toofan (Thunderstorm)" : "Thunderstorm";
  return preferUrdu ? "Mausam" : "Mixed conditions";
}
function parseWeatherQuery(text) {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 100) return null;
  const lower = trimmed.toLowerCase().replace(/[?.!,]+$/g, "").trim();
  const hasWeatherKeyword = /\b(weather|forecast|temperature|temp|mausam|mosam|barish|baarish|garmi|sardi)\b/i.test(
    lower
  );
  if (!hasWeatherKeyword) return null;
  if (/\b(why\s+does|how\s+does|explain|define|what\s+causes|poem|story|code|api|app|should\s+i|compare|better|hotter|colder|warmer|cooler|umbrella|jacket|wear|travel|tomorrow|week|date|confirm|wrong|outdated|and\s+(?:in|what|how))\b/i.test(
    lower
  )) {
    return null;
  }
  const prepMatch = /\b(?:weather|forecast|temperature|temp|mausam|mosam)\s+(?:right\s+now\s+|today\s+|currently\s+)?(?:in|for|at|of)\s+([\p{L}\p{N}\s'-]{2,45})$/iu.exec(
    lower
  ) || /\b(?:in|for|at|of)\s+([\p{L}\p{N}\s'-]{2,45})\s+(?:today|now|currently|right\s+now)?$/iu.exec(
    lower
  );
  if (prepMatch) {
    const cleaned = prepMatch[1].replace(/\b(today|right\s+now|currently|now|please|aaj|abhi)\b/gi, " ").replace(/\s+/g, " ").trim();
    return { locationQuery: cleaned || void 0 };
  }
  const prefixCityMatch = /^([\p{L}\p{N}\s'-]{2,35}?)\s+(?:ka|ki|ke|me|mein)?\s*(?:current\s+|today'?s?\s+)?(?:weather|forecast|temperature|mausam|mosam)(?:\s+(?:kaisa\s+hai|kya\s+hai|today|now))?$/iu.exec(
    lower
  );
  if (prefixCityMatch) {
    const candidate = prefixCityMatch[1].replace(
      /^(what\s+is|what'?s|tell\s+me|show\s+me|check|get|give\s+me|aaj|abhi|the|current|today'?s?)\s+/gi,
      ""
    ).trim();
    if (candidate && !/^(what|tell|show|check|get|current|today|the|aaj|abhi|kaisa)$/i.test(candidate)) {
      return { locationQuery: candidate };
    }
  }
  return { locationQuery: void 0 };
}
async function fetchJsonWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEATHER_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });
    if (!res.ok) {
      throw new Error(`HTTP_${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}
async function geocodeLocation(query) {
  const known = findKnownCity(query);
  if (known) {
    return {
      name: known.name,
      country: known.country,
      latitude: known.latitude,
      longitude: known.longitude,
      timezone: known.timeZone
    };
  }
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    query
  )}&count=1&language=en&format=json`;
  const data = await fetchJsonWithTimeout(url);
  return data.results?.[0] ?? null;
}
async function resolveDateTimeToolData(options) {
  if (!options.locationQuery) {
    const tz = isValidTimeZone(options.clientTimeZone) ? options.clientTimeZone : "UTC";
    return { ok: true, ...buildStructuredDateTime(tz) };
  }
  try {
    const geo = await geocodeLocation(options.locationQuery);
    if (!geo || !isValidTimeZone(geo.timezone)) {
      return {
        ok: false,
        error: `Could not resolve timezone for "${options.locationQuery}".`
      };
    }
    const label = geo.country && geo.country !== geo.name ? `${geo.name}, ${geo.country}` : geo.name;
    return {
      ok: true,
      ...buildStructuredDateTime(geo.timezone, label)
    };
  } catch {
    return {
      ok: false,
      error: `Unable to look up timezone for "${options.locationQuery}".`
    };
  }
}
async function resolveDynamicDateTimeReply(options) {
  if (!options.locationQuery) {
    const tz = isValidTimeZone(options.clientTimeZone) ? options.clientTimeZone : "UTC";
    return formatDateTimeReply({
      kind: options.kind,
      timeZone: tz,
      preferUrdu: options.preferUrdu
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
      preferUrdu: options.preferUrdu
    });
  } catch {
    return null;
  }
}
function inferCityFromTimeZone(tz) {
  if (!tz || !tz.includes("/")) return void 0;
  const cityPart = tz.split("/").pop();
  if (!cityPart) return void 0;
  return cityPart.replace(/_/g, " ");
}
async function fetchLiveWeatherData(options) {
  const targetLocation = options.locationQuery || inferCityFromTimeZone(options.clientTimeZone);
  if (!targetLocation) {
    return {
      ok: false,
      error: "No city or location was specified."
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
        error: `Location "${targetLocation}" was not found.`
      };
    }
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`;
    const wx = await fetchJsonWithTimeout(forecastUrl);
    if (!wx.current || typeof wx.current.temperature_2m !== "number") {
      return {
        ok: false,
        target: targetLocation,
        error: "Live weather fields were unavailable from the weather provider."
      };
    }
    const tz = isValidTimeZone(wx.timezone) ? wx.timezone : isValidTimeZone(geo.timezone) ? geo.timezone : "UTC";
    const { date, time: localTime } = buildStructuredDateTime(tz);
    const locationLabel = geo.country && geo.country !== geo.name ? `${geo.name}, ${geo.country}` : geo.name;
    const liveData = {
      location: locationLabel,
      timeZone: tz,
      date,
      localTime,
      condition: describeWmoWeatherCode(wx.current.weather_code, false),
      conditionUrdu: describeWmoWeatherCode(wx.current.weather_code, true),
      temperatureC: Math.round(wx.current.temperature_2m),
      feelsLikeC: typeof wx.current.apparent_temperature === "number" ? Math.round(wx.current.apparent_temperature) : void 0,
      highC: typeof wx.daily?.temperature_2m_max?.[0] === "number" ? Math.round(wx.daily.temperature_2m_max[0]) : void 0,
      lowC: typeof wx.daily?.temperature_2m_min?.[0] === "number" ? Math.round(wx.daily.temperature_2m_min[0]) : void 0,
      humidityPercent: wx.current.relative_humidity_2m,
      windSpeedKmh: typeof wx.current.wind_speed_10m === "number" ? Math.round(wx.current.wind_speed_10m) : void 0
    };
    if (weatherCache.size >= 100) {
      const oldestKey = weatherCache.keys().next().value;
      if (oldestKey) weatherCache.delete(oldestKey);
    }
    weatherCache.set(cacheKey, {
      expiresAt: Date.now() + WEATHER_CACHE_TTL_MS,
      data: liveData
    });
    return {
      ok: true,
      data: liveData
    };
  } catch {
    return {
      ok: false,
      target: targetLocation,
      error: `Unable to retrieve live weather data for "${targetLocation}" right now.`
    };
  }
}
async function preGroundLiveWeatherContext(text, clientTimeZone) {
  const cities = extractMentionedKnownCities(text, 3);
  if (cities.length === 0) {
    return { groundedFacts: "", cityCount: 0 };
  }
  const results = await Promise.all(
    cities.map(async (city) => {
      const res = await fetchLiveWeatherData({
        locationQuery: city.name,
        clientTimeZone
      });
      return res.ok ? `${res.data.location} (${res.data.date} ${res.data.localTime}): ${res.data.condition}, ${res.data.temperatureC}\xB0C (feels like ${res.data.feelsLikeC ?? res.data.temperatureC}\xB0C), high/low ${res.data.highC ?? "-"}\xB0C/${res.data.lowC ?? "-"}\xB0C, humidity ${res.data.humidityPercent ?? "-"}%, wind ${res.data.windSpeedKmh ?? "-"} km/h.` : `${city.name}: live weather unavailable (${res.error}).`;
    })
  );
  return {
    groundedFacts: results.join(" | "),
    cityCount: cities.length
  };
}
async function fetchLiveWeatherReply(options) {
  const result = await fetchLiveWeatherData({
    locationQuery: options.locationQuery,
    clientTimeZone: options.clientTimeZone
  });
  if (!result.ok) {
    if (!result.target) {
      return options.preferUrdu ? 'Barah-e-karam shehar ka naam batayein (maslan "Karachi ka mausam") taake main aap ko live weather bata sakoon.' : 'Please specify a city or location (for example, "weather in Karachi") so I can fetch live weather data.';
    }
    return options.preferUrdu ? `Is waqt **${result.target}** ka live weather data haasil nahi ho saka. Barah-e-karam kuch dair baad dobara koshish karein.` : `Live weather data for **${result.target}** is temporarily unavailable right now. Please try again in a moment.`;
  }
  const d = result.data;
  if (options.preferUrdu) {
    const lines2 = [
      `**${d.location} ka Live Mausam** (${d.date} \xB7 ${d.localTime})`,
      `- **Condition:** ${d.conditionUrdu}`,
      `- **Temperature:** ${d.temperatureC}\xB0C${d.feelsLikeC !== void 0 ? ` (Feels like ${d.feelsLikeC}\xB0C)` : ""}`
    ];
    if (d.highC !== void 0 && d.lowC !== void 0) {
      lines2.push(`- **Aaj ka High / Low:** ${d.highC}\xB0C / ${d.lowC}\xB0C`);
    }
    if (typeof d.humidityPercent === "number") {
      lines2.push(`- **Humidity:** ${d.humidityPercent}%`);
    }
    if (d.windSpeedKmh !== void 0) {
      lines2.push(`- **Hawa (Wind):** ${d.windSpeedKmh} km/h`);
    }
    return lines2.join("\n");
  }
  const lines = [
    `**Current Weather in ${d.location}** (${d.date} \xB7 ${d.localTime})`,
    `- **Condition:** ${d.condition}`,
    `- **Temperature:** ${d.temperatureC}\xB0C${d.feelsLikeC !== void 0 ? ` (Feels like ${d.feelsLikeC}\xB0C)` : ""}`
  ];
  if (d.highC !== void 0 && d.lowC !== void 0) {
    lines.push(`- **Today's High / Low:** ${d.highC}\xB0C / ${d.lowC}\xB0C`);
  }
  if (typeof d.humidityPercent === "number") {
    lines.push(`- **Humidity:** ${d.humidityPercent}%`);
  }
  if (d.windSpeedKmh !== void 0) {
    lines.push(`- **Wind:** ${d.windSpeedKmh} km/h`);
  }
  return lines.join("\n");
}

// api/_gemini.ts
if (!process.env.VERCEL && !process.env.GEMINI_API_KEY) {
  dotenv.config({ path: ".env.local" });
  dotenv.config({ path: ".env" });
}
var PRIMARY_MODEL = "gemini-3.1-flash-lite";
var FALLBACK_FREE_MODEL = "gemini-4-hydrogen";
var MAX_SERVER_RETRIES = 1;
var MAX_AUTO_RETRY_DELAY_MS = 700;
var UPSTREAM_CONNECT_TIMEOUT_MS = 8500;
var STREAM_IDLE_TIMEOUT_MS = 12e3;
var MAX_BODY_BYTES = 6 * 1024 * 1024;
var LIVE_TOOL_DECLARATIONS = [
  {
    name: "get_current_date",
    description: "Get the accurate real-time current date (and day of week) for the user timezone or a requested city.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        location: {
          type: Type.STRING,
          description: "Optional city name such as Karachi, Lahore, London, or Tokyo."
        }
      }
    }
  },
  {
    name: "get_current_time",
    description: "Get the accurate real-time local clock time and timezone for the user or a requested city.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        location: {
          type: Type.STRING,
          description: "Optional city name such as Karachi, Dubai, or New York."
        }
      }
    }
  },
  {
    name: "get_live_weather",
    description: "Fetch real-time live weather conditions, temperature, feels-like, high/low, humidity, and wind speed for a city.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        location: {
          type: Type.STRING,
          description: "The city or location name, e.g. Karachi, Lahore, Islamabad, London."
        }
      },
      required: ["location"]
    }
  }
];
function hasWeatherIntent(messages) {
  const combined = messages.map((m) => m.text).join(" ").toLowerCase();
  return /\b(weather|forecast|temperature|temp|rain|mausam|mosam|humidity|wind|climate|umbrella|jacket|hotter|colder|warmer|cooler)\b/i.test(
    combined
  );
}
async function executeLiveToolCall(call, clientTimeZone) {
  const args = call.args ?? {};
  const locationQuery = typeof args.location === "string" && args.location.trim().length > 0 ? args.location.trim() : void 0;
  if (call.name === "get_current_date" || call.name === "get_current_time") {
    return await resolveDateTimeToolData({ locationQuery, clientTimeZone });
  }
  if (call.name === "get_live_weather") {
    const wx = await fetchLiveWeatherData({ locationQuery, clientTimeZone });
    if (!wx.ok) {
      return { ok: false, error: wx.error };
    }
    return { ok: true, ...wx.data };
  }
  return { ok: false, error: `Unknown tool: ${call.name ?? "unspecified"}` };
}
function buildSystemInstruction(language, latestText, hasImage, clientTimeZone, groundedWeatherFacts) {
  const tz = isValidTimeZone(clientTimeZone) ? clientTimeZone : "UTC";
  const nowInfo = buildStructuredDateTime(tz);
  const weatherSection = groundedWeatherFacts ? ` LIVE VERIFIED WEATHER DATA: ${groundedWeatherFacts}` : "";
  const dateContext = `CURRENT DATE & TIME: ${nowInfo.date}, ${nowInfo.time} (${tz}). Always use this live date/time (never outdated training dates) and never invent weather data.${weatherSection} Keep simple answers concise and direct.`;
  const imageHint = hasImage ? " Inspect the image carefully to answer." : "";
  if (isUrduScript(latestText)) {
    return `${dateContext} Reply concisely in Urdu script.${imageHint}`;
  }
  if (language === "urdu" || looksLikeRomanUrdu(latestText)) {
    return `${dateContext} Reply concisely in clear Roman Urdu.${imageHint}`;
  }
  return `${dateContext}${imageHint}`;
}
var DATA_URL_REGEX = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/;
function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}
async function readJsonBody(req) {
  if (req.body !== void 0 && req.body !== null) {
    if (typeof req.body === "string") {
      return JSON.parse(req.body);
    }
    return req.body;
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    req.on("data", (chunk) => {
      const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      totalBytes += buf.length;
      if (totalBytes > MAX_BODY_BYTES) {
        reject(new Error("PAYLOAD_TOO_LARGE"));
        req.destroy();
        return;
      }
      chunks.push(buf);
    });
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("INVALID_JSON"));
      }
    });
    req.on("error", (err) => reject(err));
  });
}
function parseImagePart(image) {
  if (!image || typeof image !== "object") return null;
  const candidate = image;
  if (typeof candidate.dataUrl !== "string") return null;
  const match = DATA_URL_REGEX.exec(candidate.dataUrl);
  if (!match) return null;
  const mimeType = match[1] === "image/jpg" ? "image/jpeg" : match[1];
  const base64Data = match[2];
  if (base64Data.length > 55e5) {
    return null;
  }
  return {
    inlineData: {
      mimeType,
      data: base64Data
    }
  };
}
var cachedGeminiClient = null;
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("GEMINI_API_KEY_MISSING");
  }
  if (cachedGeminiClient && cachedGeminiClient.apiKey === apiKey) {
    return cachedGeminiClient.client;
  }
  const client = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
  cachedGeminiClient = { apiKey, client };
  return client;
}
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("ABORTED"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("ABORTED"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
function parseDurationToSeconds(raw) {
  const trimmed = raw.trim().toLowerCase();
  const msMatch = /^(\d+(?:\.\d+)?)\s*ms$/.exec(trimmed);
  if (msMatch) {
    return Math.max(1, Math.ceil(Number(msMatch[1]) / 1e3));
  }
  const secMatch = /^(\d+(?:\.\d+)?)\s*s(?:ec(?:ond)?s?)?$/.exec(trimmed);
  if (secMatch) {
    return Math.max(1, Math.ceil(Number(secMatch[1])));
  }
  const num = Number(trimmed);
  if (Number.isFinite(num) && num > 0) {
    return Math.ceil(num);
  }
  return void 0;
}
function extractRpcErrorPayload(rawMessage) {
  const jsonStart = rawMessage.indexOf("{");
  if (jsonStart === -1) return null;
  try {
    const parsed = JSON.parse(rawMessage.slice(jsonStart));
    return parsed?.error ?? null;
  } catch {
    return null;
  }
}
function parseGeminiError(err) {
  const rawMessage = err instanceof Error ? err.message : String(err);
  if (rawMessage === "GEMINI_API_KEY_MISSING") {
    return {
      status: 500,
      code: "API_KEY_MISSING",
      message: "API configuration error. Please check your Gemini API key.",
      retryable: false
    };
  }
  const errObj = err;
  const rpcError = extractRpcErrorPayload(rawMessage);
  const httpStatus = errObj?.status ?? rpcError?.code;
  const rpcStatus = rpcError?.status?.toUpperCase() ?? "";
  const detailText = rpcError?.message ?? rawMessage;
  const lower = detailText.toLowerCase();
  let retryAfterSeconds;
  const headerRetryAfter = errObj?.headers?.get?.("retry-after") ?? errObj?.response?.headers?.["retry-after"];
  if (headerRetryAfter) {
    retryAfterSeconds = parseDurationToSeconds(headerRetryAfter);
  }
  if (rpcError?.details) {
    for (const detail of rpcError.details) {
      if (detail["@type"]?.includes("RetryInfo") && typeof detail.retryDelay === "string") {
        const parsed = parseDurationToSeconds(detail.retryDelay);
        if (parsed !== void 0) {
          retryAfterSeconds = parsed;
        }
      }
    }
  }
  if (retryAfterSeconds === void 0) {
    const textRetryMatch = /retry\s+(?:in|after)\s+(\d+(?:\.\d+)?\s*(?:ms|s(?:ec(?:ond)?s?)?))/i.exec(
      detailText
    );
    if (textRetryMatch) {
      retryAfterSeconds = parseDurationToSeconds(textRetryMatch[1]);
    }
  }
  if (httpStatus === 401 || httpStatus === 403 || rpcStatus === "PERMISSION_DENIED" || rpcStatus === "UNAUTHENTICATED" || lower.includes("api_key_invalid") || lower.includes("api key not valid") || lower.includes("api key expired")) {
    return {
      status: 403,
      code: "API_KEY_INVALID",
      message: "API configuration error. Please check your Gemini API key.",
      retryable: false
    };
  }
  const isRateOrQuota = httpStatus === 429 || rpcStatus === "RESOURCE_EXHAUSTED" || lower.includes("resource_exhausted") || lower.includes("rate limit") || lower.includes("too many requests") || lower.includes("quota");
  if (isRateOrQuota) {
    const violations = rpcError?.details?.flatMap(
      (d) => Array.isArray(d.violations) ? d.violations : []
    ) ?? [];
    const hasZeroLimit = violations.some((v) => v.quotaValue === "0") || /\blimit:\s*0\b/i.test(detailText);
    const hasDailyViolation = violations.some(
      (v) => v.quotaId && /perday|daily/i.test(v.quotaId) || v.quotaMetric && /per_day|daily/i.test(v.quotaMetric)
    ) || /requestsperday|per\s*day|daily\s*limit|free_tier_requests.*limit:\s*0/i.test(detailText);
    const hasMinuteViolation = violations.some(
      (v) => v.quotaId && /perminute/i.test(v.quotaId) || v.quotaMetric && /per_minute/i.test(v.quotaMetric)
    ) || /per\s*minute|rpm|tpm|too many requests/i.test(detailText);
    if (hasZeroLimit || hasDailyViolation && !hasMinuteViolation) {
      return {
        status: 429,
        code: "DAILY_QUOTA_EXCEEDED",
        message: "Your Gemini free-tier quota has been reached. Please try again when your quota resets.",
        retryable: false
      };
    }
    return {
      status: 429,
      code: "RATE_LIMITED_TEMPORARY",
      message: "Too many requests. Please wait a moment and try again.",
      retryable: true,
      retryAfterSeconds: retryAfterSeconds ?? 5
    };
  }
  if (httpStatus === 404 || rpcStatus === "NOT_FOUND") {
    return {
      status: 404,
      code: "MODEL_UNAVAILABLE",
      message: "The selected Gemini model is currently unavailable for this API key.",
      retryable: false
    };
  }
  if (httpStatus === 400 || rpcStatus === "INVALID_ARGUMENT") {
    return {
      status: 400,
      code: "INVALID_REQUEST",
      message: "The message or image could not be processed. Please edit your prompt and try again.",
      retryable: false
    };
  }
  return {
    status: 502,
    code: "UPSTREAM_ERROR",
    message: "Unable to reach the AI service right now. Please try again in a moment.",
    retryable: true,
    retryAfterSeconds: retryAfterSeconds ?? 3
  };
}
async function nextChunkWithTimeout(iterator, timeoutMs, signal) {
  if (signal.aborted) {
    throw new Error("ABORTED");
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      void iterator.return?.().catch(() => {
      });
      reject(new Error("UPSTREAM_TIMEOUT"));
    }, timeoutMs);
    const onAbort = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void iterator.return?.().catch(() => {
      });
      reject(new Error("ABORTED"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    iterator.next().then((res) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve(res);
    }).catch((err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(err);
    });
  });
}
async function streamWithOptionalTools(ai, model, contents, systemInstruction, signal, includeToolsConfig, maxOutputTokens = 768) {
  const thinkingLevel = model === "gemini-3.1-flash-lite" ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW;
  const timeoutController = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    timeoutController.abort();
  }, UPSTREAM_CONNECT_TIMEOUT_MS);
  const onParentAbort = () => timeoutController.abort();
  signal.addEventListener("abort", onParentAbort, { once: true });
  let stream;
  try {
    stream = await ai.models.generateContentStream({
      model,
      contents,
      config: {
        abortSignal: timeoutController.signal,
        thinkingConfig: { thinkingLevel },
        temperature: 0.6,
        maxOutputTokens,
        systemInstruction,
        ...includeToolsConfig ? { tools: [{ functionDeclarations: LIVE_TOOL_DECLARATIONS }] } : {}
      }
    });
  } catch (err) {
    if (timedOut) {
      throw new Error("UPSTREAM_TIMEOUT");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    signal.removeEventListener("abort", onParentAbort);
  }
  const iterator = stream[Symbol.asyncIterator]();
  while (true) {
    const next = await nextChunkWithTimeout(iterator, STREAM_IDLE_TIMEOUT_MS, signal);
    if (next.done) {
      throw new Error("EMPTY_UPSTREAM_RESPONSE");
    }
    const text = next.value.text;
    if (text && text.length > 0) {
      return { iterator, firstText: text, model };
    }
  }
}
async function openStreamWithFirstChunk(ai, model, contents, systemInstruction, signal, enableTools, clientTimeZone, maxOutputTokens = 768) {
  if (!enableTools) {
    return await streamWithOptionalTools(
      ai,
      model,
      contents,
      systemInstruction,
      signal,
      false,
      maxOutputTokens
    );
  }
  const thinkingLevel = model === "gemini-3.1-flash-lite" ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW;
  const workingContents = [...contents];
  const timeoutController = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    timeoutController.abort();
  }, UPSTREAM_CONNECT_TIMEOUT_MS);
  const onParentAbort = () => timeoutController.abort();
  signal.addEventListener("abort", onParentAbort, { once: true });
  let response;
  try {
    response = await ai.models.generateContent({
      model,
      contents: workingContents,
      config: {
        abortSignal: timeoutController.signal,
        thinkingConfig: { thinkingLevel },
        systemInstruction,
        tools: [{ functionDeclarations: LIVE_TOOL_DECLARATIONS }]
      }
    });
  } catch (err) {
    if (timedOut) {
      throw new Error("UPSTREAM_TIMEOUT");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    signal.removeEventListener("abort", onParentAbort);
  }
  const calls = response.functionCalls;
  const previousContent = response.candidates?.[0]?.content;
  if (calls && calls.length > 0 && previousContent) {
    const toolResults = await Promise.all(
      calls.map((fc) => executeLiveToolCall(fc, clientTimeZone))
    );
    const responseParts = calls.map((fc, idx) => ({
      functionResponse: {
        ...fc.id ? { id: fc.id } : {},
        name: fc.name ?? "unknown_tool",
        response: { result: toolResults[idx] }
      }
    }));
    workingContents.push(previousContent);
    workingContents.push({ role: "user", parts: responseParts });
    return await streamWithOptionalTools(
      ai,
      model,
      workingContents,
      systemInstruction,
      signal,
      true
    );
  }
  const directText = response.text;
  if (directText && directText.trim().length > 0) {
    async function* singleChunk() {
    }
    return {
      iterator: singleChunk()[Symbol.asyncIterator](),
      firstText: directText,
      model
    };
  }
  return await streamWithOptionalTools(
    ai,
    model,
    workingContents,
    systemInstruction,
    signal,
    false
  );
}
async function buildGroundedFallbackInstruction(contents, baseInstruction, clientTimeZone) {
  const userTexts = contents.filter((c) => c.role === "user").map((c) => c.parts?.map((p) => p.text ?? "").join(" ") ?? "").join(" ");
  const cityMatches = Array.from(
    userTexts.matchAll(
      /\b(karachi|lahore|islamabad|rawalpindi|faisalabad|multan|peshawar|quetta|dubai|abu dhabi|riyadh|jeddah|london|new york|los angeles|toronto|tokyo|istanbul|paris|berlin|delhi|mumbai|dhaka|singapore|sydney)\b/gi
    )
  ).map((m) => m[1]);
  const uniqueCities = Array.from(new Set(cityMatches)).slice(0, 3);
  if (uniqueCities.length === 0) {
    return baseInstruction;
  }
  const weatherFacts = await Promise.all(
    uniqueCities.map(async (city) => {
      const res = await fetchLiveWeatherData({ locationQuery: city, clientTimeZone });
      return res.ok ? `${res.data.location} (${res.data.date} ${res.data.localTime}): ${res.data.condition}, ${res.data.temperatureC}\xB0C (feels like ${res.data.feelsLikeC ?? res.data.temperatureC}\xB0C), high/low ${res.data.highC ?? "-"}\xB0C/${res.data.lowC ?? "-"}\xB0C, humidity ${res.data.humidityPercent ?? "-"}%, wind ${res.data.windSpeedKmh ?? "-"} km/h.` : `${city}: live weather unavailable (${res.error}).`;
    })
  );
  return `${baseInstruction} LIVE VERIFIED WEATHER DATA: ${weatherFacts.join(" | ")}`;
}
async function createStreamWithSmartRetry(ai, contents, systemInstruction, signal, enableTools, clientTimeZone, maxOutputTokens = 768) {
  let activeModel = PRIMARY_MODEL;
  let useTools = enableTools;
  let activeInstruction = systemInstruction;
  let lastError;
  for (let attempt = 0; attempt <= MAX_SERVER_RETRIES; attempt++) {
    if (signal.aborted) {
      throw new Error("ABORTED");
    }
    try {
      return await openStreamWithFirstChunk(
        ai,
        activeModel,
        contents,
        activeInstruction,
        signal,
        useTools,
        clientTimeZone,
        maxOutputTokens
      );
    } catch (err) {
      lastError = err;
      if (signal.aborted || err instanceof Error && err.message === "ABORTED") {
        throw err;
      }
      if (err instanceof Error && (err.message === "UPSTREAM_TIMEOUT" || err.message === "EMPTY_UPSTREAM_RESPONSE")) {
        if (attempt < MAX_SERVER_RETRIES) {
          if (useTools) {
            useTools = false;
            activeInstruction = await buildGroundedFallbackInstruction(
              contents,
              systemInstruction,
              clientTimeZone
            );
          }
          continue;
        }
        throw err;
      }
      const parsed = parseGeminiError(err);
      if ((parsed.code === "MODEL_UNAVAILABLE" || parsed.code === "DAILY_QUOTA_EXCEEDED") && activeModel === PRIMARY_MODEL) {
        activeModel = FALLBACK_FREE_MODEL;
        return await openStreamWithFirstChunk(
          ai,
          activeModel,
          contents,
          activeInstruction,
          signal,
          useTools,
          clientTimeZone
        );
      }
      if (!parsed.retryable || attempt === MAX_SERVER_RETRIES) {
        throw lastError;
      }
      if (useTools && parsed.code === "UPSTREAM_ERROR") {
        useTools = false;
        activeInstruction = await buildGroundedFallbackInstruction(
          contents,
          systemInstruction,
          clientTimeZone
        );
        await sleep(250, signal);
        continue;
      }
      const requestedDelayMs = parsed.retryAfterSeconds ? parsed.retryAfterSeconds * 1e3 : 450 * Math.pow(2, attempt);
      if (parsed.code === "RATE_LIMITED_TEMPORARY" && requestedDelayMs > MAX_AUTO_RETRY_DELAY_MS) {
        throw lastError;
      }
      const jitterMs = Math.floor(Math.random() * 150);
      await sleep(Math.min(MAX_AUTO_RETRY_DELAY_MS, requestedDelayMs) + jitterMs, signal);
    }
  }
  throw lastError;
}
async function handleChatRequest(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, 405, {
      error: "Method not allowed.",
      code: "METHOD_NOT_ALLOWED",
      retryable: false
    });
    return;
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    const code = err instanceof Error ? err.message : "INVALID_JSON";
    if (code === "PAYLOAD_TOO_LARGE") {
      sendJson(res, 413, {
        error: "Message payload is too large. Please use a smaller image.",
        code: "PAYLOAD_TOO_LARGE",
        retryable: false
      });
      return;
    }
    sendJson(res, 400, {
      error: "Invalid request body.",
      code: "INVALID_JSON",
      retryable: false
    });
    return;
  }
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    sendJson(res, 400, {
      error: "Please enter a message or upload an image before sending.",
      code: "EMPTY_MESSAGES",
      retryable: false
    });
    return;
  }
  const language = body.language === "urdu" || body.language === "english" ? body.language : "auto";
  const clientTimeZone = typeof body.timeZone === "string" && isValidTimeZone(body.timeZone) ? body.timeZone : void 0;
  const sanitized = body.messages.filter((m) => {
    if (typeof m !== "object" || m === null) return false;
    const candidate = m;
    if (candidate.role !== "user" && candidate.role !== "model") return false;
    const hasText = typeof candidate.text === "string" && candidate.text.trim().length > 0;
    const hasValidImage = candidate.role === "user" && parseImagePart(candidate.image) !== null;
    return hasText || hasValidImage;
  }).slice(-4);
  if (sanitized.length === 0 || sanitized[sanitized.length - 1].role !== "user") {
    sendJson(res, 400, {
      error: "The latest message must include text or a valid image.",
      code: "INVALID_PROMPT",
      retryable: false
    });
    return;
  }
  const writeSingleSseReply = (replyText, serverTiming) => {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Server-Timing", serverTiming);
    res.flushHeaders?.();
    res.write(`data: ${JSON.stringify({ text: replyText })}

`);
    res.write(`data: ${JSON.stringify({ done: true })}

`);
    res.end();
  };
  const latestMessage = sanitized[sanitized.length - 1];
  const latestHasImage = parseImagePart(latestMessage.image) !== null;
  if (!latestHasImage) {
    const preferUrdu = language === "urdu" || isUrduScript(latestMessage.text) || looksLikeRomanUrdu(latestMessage.text);
    const instant = matchInstantReply(latestMessage.text, language, clientTimeZone);
    if (instant) {
      writeSingleSseReply(instant.reply, 'local;desc="instant";dur=0');
      return;
    }
    const dynamicDateQuery = parseDateTimeQuery(latestMessage.text);
    if (dynamicDateQuery) {
      const dateStart = Date.now();
      const dynamicDateReply = await resolveDynamicDateTimeReply({
        kind: dynamicDateQuery.kind,
        locationQuery: dynamicDateQuery.locationQuery,
        clientTimeZone,
        preferUrdu
      });
      if (dynamicDateReply) {
        writeSingleSseReply(
          dynamicDateReply,
          `local;desc="datetime";dur=${Date.now() - dateStart}`
        );
        return;
      }
    }
    const weatherQuery = parseWeatherQuery(latestMessage.text);
    if (weatherQuery) {
      const wxStart = Date.now();
      const weatherReply = await fetchLiveWeatherReply({
        locationQuery: weatherQuery.locationQuery,
        clientTimeZone,
        preferUrdu
      });
      writeSingleSseReply(
        weatherReply,
        `weather;desc="open-meteo";dur=${Date.now() - wxStart}`
      );
      return;
    }
  }
  let remainingImages = 1;
  const includeImageFlags = new Array(sanitized.length).fill(false);
  for (let i = sanitized.length - 1; i >= 0 && remainingImages > 0; i--) {
    if (sanitized[i].role === "user" && parseImagePart(sanitized[i].image) !== null) {
      includeImageFlags[i] = true;
      remainingImages--;
    }
  }
  const rawContents = sanitized.map((m, idx) => {
    const parts = [];
    const imagePart = includeImageFlags[idx] ? parseImagePart(m.image) : null;
    if (imagePart) {
      parts.push(imagePart);
    }
    const trimmedText = typeof m.text === "string" ? m.text.trim() : "";
    if (trimmedText.length > 0) {
      parts.push({ text: trimmedText });
    } else if (imagePart) {
      parts.push({ text: "Please analyze and describe this image." });
    } else {
      parts.push({ text: "[Image attached]" });
    }
    return {
      role: m.role,
      parts
    };
  });
  const contents = [];
  for (const item of rawContents) {
    const prev = contents[contents.length - 1];
    if (prev && prev.role === item.role) {
      prev.parts = [...prev.parts ?? [], ...item.parts ?? []];
    } else {
      contents.push(item);
    }
  }
  let ai;
  try {
    ai = getGeminiClient();
  } catch (err) {
    const parsed = parseGeminiError(err);
    sendJson(res, parsed.status, {
      error: parsed.message,
      code: parsed.code,
      retryable: parsed.retryable
    });
    return;
  }
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) {
      controller.abort();
    }
  });
  const weatherIntent = hasWeatherIntent(sanitized);
  const preGrounded = weatherIntent ? await preGroundLiveWeatherContext(
    sanitized.map((m) => m.text).join(" "),
    clientTimeZone
  ) : { groundedFacts: "", cityCount: 0 };
  const systemInstruction = buildSystemInstruction(
    language,
    latestMessage.text,
    latestHasImage,
    clientTimeZone,
    preGrounded.groundedFacts || void 0
  );
  const startMs = Date.now();
  const enableTools = weatherIntent && preGrounded.cityCount === 0;
  const trimmedPrompt = latestMessage.text.trim();
  const isDetailedRequest = trimmedPrompt.length >= 120 || latestHasImage || /\b(code|function|typescript|javascript|python|react|essay|article|detailed|step\s+by\s+step|explain\s+in\s+detail|tutorial)\b/i.test(
    trimmedPrompt
  );
  const maxOutputTokens = isDetailedRequest ? 1152 : 512;
  try {
    const { iterator, firstText, model } = await createStreamWithSmartRetry(
      ai,
      contents,
      systemInstruction,
      controller.signal,
      enableTools,
      clientTimeZone,
      maxOutputTokens
    );
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Server-Timing", `gemini;desc="${model}";dur=${Date.now() - startMs}`);
    res.flushHeaders?.();
    res.write(`data: ${JSON.stringify({ text: firstText })}

`);
    while (true) {
      if (controller.signal.aborted) {
        break;
      }
      const next = await nextChunkWithTimeout(
        iterator,
        STREAM_IDLE_TIMEOUT_MS,
        controller.signal
      );
      if (next.done) {
        break;
      }
      const chunkText = next.value.text;
      if (chunkText) {
        res.write(`data: ${JSON.stringify({ text: chunkText })}

`);
      }
    }
    if (!controller.signal.aborted) {
      res.write(`data: ${JSON.stringify({ done: true })}

`);
    }
    res.end();
  } catch (err) {
    if (controller.signal.aborted || err instanceof Error && err.message === "ABORTED") {
      if (!res.writableEnded) res.end();
      return;
    }
    if (err instanceof Error && err.message === "UPSTREAM_TIMEOUT") {
      console.error("[api/chat error] REQUEST_TIMEOUT");
      if (!res.headersSent) {
        sendJson(res, 504, {
          error: "The AI service took too long to respond. Please try again.",
          code: "REQUEST_TIMEOUT",
          retryable: true
        });
      } else {
        res.write(
          `data: ${JSON.stringify({
            error: "The AI service took too long to respond. Please try again.",
            code: "REQUEST_TIMEOUT",
            retryable: true
          })}

`
        );
        res.end();
      }
      return;
    }
    const parsed = parseGeminiError(err);
    console.error("[api/chat error]", parsed.code);
    if (parsed.status === 429 && parsed.retryAfterSeconds) {
      res.setHeader("Retry-After", String(parsed.retryAfterSeconds));
    }
    if (!res.headersSent) {
      sendJson(res, parsed.status, {
        error: parsed.message,
        code: parsed.code,
        retryable: parsed.retryable,
        retryAfterSeconds: parsed.retryAfterSeconds
      });
    } else {
      res.write(
        `data: ${JSON.stringify({
          error: parsed.message,
          code: parsed.code,
          retryable: parsed.retryable,
          retryAfterSeconds: parsed.retryAfterSeconds
        })}

`
      );
      res.end();
    }
  }
}

// server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var PORT = Number(process.env.APP_PORT) || 3e3;
async function startServer() {
  const app = express();
  app.use(express.json({ limit: "6mb" }));
  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      configured: Boolean(
        process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== "" && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY"
      )
    });
  });
  app.post("/api/chat", async (req, res) => {
    await handleChatRequest(req, res);
  });
  app.use("/api", (_req, res) => {
    res.status(404).json({
      error: "API endpoint not found.",
      code: "ENDPOINT_NOT_FOUND",
      retryable: false
    });
  });
  const distDir = path.resolve(__dirname, "dist");
  const isCompiledProdBundle = path.basename(__filename) === "server.js" && fs.existsSync(path.join(distDir, "index.html"));
  if (process.env.NODE_ENV !== "production" && !isCompiledProdBundle) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SwiftChat server listening on http://0.0.0.0:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
