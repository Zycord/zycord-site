/* ============================================================
   ZYCORD — scroll effects, reveals, counters, nav
   ============================================================ */

(function () {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- scroll handling ----------
     The background is deliberately untouched by scrolling — it keeps its
     own rhythm and brightness throughout (see strings.js). All that
     happens here is the nav's solid state. */

  const nav = document.querySelector(".nav");

  let ticking = false;
  let navScrolled = null;

  function updateNav() {
    // only touch the class when it actually changes — a needless style
    // recalc here lands in the middle of the scroll frame
    const isScrolled = window.scrollY > 24;
    if (isScrolled !== navScrolled) {
      navScrolled = isScrolled;
      nav.classList.toggle("scrolled", isScrolled);
    }
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateNav();
      ticking = false;
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  updateNav();

  /* ---------- reveal on scroll ---------- */

  const revealEls = document.querySelectorAll(".reveal");

  if (reducedMotion) {
    revealEls.forEach((el) => el.classList.add("visible"));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            // stagger siblings slightly for a cascade effect
            const delay = (entry.target.dataset.revealIndex || 0) * 90;
            setTimeout(() => entry.target.classList.add("visible"), delay);
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    // index siblings within each parent so grids cascade
    const byParent = new Map();
    revealEls.forEach((el) => {
      const parent = el.parentElement;
      const idx = byParent.get(parent) || 0;
      el.dataset.revealIndex = idx;
      byParent.set(parent, idx + 1);
      io.observe(el);
    });
  }

  /* ---------- animated counters ---------- */

  function formatValue(el, value) {
    const prefix = el.dataset.prefix || "";
    const suffix = el.dataset.suffix || "";
    let text;
    if (value >= 1000) {
      text = (value / 1000).toFixed(value % 1000 === 0 ? 0 : 1) + "K";
    } else {
      text = String(Math.round(value));
    }
    return prefix + text + suffix;
  }

  function animateCounter(el) {
    const target = parseFloat(el.dataset.count);
    if (!target || reducedMotion) {
      el.textContent = el.dataset.static || formatValue(el, target || 0);
      return;
    }
    const duration = 1600;
    const start = performance.now();

    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = formatValue(el, target * eased);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const counters = document.querySelectorAll(".stat-value");
  const counterIO = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const el = entry.target;
          if (el.dataset.static && !el.dataset.count) {
            el.textContent = el.dataset.static;
          } else if (el.dataset.static) {
            el.textContent = el.dataset.static; // static display overrides
          } else {
            animateCounter(el);
          }
          counterIO.unobserve(el);
        }
      }
    },
    { threshold: 0.5 }
  );
  counters.forEach((el) => counterIO.observe(el));

  /* ---------- mobile nav ---------- */

  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");

  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  links.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      links.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
})();
