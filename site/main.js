// Сцены привязаны к прокрутке: каждый [data-scene] получает --p от 0 до 1 и класс .on.
// Закреплённые сцены (data-pin) водят «камеру» по картинке. Интерфейс игры (часы, деньги,
// звёзды розыска, радар, сирены) считается из того, какая сцена сейчас на экране.
(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t * t * (3 - 2 * t);

  const root = document.documentElement;
  const scenes = [...document.querySelectorAll('[data-scene]')];
  const pins = scenes.filter((s) => s.hasAttribute('data-pin'));
  const byId = (id) => document.getElementById(id);
  const cover = document.querySelector('.cover');

  /* ---------- камера: куда смотреть в каждой закреплённой сцене ---------- */

  // t — момент прокрутки внутри сцены, x/y — точка картинки в центре экрана (доли), z — приближение
  const cams = {
    villa: [
      { t: 0, x: .62, y: .4, z: 1 },
      { t: .35, x: .6, y: .42, z: 1.1 },
      { t: .85, x: .31, y: .5, z: 1.35 },
      { t: 1, x: .31, y: .5, z: 1.4 },
    ],
    prep: [
      { t: 0, x: .5, y: .5, z: 1 },
      { t: .12, x: .15, y: .27, z: 1.3 },
      { t: .26, x: .51, y: .16, z: 1.3 },
      { t: .4, x: .37, y: .52, z: 1.3 },
      { t: .54, x: .13, y: .8, z: 1.3 },
      { t: .68, x: .57, y: .58, z: 1.3 },
      { t: .82, x: .86, y: .26, z: 1.3 },
      { t: 1, x: .5, y: .5, z: 1 },
    ],
    drive: [
      { t: 0, x: .22, y: .5, z: 1.05 },
      { t: .6, x: .7, y: .42, z: 1.12 },
      { t: 1, x: .9, y: .3, z: 1.2 },
    ],
    roulette: [
      { t: 0, x: .32, y: .4, z: 1 },
      { t: .4, x: .58, y: .74, z: 1.45 },
      { t: .56, x: .82, y: .52, z: 1.5 },
      { t: .8, x: .6, y: .5, z: 1.1 },
      { t: 1, x: .5, y: .5, z: 1 },
    ],
    exit: [
      { t: 0, x: .63, y: .3, z: 1.35 },
      { t: .5, x: .5, y: .45, z: 1.1 },
      { t: 1, x: .3, y: .5, z: 1 },
    ],
    boat: [
      { t: 0, x: .48, y: .45, z: 1.3 },
      { t: .5, x: .5, y: .5, z: 1 },
      { t: 1, x: .93, y: .3, z: 1.5 },
    ],
  };

  function camAt(keys, p) {
    let i = 0;
    while (i < keys.length - 2 && p > keys[i + 1].t) i++;
    const a = keys[i], b = keys[i + 1];
    const k = ease(clamp((p - a.t) / (b.t - a.t || 1)));
    return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), z: lerp(a.z, b.z, k) };
  }

  function layoutPins() {
    pins.forEach((pin) => {
      const stage = pin.querySelector('.stage');
      const view = pin.querySelector('.pin__view');
      const ar = parseFloat(stage.dataset.ar);
      const vw = view.clientWidth;
      const vh = view.clientHeight;
      const h = Math.max(vh, vw / ar);
      const w = h * ar;
      stage.style.width = w + 'px';
      stage.style.height = h + 'px';
      Object.assign(pin, { _w: w, _h: h, _vw: vw, _vh: vh });
    });
  }

  function placeCamera(pin, p, shake) {
    const keys = cams[pin.id];
    if (!keys || !pin._w) return;
    const c = camAt(keys, p);
    const W = pin._w * c.z;
    const H = pin._h * c.z;
    let tx = pin._vw / 2 - c.x * W;
    let ty = pin._vh / 2 - c.y * H;
    tx = clamp(tx, pin._vw - W, 0);
    ty = clamp(ty, pin._vh - H, 0);
    if (shake) {
      tx += (Math.random() - .5) * shake;
      ty += (Math.random() - .5) * shake;
    }
    pin.querySelector('.stage').style.transform = `translate(${tx}px, ${ty}px) scale(${c.z})`;
  }

  /* ---------- частицы: фишки, купюры, брызги, конфетти ---------- */

  const canvas = byId('fx');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0;
  const parts = [];

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth;
    H = innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layoutPins();
  }

  function spawn(kind, x, y, n, spread = 1) {
    if (reduceMotion) return;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - .5) * Math.PI * spread;
      const s = 6 + Math.random() * 10;
      parts.push({
        kind, x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        r: Math.random() * Math.PI * 2,
        vr: (Math.random() - .5) * .3,
        flip: Math.random() * Math.PI,
        size: kind === 'chip' ? 9 + Math.random() * 5 : kind === 'spray' ? 2 + Math.random() * 3 : 10 + Math.random() * 6,
        hue: ['#ff3d8b', '#f2c14e', '#fff', '#6ddc5a', '#6ec3ee'][i % 5],
        life: 1,
      });
    }
  }

  function draw(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.r);
    ctx.globalAlpha = clamp(p.life * 1.5);
    if (p.kind === 'chip') {
      ctx.scale(1, Math.abs(Math.cos(p.flip)) * .8 + .2);
      ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fillStyle = '#d7263d'; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#121012'; ctx.stroke();
      ctx.setLineDash([3, 3]); ctx.strokeStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, p.size * .68, 0, Math.PI * 2); ctx.stroke();
    } else if (p.kind === 'bill') {
      ctx.scale(Math.abs(Math.cos(p.flip)) * .9 + .1, 1);
      ctx.fillStyle = '#7fcf6a'; ctx.strokeStyle = '#121012'; ctx.lineWidth = 2;
      ctx.fillRect(-p.size, -p.size * .5, p.size * 2, p.size);
      ctx.strokeRect(-p.size, -p.size * .5, p.size * 2, p.size);
      ctx.beginPath(); ctx.arc(0, 0, p.size * .28, 0, Math.PI * 2); ctx.stroke();
    } else if (p.kind === 'spray') {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.scale(Math.abs(Math.cos(p.flip)) * .9 + .1, 1);
      ctx.fillStyle = p.hue; ctx.fillRect(-p.size * .5, -p.size * .25, p.size, p.size * .5);
    }
    ctx.restore();
  }

  function stepParts() {
    ctx.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      const heavy = p.kind === 'chip';
      p.vx *= .985;
      p.vy = p.vy * .985 + (heavy ? .45 : p.kind === 'spray' ? .35 : .2);
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      p.flip += .12;
      p.life -= p.kind === 'spray' ? .03 : .007;
      if (p.life <= 0 || p.y > H + 60) { parts.splice(i, 1); continue; }
      draw(p);
    }
  }

  /* ---------- HUD ---------- */

  const hud = document.querySelector('.hud');
  const radar = document.querySelector('.radar');
  const clock = byId('clock');
  const cashEl = byId('cash');
  const stars = byId('stars');
  const starEls = [...stars.querySelectorAll('svg')];
  const route = byId('route');
  const player = byId('player');
  const routeLen = route.getTotalLength();
  const kmh = byId('kmh');

  const skyStops = [
    [485, '#bfe6f7', '#fdf3dd'],
    [720, '#86cdf3', '#f7e3b5'],
    [900, '#7cc6ef', '#f4d9a0'],
    [1170, '#ffb067', '#ff7a8f'],
    [1215, '#b56aa8', '#ff8a5c'],
    [1255, '#5a3f8c', '#ff7f6a'],
  ];
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => {
    const A = hex(a), B = hex(b);
    return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',')})`;
  };
  function skyAt(min) {
    let i = 0;
    while (i < skyStops.length - 2 && min > skyStops[i + 1][0]) i++;
    const a = skyStops[i], b = skyStops[i + 1];
    const t = clamp((min - a[0]) / (b[0] - a[0]));
    return [mix(a[1], b[1], t), mix(a[2], b[2], t)];
  }

  const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');
  let lastCash = '';
  let lastStars = -1;

  function updateHud(vh) {
    // текущая сцена — последняя, чей верх уже прошёл середину экрана
    let cur = scenes[0];
    for (const s of scenes) if (s._top <= vh * .5) cur = s;
    const [t0, t1] = cur.dataset.time.split(' ').map(Number);
    const [r0, r1] = cur.dataset.route.split(' ').map(Number);
    const k = cur._p || 0;
    const minutes = lerp(t0, t1, k);

    const hh = Math.floor(minutes / 60), mm = Math.floor(minutes % 60);
    clock.textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    const [c1, c2] = skyAt(minutes);
    root.style.setProperty('--bg1', c1);
    root.style.setProperty('--bg2', c2);

    const pt = route.getPointAtLength(routeLen * lerp(r0, r1, k));
    const ahead = route.getPointAtLength(Math.min(routeLen, routeLen * lerp(r0, r1, k) + 2));
    const ang = Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180 / Math.PI + 90;
    player.setAttribute('transform', `translate(${pt.x} ${pt.y}) rotate(${ang})`);

    // деньги растут вместе с выигрышем в рулетке
    const rp = byId('roulette')._p || 0;
    const cash = fmt(lerp(1250, 7777777, ease(clamp((rp - .55) / .2))));
    if (cash !== lastCash) {
      cashEl.textContent = cash;
      if (lastCash && rp > .55 && rp < .76) { cashEl.classList.remove('bump'); void cashEl.offsetWidth; cashEl.classList.add('bump'); }
      lastCash = cash;
    }

    // звёзды розыска: загораются при уходе из казино и гаснут, пока катер уходит в море
    const ep = byId('exit')._p || 0;
    const bp = byId('boat')._p || 0;
    let level = 0, siren = 0, flashing = false;
    if (bp > 0) {
      level = Math.round(5 * (1 - clamp((bp - .35) / .55)));
      siren = 1 - clamp((bp - .2) / .6);
      flashing = level > 0 && bp > .2;
    } else if (ep > 0) {
      level = Math.ceil(clamp((ep - .08) / .5) * 5);
      siren = clamp((ep - .05) * 4);
    }
    if (level !== lastStars) {
      starEls.forEach((s, i) => s.classList.toggle('on', i < level));
      lastStars = level;
    }
    stars.classList.toggle('flashing', flashing);
    root.style.setProperty('--siren', (siren * .85).toFixed(3));

    // на обложке и на экране «mission passed» интерфейс прячется, как в игре
    const show = scrollY > vh * .55 && document.querySelector('.passed')._top > vh * .5;
    hud.classList.toggle('show', show);
    radar.classList.toggle('show', show);
  }

  /* ---------- плавный скролл ---------- */

  const lenis = !reduceMotion && window.Lenis
    ? new window.Lenis({ lerp: .08, wheelMultiplier: .9 })
    : null;

  /* ---------- главный цикл ---------- */

  let jackpotHit = false;
  let sprayTick = 0;

  function frame(time) {
    if (lenis) lenis.raf(time);
    const vh = innerHeight;

    for (const s of scenes) {
      const r = s.getBoundingClientRect();
      s._top = r.top;
      const p = s.hasAttribute('data-pin')
        ? clamp(-r.top / (r.height - vh))
        : clamp((vh - r.top) / (vh + r.height));
      s._p = p;
      s.style.setProperty('--p', p.toFixed(4));
      if (!s.classList.contains('on') && r.top < vh * .7 && r.bottom > 0) s.classList.add('on');
    }

    const exitShake = !reduceMotion ? clamp((byId('exit')._p - .1) * 2) * 6 : 0;
    for (const pin of pins) {
      if (pin._top > vh || pin._top + pin.offsetHeight < 0) continue;
      placeCamera(pin, pin._p, pin.id === 'exit' ? exitShake : 0);
    }

    const drive = byId('drive');
    drive.style.setProperty('--speed', (.2 + ease(drive._p) * .75).toFixed(3));
    kmh.textContent = Math.round(40 + ease(drive._p) * 147);

    const roulette = byId('roulette');
    const rp = roulette._p;
    roulette.style.setProperty('--flash', reduceMotion ? 0 : clamp(1 - Math.abs(rp - .56) * 14).toFixed(3));
    if (rp > .56 && !jackpotHit) {
      jackpotHit = true;
      // при быстром пролёте мимо рулетки фишки не сыплются на следующие сцены
      if (rp < .8) {
        spawn('chip', W * .5, H * .55, 40, 1.3);
        spawn('bill', W * .5, H * .55, 30, 1.6);
      }
    } else if (rp < .45 && jackpotHit) {
      jackpotHit = false;
    }

    const boat = byId('boat');
    if (boat._p > 0 && boat._p < 1 && ++sprayTick % 3 === 0) {
      spawn('spray', W * (.55 + Math.random() * .4), H + 10, 3, .5);
    }

    updateHud(vh);
    stepParts();
    requestAnimationFrame(frame);
  }

  /* ---------- шампанское ---------- */

  const pop = byId('pop');
  const popLabel = byId('pop-label');
  const labels = ['Cheers!', 'One more', 'Santé!', 'To Monaco', 'Pop the champagne'];
  let pops = 0;
  pop.addEventListener('click', () => {
    pop.classList.remove('popped');
    void pop.offsetWidth;
    pop.classList.add('popped');
    const r = pop.getBoundingClientRect();
    spawn('confetti', r.left + r.width / 2, r.top, 90, 1.1);
    spawn('bill', r.left + r.width / 2, r.top, 18, 1.2);
    popLabel.textContent = labels[pops % labels.length];
    pops++;
  });

  // полоса загрузки на обложке
  setTimeout(() => cover.classList.add('loaded'), reduceMotion ? 0 : 2800);

  addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
})();
