/* ============================================================
   ZYCORD — downloads
   Resolves the newest release from the forge at page load, so a new
   tag needs no edit here.

   PROGRESSIVE ENHANCEMENT, AND THIS IS NOT OPTIONAL. Every link on the
   page is already correct in the HTML: each one points at the releases
   page, which always resolves. This script only ever *upgrades* a link
   to the exact archive and adds the version and the size. If the forge
   is unreachable, rate-limited, or the visitor has scripts off, the
   page keeps working and nothing is missing but the convenience.

   That order matters more than usual here: the page hands out binaries
   that hold money. A page that renders empty when an API call fails is
   a page that teaches people to go looking for the file somewhere else.
   ============================================================ */
(function () {
  "use strict";

  var root = document.getElementById("downloads");
  if (!root) return;

  // The forge URL is stamped in at deploy time; owner and repository are
  // read back out of it so this file holds no second copy of it.
  var m = /^https?:\/\/github\.com\/([^/]+)\/([^/?#]+)/.exec(root.dataset.repo || "");
  if (!m) return;

  var API = "https://api.github.com/repos/" + m[1] + "/" + m[2] + "/releases/latest";
  var CACHE_KEY = "zycord:latest-release";
  var CACHE_TTL = 60 * 60 * 1000; // an hour

  /* ---------- cache ----------
     Unauthenticated calls to the forge API are limited to 60 an hour per
     address. One reload per visitor per hour keeps a shared address --
     an office, a campus, a carrier NAT -- from spending that budget on
     the same answer, and keeps the page fast on a second visit. */

  function cached() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var box = JSON.parse(raw);
      if (!box || Date.now() - box.at > CACHE_TTL) return null;
      return box.data;
    } catch (e) {
      return null; // private mode, blocked storage, corrupt entry
    }
  }

  function remember(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: data }));
    } catch (e) {
      /* storage full or unavailable: the page does not depend on it */
    }
  }

  /* ---------- rendering ---------- */

  function human(bytes) {
    if (typeof bytes !== "number") return "";
    // The checksum files and the key are a few hundred bytes, so a
    // megabytes-only formatter renders them "0.0 MB" beside an archive
    // measured in real ones.
    if (bytes < 1024) return bytes + " B";
    var kb = bytes / 1024;
    if (kb < 1024) return (kb >= 10 ? Math.round(kb) : kb.toFixed(1)) + " KB";
    var mb = kb / 1024;
    return (mb >= 10 ? Math.round(mb) : mb.toFixed(1)) + " MB";
  }

  function apply(release) {
    var assets = {};
    (release.assets || []).forEach(function (a) { assets[a.name] = a; });

    var version = String(release.tag_name || "").replace(/^v/, "");
    if (!version) return;

    // Every row names the asset it wants, with {v} standing in for the
    // version. A row whose asset is absent from this release keeps its
    // fallback link rather than being hidden: "this platform is missing
    // from this build" is something a reader should be able to see.
    var resolved = 0;
    root.querySelectorAll("[data-asset]").forEach(function (el) {
      var name = el.dataset.asset.replace("{v}", version);
      var asset = assets[name];
      var row = el.closest("[data-row]") || el;
      // Scope the size and the file name to THIS cell, never to the row.
      // A row holds two archives -- the one that joins a network and the
      // reproducible one -- so a row-wide lookup finds the first cell's
      // spans from both columns and the second column overwrites the
      // first. The symptom is a download button labelled with the other
      // archive's size and file name, which on this page is exactly the
      // confusion the two columns exist to prevent.
      var cell = el.closest("td") || el.parentNode;
      if (!asset) {
        row.classList.add("dl-missing");
        return;
      }
      el.href = asset.browser_download_url;
      el.setAttribute("download", "");
      row.classList.remove("dl-missing");
      resolved++;
      var size = cell.querySelector("[data-size]");
      if (size) size.textContent = human(asset.size);
      var fname = cell.querySelector("[data-filename]");
      if (fname) fname.textContent = name;
    });

    if (!resolved) return; // nothing matched: leave the static page alone

    // Sections that document an asset which is not in every release -- the
    // installer script, the Debian package -- carry a notice that this
    // release does not have it. Driven from the release itself so the page
    // stops apologising on its own the day the asset ships, which is the
    // whole reason the version is resolved here at all.
    root.querySelectorAll("[data-needs-asset]").forEach(function (el) {
      var wanted = el.dataset.needsAsset.replace("{v}", version);
      el.hidden = Object.prototype.hasOwnProperty.call(assets, wanted);
    });

    root.querySelectorAll("[data-version]").forEach(function (el) {
      el.textContent = release.tag_name;
    });
    // Debian package names carry the version without the leading v
    // (zycord_0.1.2_amd64.deb), so the command block needs both spellings.
    root.querySelectorAll("[data-version-bare]").forEach(function (el) {
      el.textContent = version;
    });

    var stat = root.querySelector("[data-headline-static]");
    var live = root.querySelector("[data-headline-live]");
    if (stat && live) { stat.hidden = true; live.hidden = false; }

    var when = root.querySelector("[data-published]");
    if (when && release.published_at) {
      var d = new Date(release.published_at);
      // UTC, and a date rather than an instant: what matters is which
      // build this is, not what hour it was cut.
      when.textContent = d.toISOString().slice(0, 10);
      when.setAttribute("datetime", release.published_at);
    }

    var notes = root.querySelector("[data-release-notes]");
    if (notes && release.html_url) notes.href = release.html_url;

    root.classList.add("is-resolved");
  }

  /* ---------- platform hint ----------
     A hint, never a gate: the full table stays on the page and every row
     stays reachable, so a wrong guess costs a reader nothing but a glance.
     It shows up only as a tint and a "your system" badge on one row --
     detection from a user-agent string is guesswork, and it does not
     deserve an announcement of its own. */

  function guessPlatform() {
    var ua = navigator.userAgent || "";
    var p = (navigator.userAgentData && navigator.userAgentData.platform) ||
            navigator.platform || "";
    var s = (p + " " + ua).toLowerCase();

    var os = null;
    if (/win/.test(s)) os = "windows";
    else if (/mac|darwin/.test(s)) os = "darwin";
    else if (/linux|x11|cros/.test(s)) os = "linux";
    if (/android|iphone|ipad|ipod/.test(s)) os = null; // no mobile build

    var arch = /arm|aarch64/.test(s) ? "arm64" : "amd64";

    // Apple Silicon does not say so in the user-agent string. WebGL's
    // unmasked renderer is the usual tell, and when it is unavailable the
    // guess simply stays amd64 and the table is still right there.
    if (os === "darwin" && arch === "amd64") {
      try {
        var c = document.createElement("canvas");
        var gl = c.getContext("webgl") || c.getContext("experimental-webgl");
        var ext = gl && gl.getExtension("WEBGL_debug_renderer_info");
        var r = ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
        if (r && /apple\s*m\d/i.test(r)) arch = "arm64";
      } catch (e) { /* blocked or unsupported: keep the guess */ }
    }
    return os ? { os: os, arch: arch } : null;
  }

  function highlight() {
    var g = guessPlatform();
    if (!g) return;
    var row = root.querySelector('[data-row][data-os="' + g.os + '"][data-arch="' + g.arch + '"]');
    if (!row) return;
    row.classList.add("is-yours");
    var badge = row.querySelector("[data-yours]");
    if (badge) badge.hidden = false;

  }

  /* ---------- go ---------- */

  var hit = cached();
  if (hit) {
    apply(hit);
    highlight();
    return;
  }

  // no-referrer: the request already tells the forge that someone is
  // looking at a Zycord download page, and there is no reason to also hand
  // it the exact page. no-store keeps the answer out of the HTTP cache,
  // where the localStorage box above is the copy we actually manage.
  fetch(API, {
    headers: { Accept: "application/vnd.github+json" },
    referrerPolicy: "no-referrer",
    credentials: "omit",
    cache: "no-store"
  })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      remember(data);
      apply(data);
      highlight();
    })
    .catch(function () {
      // Rate-limited, offline, or blocked. The static links stand.
      var n = root.querySelector("[data-offline-note]");
      if (n) n.hidden = false;
    });
})();
