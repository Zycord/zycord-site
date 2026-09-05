/* ============================================================
   ZYCORD — documentation behaviour
   Vanilla, no dependencies, and nothing here is load-bearing:
   every page reads correctly with JavaScript switched off.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- mobile contents toggle ---------- */

  var toggle = document.querySelector(".doc-nav-toggle");
  var sidebar = document.getElementById("doc-sidebar");

  if (toggle && sidebar) {
    toggle.addEventListener("click", function () {
      var open = sidebar.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    // A tap on a link is a navigation; leaving the panel open over the
    // destination is the classic mobile-nav bug.
    sidebar.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        sidebar.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- copy buttons ---------- */

  // Only where the API exists: it needs a secure context, and a button that
  // silently does nothing is worse than no button.
  if (navigator.clipboard && window.isSecureContext) {
    document.querySelectorAll(".doc-article pre").forEach(function (pre) {
      var code = pre.querySelector("code");
      if (!code) return;

      var btn = document.createElement("button");
      btn.className = "copy-btn";
      btn.type = "button";
      btn.textContent = "Copy";
      btn.setAttribute("aria-label", "Copy code to clipboard");

      btn.addEventListener("click", function () {
        navigator.clipboard.writeText(code.innerText).then(
          function () {
            btn.textContent = "Copied";
            setTimeout(function () { btn.textContent = "Copy"; }, 1600);
          },
          function () {
            btn.textContent = "Press Ctrl+C";
            setTimeout(function () { btn.textContent = "Copy"; }, 2400);
          }
        );
      });

      pre.appendChild(btn);
    });
  }

  /* ---------- table of contents highlight ---------- */

  var links = Array.prototype.slice.call(document.querySelectorAll(".doc-toc a"));
  if (!links.length || !("IntersectionObserver" in window)) return;

  var byId = {};
  var headings = [];

  links.forEach(function (a) {
    var id = decodeURIComponent(a.getAttribute("href").slice(1));
    var h = document.getElementById(id);
    if (!h) return;
    byId[id] = a;
    headings.push(h);
  });

  var visible = new Set();

  function paint() {
    // The topmost heading currently on screen wins; when none is (mid-section
    // scrolling through a long body) keep the last one that was.
    var best = null;
    headings.forEach(function (h) {
      if (visible.has(h.id) && (best === null || h.offsetTop < best.offsetTop)) best = h;
    });
    if (!best) return;
    links.forEach(function (a) { a.classList.remove("is-active"); });
    if (byId[best.id]) byId[best.id].classList.add("is-active");
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      });
      paint();
    },
    // Bias the band towards the top of the viewport so the highlight tracks
    // what is being read rather than what is merely on screen.
    { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
  );

  headings.forEach(function (h) { observer.observe(h); });
})();
