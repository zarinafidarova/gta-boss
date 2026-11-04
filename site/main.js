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
    // вторая миссия
    paddock: [
      { t: 0, x: .2, y: .35, z: 1.25 },
      { t: .35, x: .6, y: .32, z: 1.15 },
      { t: .7, x: .88, y: .5, z: 1.2 },
      { t: 1, x: .5, y: .5, z: 1 },
    ],
    gear: [
      { t: 0, x: .5, y: .5, z: 1 },
      { t: .12, x: .38, y: .29, z: 1.35 },
      { t: .26, x: .47, y: .21, z: 1.35 },
      { t: .4, x: .28, y: .76, z: 1.35 },
      { t: .54, x: .44, y: .6, z: 1.35 },
      { t: .68, x: .51, y: .75, z: 1.35 },
      { t: .82, x: .77, y: .47, z: 1.35 },
      { t: 1, x: .5, y: .5, z: 1 },
    ],
    grid: [
      { t: 0, x: .85, y: .12, z: 1.2 },
      { t: .3, x: .5, y: .18, z: 1.1 },
      { t: .5, x: .22, y: .42, z: 1.25 },
      { t: .7, x: .7, y: .5, z: 1.15 },
      { t: 1, x: .5, y: .62, z: 1 },
    ],
    harbor: [
      { t: 0, x: .3, y: .4, z: 1.15 },
      { t: .6, x: .68, y: .58, z: 1.15 },
      { t: 1, x: .55, y: .45, z: 1 },
    ],
    tunnel: [
      { t: 0, x: .25, y: .45, z: 1.25 },
      { t: .7, x: .72, y: .45, z: 1.3 },
      { t: 1, x: .85, y: .4, z: 1.4 },
    ],
    hairpin: [
      { t: 0, x: .75, y: .22, z: 1.25 },
      { t: .45, x: .55, y: .6, z: 1.1 },
      { t: 1, x: .45, y: .58, z: 1.3 },
    ],
    finish: [
      { t: 0, x: .2, y: .2, z: 1.25 },
      { t: .5, x: .48, y: .42, z: 1.15 },
      { t: 1, x: .5, y: .5, z: 1 },
    ],
  };

  // тряска камеры: при уходе из казино, на старте и в туннеле
  function shakeFor(pin) {
    if (reduceMotion) return 0;
    const p = pin._p;
    if (pin.id === 'exit') return clamp((p - .1) * 2) * 6;
    if (pin.id === 'grid') return p > .66 && p < .76 ? 12 : 0;
    if (pin.id === 'tunnel') return p < .8 ? 3 : 0;
    if (pin.id === 'harbor') return 2;
    return 0;
  }

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
    document.querySelectorAll('.slot').forEach((slot) => {
      const img = slot.querySelector('.slot__img');
      const S = img.clientWidth;
      const iw = S * 5;
      const ih = iw / 1.5;
      img.style.backgroundPosition = `${S / 2 - slot.dataset.x * iw}px ${S / 2 - slot.dataset.y * ih}px`;
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
  const circuit = byId('circuit');
  const circuitLen = circuit.getTotalLength();
  const posEl = byId('pos');
  const lapEl = byId('lap');
  const speedPins = pins.filter((p) => p.dataset.speed);
  speedPins.forEach((p) => {
    p._num = p.querySelector('.speedo__num, .rpm__kmh b');
    p._rpm = p.querySelector('.rpm');
    if (p._rpm) p._leds = [...p._rpm.querySelectorAll('.rpm__bar i')];
  });

  // табло позиций: номер 7 поднимается, остальные сдвигаются
  const tower = byId('tower');
  const rivals = [[1, '#1f5c3a'], [3, '#2f7bff'], [4, '#f2c14e'], [5, '#d7263d'], [8, '#ff8c38'], [9, '#7a4fd1'], [11, '#2fb5a4'], [12, '#ff3d8b'], [14, '#8a8a8a'], [16, '#b56aa8'], [18, '#5a3f8c']];
  const rows = new Map();
  [[7, '#d7263d'], ...rivals].forEach(([n, c]) => {
    const li = document.createElement('li');
    li.innerHTML = `<i></i>No ${n}`;
    li.style.setProperty('--team', c);
    if (n === 7) li.classList.add('me');
    tower.appendChild(li);
    rows.set(n, li);
  });
  let towerPos = 0;
  function placeTower(pos) {
    if (pos === towerPos) return;
    towerPos = pos;
    const order = rivals.map(([n]) => n);
    order.splice(pos - 1, 0, 7);
    order.forEach((n, i) => {
      const li = rows.get(n);
      li.dataset.rank = i + 1;
      li.style.transform = `translateY(${i * 21}px)`;
    });
  }
  const lights = [...byId('lights').querySelectorAll('i')];

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
  function setNum(el, v) {
    const t = String(v);
    if (el.textContent === t) return;
    el.textContent = t;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }
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

    // на радаре: в первой миссии маршрут по побережью, во второй три круга по трассе
    const race = cur.dataset.map === 'race';
    radar.classList.toggle('race', race);
    const path = race ? circuit : route;
    const len = race ? circuitLen : routeLen;
    const along = race ? ((lerp(r0, r1, k) * 3) % 1) * len : lerp(r0, r1, k) * len;
    const pt = path.getPointAtLength(along);
    const ahead = path.getPointAtLength(Math.min(len, along + 2));
    const ang = Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180 / Math.PI + 90;
    player.setAttribute('transform', `translate(${pt.x} ${pt.y}) rotate(${ang})`);

    // позиция и круг во время гонки
    hud.classList.toggle('race', Boolean(cur.dataset.pos));
    if (cur.dataset.pos) {
      const [p0, p1] = cur.dataset.pos.split(' ').map(Number);
      const [l0, l1] = cur.dataset.lap.split(' ').map(Number);
      const pos = Math.round(lerp(p0, p1, k));
      setNum(posEl, pos);
      placeTower(pos);
      setNum(lapEl, Math.round(lerp(l0, l1, k)));
    }

    // деньги растут вместе с выигрышем в рулетке
    const rp = byId('roulette')._p || 0;
    const podiumP = byId('podium')._p || 0;
    const cash = fmt(lerp(1250, 7777777, ease(clamp((rp - .55) / .2))) + 1e6 * ease(clamp((podiumP - .35) / .35)));
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
    const show = !cur.classList.contains('cover') && !cur.classList.contains('passed');
    tower.classList.toggle('show', Boolean(cur.dataset.pos) && show);
    hud.classList.toggle('show', show);
    radar.classList.toggle('show', show);
  }

  /* ---------- плавный скролл ---------- */

  const lenis = !reduceMotion && window.Lenis
    ? new window.Lenis({ lerp: .08, wheelMultiplier: .9 })
    : null;

  /* ---------- главный цикл ---------- */

  let jackpotHit = false;
  let finishHit = false;
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
      if (!s.classList.contains('on') && r.top < vh * .7 && r.bottom > 0) {
        s.classList.add('on');
        if (s.classList.contains('cover') && s !== cover) setTimeout(() => s.classList.add('loaded'), reduceMotion ? 0 : 2800);
      }
    }

    for (const pin of pins) {
      if (pin._top > vh || pin._top + pin.offsetHeight < 0) continue;
      placeCamera(pin, pin._p, shakeFor(pin));
    }

    for (const pin of speedPins) {
      const [a, b] = pin.dataset.speed.split(' ').map(Number);
      const v = lerp(a, b, ease(pin._p));
      pin.style.setProperty('--speed', (v / 300).toFixed(3));
      pin._num.textContent = Math.round(v);
      if (pin._rpm) {
        // передачи: на каждой обороты растут от зелёного к красному, потом щелчок вниз
        const bands = [0, 90, 140, 190, 235, 270, 320];
        let g = 1;
        while (g < bands.length - 1 && v >= bands[g]) g++;
        const frac = clamp((v - bands[g - 1]) / (bands[g] - bands[g - 1]));
        const lit = Math.round(3 + frac * 9);
        pin._leds.forEach((l, i) => l.classList.toggle('on', i < lit));
        const gearEl = pin._rpm.querySelector('.rpm__gear');
        if (gearEl.textContent !== String(g)) {
          gearEl.textContent = g;
          pin._rpm.classList.remove('shift');
          void pin._rpm.offsetWidth;
          pin._rpm.classList.add('shift');
          setTimeout(() => pin._rpm.classList.remove('shift'), 140);
        }
      }
    }

    // стартовые огни загораются по одному и гаснут все сразу
    const gp = byId('grid')._p;
    const lit = gp > .66 ? 0 : gp < .15 ? 0 : Math.min(5, Math.floor((gp - .15) / .09) + 1);
    lights.forEach((l, i) => l.classList.toggle('on', i < lit));
    byId('lights').classList.toggle('out', gp > .66);

    const fin = byId('finish')._p;
    if (fin > .6 && !finishHit) {
      finishHit = true;
      if (fin < .85) {
        spawn('confetti', W * .5, H * .4, 110, 1.6);
        spawn('confetti', W * .2, H * .6, 50, 1);
        spawn('confetti', W * .8, H * .6, 50, 1);
      }
    } else if (fin < .35 && finishHit) {
      finishHit = false;
    }

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

  const labels = ['Cheers!', 'One more', 'Santé!', 'To Monaco'];
  document.querySelectorAll('.pop').forEach((pop) => {
    const label = pop.querySelector('.pop__label');
    const first = label.textContent;
    let pops = 0;
    pop.addEventListener('click', () => {
      pop.classList.remove('popped');
      void pop.offsetWidth;
      pop.classList.add('popped');
      const r = pop.getBoundingClientRect();
      spawn('confetti', r.left + r.width / 2, r.top, 90, 1.1);
      spawn('bill', r.left + r.width / 2, r.top, 18, 1.2);
      pops++;
      label.textContent = [...labels, first][(pops - 1) % (labels.length + 1)];
    });
  });

  // полоса загрузки на обложке
  setTimeout(() => cover.classList.add('loaded'), reduceMotion ? 0 : 2800);

  addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
})();
