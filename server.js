// server.ts
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// api/_gemini.ts
import dotenv from "dotenv";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

// src/lib/quickReplies.ts
function normalizePhrase(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}
function isUrduScript(text) {
  return /[\u0600-\u06FF]/.test(text);
}
function looksLikeRomanUrdu(text) {
  const norm = ` ${normalizePhrase(text)} `;
  return /\s(kya|kaise|kese|haal|hai|hain|hoon|hun|mujhe|mjhe|batao|btao|samjhao|likho|karo|kro|krna|karna|nahi|nhi|haan|han|aap|ap|mein|main|me|se|ko|ka|ki|ke|aur|shukriya|madad|chahiye|chahie|urdu)\s/.test(
    norm
  );
}
function matchInstantReply(text, currentLanguage = "auto") {
  const rawTrimmed = text.trim();
  if (!rawTrimmed || rawTrimmed.length > 60) return null;
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

// api/_gemini.ts
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
var PRIMARY_MODEL = "gemini-3.1-flash-lite";
var FALLBACK_FREE_MODEL = "gemini-4-hydrogen";
var MAX_SERVER_RETRIES = 1;
var MAX_AUTO_RETRY_DELAY_MS = 1e3;
var UPSTREAM_CONNECT_TIMEOUT_MS = 14e3;
var STREAM_IDLE_TIMEOUT_MS = 15e3;
var MAX_BODY_BYTES = 6 * 1024 * 1024;
function buildSystemInstruction(language, latestText, hasImage) {
  const imageHint = hasImage ? " Inspect the image carefully to answer or extract text." : "";
  if (isUrduScript(latestText)) {
    return `Be concise and helpful. Reply naturally in Urdu script.${imageHint}`;
  }
  if (language === "urdu" || looksLikeRomanUrdu(latestText)) {
    return `Be concise and helpful. Reply naturally in clear Roman Urdu (or Urdu if the user writes in Urdu script).${imageHint}`;
  }
  return `Be concise, direct, and helpful.${imageHint}`;
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
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("GEMINI_API_KEY_MISSING");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
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
async function openStreamWithFirstChunk(ai, model, contents, systemInstruction, signal) {
  const timeoutController = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    timeoutController.abort();
  }, UPSTREAM_CONNECT_TIMEOUT_MS);
  const onParentAbort = () => timeoutController.abort();
  signal.addEventListener("abort", onParentAbort, { once: true });
  const thinkingLevel = model === "gemini-3.1-flash-lite" ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW;
  let stream;
  try {
    stream = await ai.models.generateContentStream({
      model,
      contents,
      config: {
        abortSignal: timeoutController.signal,
        thinkingConfig: { thinkingLevel },
        systemInstruction
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
async function createStreamWithSmartRetry(ai, contents, systemInstruction, signal) {
  let activeModel = PRIMARY_MODEL;
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
        systemInstruction,
        signal
      );
    } catch (err) {
      lastError = err;
      if (signal.aborted || err instanceof Error && err.message === "ABORTED") {
        throw err;
      }
      if (err instanceof Error && (err.message === "UPSTREAM_TIMEOUT" || err.message === "EMPTY_UPSTREAM_RESPONSE")) {
        if (activeModel === PRIMARY_MODEL) {
          activeModel = FALLBACK_FREE_MODEL;
          continue;
        }
        throw err;
      }
      const parsed = parseGeminiError(err);
      if ((parsed.code === "MODEL_UNAVAILABLE" || parsed.code === "DAILY_QUOTA_EXCEEDED" || parsed.code === "UPSTREAM_ERROR" || parsed.code === "RATE_LIMITED_TEMPORARY") && activeModel === PRIMARY_MODEL) {
        activeModel = FALLBACK_FREE_MODEL;
        try {
          return await openStreamWithFirstChunk(
            ai,
            activeModel,
            contents,
            systemInstruction,
            signal
          );
        } catch (fallbackErr) {
          lastError = fallbackErr;
          if (signal.aborted || fallbackErr instanceof Error && fallbackErr.message === "ABORTED") {
            throw fallbackErr;
          }
          const fallbackParsed = parseGeminiError(fallbackErr);
          if (!fallbackParsed.retryable) {
            throw fallbackErr;
          }
        }
      }
      if (!parsed.retryable || attempt === MAX_SERVER_RETRIES) {
        throw lastError;
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
  const sanitized = body.messages.filter((m) => {
    if (typeof m !== "object" || m === null) return false;
    const candidate = m;
    if (candidate.role !== "user" && candidate.role !== "model") return false;
    const hasText = typeof candidate.text === "string" && candidate.text.trim().length > 0;
    const hasValidImage = candidate.role === "user" && parseImagePart(candidate.image) !== null;
    return hasText || hasValidImage;
  }).slice(-6);
  if (sanitized.length === 0 || sanitized[sanitized.length - 1].role !== "user") {
    sendJson(res, 400, {
      error: "The latest message must include text or a valid image.",
      code: "INVALID_PROMPT",
      retryable: false
    });
    return;
  }
  const latestMessage = sanitized[sanitized.length - 1];
  const latestHasImage = parseImagePart(latestMessage.image) !== null;
  if (!latestHasImage) {
    const instant = matchInstantReply(latestMessage.text, language);
    if (instant) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.setHeader("Server-Timing", 'local;desc="instant";dur=0');
      res.flushHeaders?.();
      res.write(`data: ${JSON.stringify({ text: instant.reply })}

`);
      res.write(`data: ${JSON.stringify({ done: true })}

`);
      res.end();
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
  const systemInstruction = buildSystemInstruction(
    language,
    latestMessage.text,
    latestHasImage
  );
  const startMs = Date.now();
  try {
    const { iterator, firstText, model } = await createStreamWithSmartRetry(
      ai,
      contents,
      systemInstruction,
      controller.signal
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
