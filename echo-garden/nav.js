// Shared top menu for the Echo Garden pages. Links are relative to this file, so the
// same menu works at /echo-garden/ on the live site and in the repo folder locally.
(function () {
  "use strict";
  var me = document.currentScript;
  var base = new URL(".", me.src).href;
  var items = [
    ["", "Echo Garden"],
    ["tour/", "Tour"],
    ["replay/", "Replay"],
    ["ideas/", "Ideas"],
    ["talk/", "Talk"]
  ];
  var here = location.href.split("#")[0].split("?")[0].replace(/index\.html$/, "");

  var css = document.createElement("style");
  css.textContent =
    ".eg-nav{position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:4px;flex-wrap:wrap;" +
    "padding:6px 16px;background:rgba(14,10,24,.88);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);" +
    "border-bottom:1px solid rgba(255,43,214,.35);font:600 14px/1.2 system-ui,-apple-system,'Segoe UI',sans-serif}" +
    ".eg-nav a{color:#f4e9ff;text-decoration:none;padding:8px 10px;border-radius:6px;min-height:36px;display:inline-flex;align-items:center}" +
    ".eg-nav a[href=\"/\"]{opacity:.75;margin-right:6px}" +
    ".eg-nav a:hover{background:rgba(255,255,255,.08)}" +
    ".eg-nav a[aria-current=page]{color:#ffb238;box-shadow:inset 0 -2px 0 #ff2bd6}" +
    ".eg-nav .eg-join{margin-left:auto;background:#ff2bd6;color:#12052b}" +
    ".eg-nav .eg-join:hover{background:#ff5ce0}" +
    ".eg-nav a:focus-visible{outline:2px solid #22e6ff;outline-offset:2px}" +
    "@media (max-width:520px){.eg-nav{padding:4px 8px;gap:0}.eg-nav a{padding:8px 7px;font-size:13px}.eg-nav .eg-join{margin-left:0}}";
  document.head.appendChild(css);

  var nav = document.createElement("nav");
  nav.className = "eg-nav";
  nav.setAttribute("aria-label", "Echo Garden");
  // Only when served as part of the site at /echo-garden/, not from the standalone preview.
  if (new URL(base).pathname === "/echo-garden/") {
    var home = document.createElement("a");
    home.href = "/";
    home.textContent = "Creative Coding Tech";
    nav.appendChild(home);
  }
  items.forEach(function (it) {
    var a = document.createElement("a");
    a.href = base + it[0];
    a.textContent = it[1];
    if (a.href === here) a.setAttribute("aria-current", "page");
    nav.appendChild(a);
  });
  var join = document.createElement("a");
  join.className = "eg-join";
  join.href = "https://musichackspace.org/events/hackathon-amsterdam-october-2026/teams/1222";
  join.textContent = "Join";
  nav.appendChild(join);
  document.body.insertBefore(nav, document.body.firstChild);
})();
