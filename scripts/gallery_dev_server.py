#!/usr/bin/env python3
"""Local stand-in for the worker's /admin routes, so curation can be tried offline.

    python3 scripts/gallery_dev_server.py        # http://127.0.0.1:4010/admin/

Serves r2-worker/admin/index.html and the same API the worker exposes, backed by
gallery-media/ on disk instead of R2. Publishing rewrites gallery-media/gallery.json,
which the Jekyll site at :4000 picks up on its next rebuild.
No auth: it only listens on 127.0.0.1.
"""

import http.server
import json
import mimetypes
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sync_gallery  # noqa: E402

ROOT = sync_gallery.ROOT
MEDIA = os.path.join(ROOT, "gallery-media")
ADMIN = os.path.join(ROOT, "r2-worker", "admin", "index.html")
PORT = int(os.environ.get("PORT", "4010"))


class Handler(http.server.BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _json_file(self, name, default):
        path = os.path.join(MEDIA, name)
        if not os.path.exists(path):
            return json.dumps(default)
        with open(path) as f:
            return f.read()

    def do_GET(self):
        path = self.path.split("?")[0]
        if path in ("/admin", "/admin/"):
            with open(ADMIN, "rb") as f:
                return self._send(200, f.read(), "text/html; charset=utf-8")
        if path == "/admin/api/config":
            return self._send(200, json.dumps({"media": "/gallery-media/"}))
        if path == "/admin/api/all":
            return self._send(200, self._json_file("gallery_all.json", {"people": []}))
        if path == "/admin/api/curation":
            return self._send(200, self._json_file("curation.json", {}))
        prefix = "/gallery-media/"
        if path[: len(prefix)] == prefix:
            rel = os.path.normpath(path[len(prefix):])
            full = os.path.join(MEDIA, rel)
            if os.path.commonpath([full, MEDIA]) != MEDIA or not os.path.isfile(full):
                return self._send(404, "not found", "text/plain")
            with open(full, "rb") as f:
                return self._send(200, f.read(), mimetypes.guess_type(full)[0] or "application/octet-stream")
        return self._send(404, "not found", "text/plain")

    def do_PUT(self):
        if self.path.split("?")[0] != "/admin/api/curation":
            return self._send(404, "not found", "text/plain")
        length = int(self.headers.get("Content-Length", "0"))
        curation = json.loads(self.rfile.read(length) or b"{}")
        with open(os.path.join(MEDIA, "curation.json"), "w") as f:
            json.dump(curation, f, indent=1)
        rooms = json.loads(self._json_file("gallery_all.json", {"people": []}))["people"]
        public = sync_gallery.curate(rooms, curation, 24)
        with open(os.path.join(MEDIA, "gallery.json"), "w") as f:
            json.dump({"generated": sync_gallery.datetime.datetime.now(sync_gallery.datetime.timezone.utc).isoformat(timespec="seconds"), "people": public}, f)
        return self._send(200, json.dumps({"ok": True, "rooms": len(public)}))


if __name__ == "__main__":
    print("curation page: http://127.0.0.1:%d/admin/" % PORT, flush=True)
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
