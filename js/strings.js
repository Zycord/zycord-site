(function () {
  "use strict";

  const canvas = document.getElementById("strings-bg");
  const ctx = canvas.getContext("2d");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const TAU = Math.PI * 2;
  const SEGS = 120;

  /* All drawing happens in a fixed BASE-unit space; a transform maps it
     onto the backing store, so geometry and line widths are written once
     and stay correct at any canvas size. */
  const BASE = 900;
  const C = BASE / 2;
  const R = BASE * 0.27;

  let D = 0;              // on-screen size in CSS px
  let coreGradient = null;

  /* fixed per-segment angle tables */
  const cosT = new Float32Array(SEGS + 1);
  const sinT = new Float32Array(SEGS + 1);
  const thetaT = new Float32Array(SEGS + 1);
  for (let s = 0; s <= SEGS; s++) {
    const theta = (s / SEGS) * TAU;
    thetaT[s] = theta;
    cosT[s] = Math.cos(theta);
    sinT[s] = Math.sin(theta);
  }

  /* per-frame shared arrays (strand-independent) */
  const baseR = new Float32Array(SEGS + 1);
  const sepR = new Float32Array(SEGS + 1);

  /* backing store slightly below display size — invisible on a glowy,
     feathered ring, but ~28% less fill per frame */
  const RENDER_SCALE = 0.85;

  function applySize() {
    const B = Math.round(D * RENDER_SCALE);
    canvas.width = B;
    canvas.height = B;
    canvas.style.width = D + "px";
    canvas.style.height = D + "px";

    const k = B / BASE;
    ctx.setTransform(k, 0, 0, k, 0, 0);

    coreGradient = ctx.createRadialGradient(C, C, 0, C, C, R * 0.95);
    coreGradient.addColorStop(0, "hsla(250, 80%, 70%, 0.07)");
    coreGradient.addColorStop(0.7, "hsla(200, 85%, 60%, 0.03)");
    coreGradient.addColorStop(1, "hsla(0, 0%, 0%, 0)");
  }

  function resize() {
    D = Math.round(Math.min(Math.min(window.innerWidth, window.innerHeight) * 0.92, 900));
    applySize();
  }
  resize();
  window.addEventListener("resize", resize);

  const STRANDS = [
    { hue: 0 }, { hue: 55 }, { hue: 120 },
    { hue: 185 }, { hue: 240 }, { hue: 300 },
  ].map((s, k) => ({
    ...s,
    m: 2 + (k % 4),                                  // separation mode (waves around circle)
    psi: Math.random() * TAU,                        // phase offset
    drift: (0.25 + Math.random() * 0.5) * (k % 2 ? 1 : -1), // rad/s phase drift
    wob: 0.5 + Math.random() * 0.9,                  // secondary wobble freq
    wobPh: Math.random() * TAU,
  }));

  /* fill the shared base-radius and separation arrays for this frame */
  function computeFrame(t) {
    const burst = 0.8 + 0.2 * Math.sin(t * 0.53 + Math.sin(t * 0.29) * 2.0);
    for (let s = 0; s <= SEGS; s++) {
      const theta = thetaT[s];

      baseR[s] = R * (
        1 +
        0.020 * Math.sin(3 * theta + t * 0.8) +
        0.014 * Math.sin(5 * theta - t * 1.25)
      );

      const a = 0.5 + 0.5 * Math.sin(2 * theta + t * 1.13);
      const b = 0.5 + 0.5 * Math.sin(3 * theta - t * 1.87 + 2.3);
      const c = 0.6 + 0.4 * Math.sin(5 * theta + t * 0.71 + 4.1);
      // separation scales with strand width so the strands still pull
      // apart into distinct colors instead of merging into one slab
      sepR[s] = R * 0.32 * Math.min(a * b * 1.9, 1) * c * burst;
    }
  }

  /* Each strand is stroked several times over the same path — widest and
     faintest first, down to a thin solid core. The passes accumulate
     additively, giving the strand a soft feathered edge and a full centre
     instead of a flat slab. The path is built once and re-stroked, so the
     trig loop still runs only once per strand. */
  const STRAND_W = 25.2;
  const PASSES = [
    { w: 1.0,  a: 0.05 },
    { w: 0.62, a: 0.09 },
    { w: 0.26, a: 0.30 },
  ];

  function drawStrand(strand, t) {
    const phase = strand.psi + t * strand.drift + 0.8 * Math.sin(t * strand.wob + strand.wobPh);

    ctx.beginPath();
    for (let s = 0; s <= SEGS; s++) {
      const r = baseR[s] + sepR[s] * Math.sin(strand.m * thetaT[s] + phase);
      const x = C + cosT[s] * r;
      const y = C + sinT[s] * r;
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    const hue = (strand.hue + t * 12) % 360;
    for (let i = 0; i < PASSES.length; i++) {
      ctx.strokeStyle = `hsla(${hue}, 100%, 64%, ${PASSES[i].a})`;
      ctx.lineWidth = STRAND_W * PASSES[i].w;
      ctx.stroke();
    }
  }

  /* faint white spine keeps the ring coherent where strands part */
  function drawSpine() {
    ctx.beginPath();
    for (let s = 0; s <= SEGS; s++) {
      const x = C + cosT[s] * baseR[s];
      const y = C + sinT[s] * baseR[s];
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(255, 255, 255, 0.035)";
    ctx.lineWidth = 18;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 5.5;
    ctx.stroke();
  }

  function drawCore(t) {
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 1.7);
    ctx.fillStyle = coreGradient;
    ctx.fillRect(0, 0, BASE, BASE);
    ctx.globalAlpha = 1;
  }

  /* sparse drifting sparks */
  const SPARKS = 12;
  const sparks = [];
  for (let i = 0; i < SPARKS; i++) {
    sparks.push({
      x: Math.random(), y: Math.random(),
      r: 1.6 + Math.random() * 2.4,
      vx: (Math.random() - 0.5) * 0.015,
      vy: (Math.random() - 0.5) * 0.012,
      tw: 0.3 + Math.random() * 0.8,
      ph: Math.random() * TAU,
    });
  }

  function drawSparks(t, dt) {
    for (const p of sparks) {
      p.x = (p.x + p.vx * dt + 1) % 1;
      p.y = (p.y + p.vy * dt + 1) % 1;
      const a = 0.18 + 0.28 * Math.sin(t * p.tw * TAU + p.ph);
      if (a <= 0) continue;
      ctx.beginPath();
      ctx.arc(p.x * BASE, p.y * BASE, p.r, 0, TAU);
      ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
      ctx.fill();
    }
  }

  function render(t, dt) {
    ctx.clearRect(0, 0, BASE, BASE);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = "lighter";

    drawCore(t);
    computeFrame(t);
    drawSpine();
    for (const strand of STRANDS) drawStrand(strand, t);
    drawSparks(t, dt);
  }

  /* ---------- loop ----------

     One uniform state: the ring vibrates at full rate and full
     brightness everywhere, scrolling or not. It is never dimmed and
     never throttled by scroll position — the only place it should look
     softened is behind a card, and that comes from the card's own
     frosted glass, not from anything done to the ring itself.

     The single concession is the adaptive fallback: if the machine
     genuinely cannot hold the rate, it steps down once (and lowers the
     card blur with it) rather than stuttering. */

  const FRAME_MS = 32;
  const LOFI_MS = 48;

  let running = false;
  let last = 0;
  let lastDraw = 0;

  /* one-way, so it can never oscillate */
  let lofi = false;
  let sampled = 0;
  let sampledMs = 0;

  function checkBudget(interval) {
    if (lofi) return;
    sampled++;
    sampledMs += interval;
    if (sampled < 45) return;
    const avg = sampledMs / sampled;
    sampled = 0;
    sampledMs = 0;
    if (avg > FRAME_MS * 1.9) {
      lofi = true;
      document.documentElement.classList.add("lofi");
    }
  }

  function loop(now) {
    if (!running) return;
    requestAnimationFrame(loop);
    const interval = now - lastDraw;
    if (interval < (lofi ? LOFI_MS : FRAME_MS)) return;
    const dt = Math.min((now - last) / 1000, 0.12);
    last = now;
    lastDraw = now;
    render(now / 1000, dt);
    checkBudget(interval);
  }

  function updateRunning() {
    const shouldRun = !reducedMotion && !document.hidden;
    if (shouldRun && !running) {
      running = true;
      last = lastDraw = performance.now();
      requestAnimationFrame(loop);
    } else if (!shouldRun) {
      running = false;
    }
  }

  document.addEventListener("visibilitychange", updateRunning);

  if (reducedMotion) {
    render(4.2, 0); // single static frame
  } else {
    updateRunning();
  }
})();
