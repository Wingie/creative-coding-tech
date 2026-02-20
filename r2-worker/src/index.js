/**
 * Cloudflare Worker for serving media from R2 bucket
 * Handles: images, videos, audio files with proper CORS, caching, and content types
 *
 * Bucket: media
 * Domain: media.creativecodingtech.com
 */

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const key = decodeURIComponent(url.pathname.slice(1)); // Remove leading /
    const corsHeaders = getCorsHeaders(request, env);

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
        "Cache-Control": getCacheControl(mimeType),
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
