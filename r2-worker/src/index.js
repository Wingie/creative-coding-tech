/**
 * Cloudflare Worker for serving media from R2 bucket
 * Handles: images, videos, audio files with proper CORS, caching, and content types
 *
 * Bucket: media
 * Domain: media.creativecodingtech.com
 */

import adminPage from "../admin/index.html";
import { curate } from "./curate.js";

const MIME_TYPES = {
  // Images
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  // Video
  mp4: "video/mp4",
  webm: "video/webm",
  ogg: "video/ogg",
  ogv: "video/ogg",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  "3gp": "video/3gpp",
  "3g2": "video/3gpp2",
  // Audio
  mp3: "audio/mpeg",
  wav: "audio/wav",
  flac: "audio/flac",
  aac: "audio/aac",
  weba: "audio/webm",
  oga: "audio/ogg",
  mid: "audio/midi",
  midi: "audio/midi",
  // Documents
  pdf: "application/pdf",
  json: "application/json",
};

// Cache durations (in seconds)
const CACHE_CONTROL = {
  image: "public, max-age=31536000, immutable", // 1 year for images
  video: "public, max-age=2592000",             // 30 days for video
  audio: "public, max-age=2592000",             // 30 days for audio
  default: "public, max-age=86400",             // 1 day for other files
};

function getMimeType(path) {
  const ext = path.split(".").pop().toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

function getCacheControl(mimeType) {
  if (mimeType.startsWith("image/")) return CACHE_CONTROL.image;
  if (mimeType.startsWith("video/")) return CACHE_CONTROL.video;
  if (mimeType.startsWith("audio/")) return CACHE_CONTROL.audio;
  return CACHE_CONTROL.default;
}

function getCorsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigins = (env.ALLOWED_ORIGINS || "https://creativecodingtech.com")
    .split(",")
    .map((o) => o.trim());

  const isAllowed = allowedOrigins.includes(origin) || origin === "";

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin || "*" : allowedOrigins[0],
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Range",
    "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
    "Access-Control-Max-Age": "86400",
  };
}

// ---- Gallery curation page (/admin), behind Basic auth ----------------------
// Password comes from the ADMIN_PASSWORD secret (`wrangler secret put ADMIN_PASSWORD`).
// Without it the page is closed, never open.

const CURATION_KEY = "gallery/curation.json";
const ALL_KEY = "gallery/gallery_all.json";
const PUBLIC_KEY = "gallery/gallery.json";

function authorised(request, env) {
  const expected = env.ADMIN_PASSWORD;
  if (!expected) return false;
  const header = request.headers.get("Authorization") || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) return false;
  let decoded = "";
  try {
    decoded = atob(encoded);
  } catch {
    return false;
  }
  const given = decoded.slice(decoded.indexOf(":") + 1);
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

async function readJson(env, key, fallback) {
  const obj = await env.MEDIA_BUCKET.get(key);
  return obj ? obj.json() : fallback;
}

async function handleAdmin(request, env, url) {
  const noStore = { "Cache-Control": "no-store" };
  if (!authorised(request, env)) {
    return new Response("Sign in to curate the gallery.", {
      status: 401,
      headers: { ...noStore, "WWW-Authenticate": 'Basic realm="gallery curation"' },
    });
  }
  if (url.pathname === "/admin" || url.pathname === "/admin/") {
    return new Response(adminPage, { headers: { ...noStore, "Content-Type": "text/html; charset=utf-8" } });
  }
  if (url.pathname === "/admin/api/config") {
    return Response.json({ media: "/gallery/" }, { headers: noStore });
  }
  if (url.pathname === "/admin/api/all") {
    return Response.json(await readJson(env, ALL_KEY, { people: [] }), { headers: noStore });
  }
  if (url.pathname === "/admin/api/curation") {
    if (request.method === "GET") {
      return Response.json(await readJson(env, CURATION_KEY, {}), { headers: noStore });
    }
    if (request.method === "PUT") {
      const curation = await request.json();
      await env.MEDIA_BUCKET.put(CURATION_KEY, JSON.stringify(curation), {
        httpMetadata: { contentType: "application/json" },
      });
      // Publish straight away: rebuild the public gallery.json from every synced photo.
      const all = await readJson(env, ALL_KEY, { people: [] });
      const people = curate(all.people, curation);
      await env.MEDIA_BUCKET.put(PUBLIC_KEY, JSON.stringify({ generated: new Date().toISOString(), people }), {
        httpMetadata: { contentType: "application/json" },
      });
      return Response.json({ ok: true, rooms: people.length }, { headers: noStore });
    }
    return new Response("Method Not Allowed", { status: 405, headers: noStore });
  }
  return new Response("Not Found", { status: 404, headers: noStore });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
      return handleAdmin(request, env, url);
    }
    const key = decodeURIComponent(url.pathname.slice(1)); // Remove leading /
    const corsHeaders = getCorsHeaders(request, env);

    // The curation file and the unfiltered photo list are for the admin page only.
    if (key === CURATION_KEY || key === ALL_KEY) {
      return new Response("Not Found", { status: 404, headers: corsHeaders });
    }

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Only allow GET and HEAD
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    // Block directory listing (empty key or trailing slash)
    if (!key || key.endsWith("/")) {
      return new Response("Not Found", { status: 404, headers: corsHeaders });
    }

    try {
      // Support range requests (video/audio streaming) and conditional requests (304)
      const object = await env.MEDIA_BUCKET.get(key, {
        range: request.headers,
        onlyIf: request.headers,
      });
      const range = request.headers.get("Range");

      if (!object) {
        return new Response("Not Found", { status: 404, headers: corsHeaders });
      }

      const mimeType = object.httpMetadata?.contentType || getMimeType(key);
      const headers = new Headers({
        ...corsHeaders,
        "Content-Type": mimeType,
        // gallery.json changes whenever a room is published, so it must not sit in caches for a day
        "Cache-Control": key === PUBLIC_KEY ? "public, max-age=60" : getCacheControl(mimeType),
        ETag: object.httpEtag,
        "Accept-Ranges": "bytes",
      });

      if (object.httpMetadata?.contentDisposition) {
        headers.set("Content-Disposition", object.httpMetadata.contentDisposition);
      }

      // Handle conditional requests (304 Not Modified)
      if (object.body === null) {
        return new Response(null, { status: 304, headers });
      }

      // Handle range requests (206 Partial Content)
      if (range && object.range) {
        const { offset, length, end } = object.range;
        headers.set("Content-Range", `bytes ${offset}-${end}/${object.size}`);
        headers.set("Content-Length", length);
        return new Response(object.body, { status: 206, headers });
      }

      headers.set("Content-Length", object.size);
      return new Response(object.body, { headers });
    } catch (err) {
      return new Response("Internal Server Error", { status: 500, headers: corsHeaders });
    }
  },
};
