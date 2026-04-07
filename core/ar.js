// ═══════════════════════════════════════════════════════════
// CORE/AR.JS — Logique AR, Radar, Ghost Mode, Gyroscope
// Ne pas modifier pour ajouter des villes
// ═══════════════════════════════════════════════════════════

// ─── VARIABLES AR ────────────────────────────────────────────
let arStream = null;
let arActive = false;
let arHeading = 0;
let rawH = 0;
let heading = 0;
let calibOffset = 0;
let ghostMode = false;
let arRAF = null;

// ─── DÉMARRAGE AR ─────────────────────────────────────────────
function startAR() {
  document.getElementById('nav-ar').classList.add('active');
  document.querySelectorAll('.n-btn:not(#nav-ar)').forEach(b => b.classList.remove('active'));

  // iOS — requestPermission SYNCHRONE dans le même tick que le clic
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(perm => {
      if (perm === 'granted') {
        window.addEventListener('deviceorientation', handleOrientation, true);
      }
    }).catch(() => {
      window.addEventListener('deviceorientation', handleOrientation, true);
    });
  } else {
    // Android
    window.addEventListener('deviceorientationabsolute', handleOrientation, true);
    window.addEventListener('deviceorientation', handleOrientation, true);
  }

  _startARAsync();
}

async function _startARAsync() {
  try {
    arStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { exact: 'environment' } }, audio: false,
    });
  } catch {
    try {
      arStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, audio: false,
      });
    } catch {
      showToast('Caméra non disponible');
      return;
    }
  }

  document.getElementById('ar-video').srcObject = arStream;
  document.getElementById('ar-view').classList.add('on');
  document.getElementById('ar-distance-ring').textContent = 'Recherche GPS…';

  const pill = document.getElementById('ar-distance-ring');
  let gpsReady = false;

  navigator.geolocation?.watchPosition(pos => {
    userLat = pos.coords.latitude;
    userLng = pos.coords.longitude;
    if (!gpsReady) {
      gpsReady = true;
      pill.textContent = `GPS ✓ ${pos.coords.accuracy.toFixed(0)}m`;
    }
  }, () => {
    pill.textContent = 'GPS erreur';
  }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });

  arActive = true;
  heading = rawH;
  arLoop();
}

// ─── ARRÊT AR ─────────────────────────────────────────────────
function stopAR() {
  arActive = false;
  if (arRAF) { cancelAnimationFrame(arRAF); arRAF = null; }
  if (arStream) { arStream.getTracks().forEach(t => t.stop()); arStream = null; }
  if (ghostMode) { ghostMode = false; _applyGhostMode(false); }
  window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
  window.removeEventListener('deviceorientation', handleOrientation, true);

  document.getElementById('ar-view').classList.remove('on');
  document.getElementById('ar-video').srcObject = null;
  document.getElementById('ar-ov').innerHTML = '';
  document.getElementById('nav-ar').classList.remove('active');
}

// ─── BOUCLE AR ────────────────────────────────────────────────
function arLoop() {
  if (!arActive) return;

  // Lissage cap
  heading = lerpAngle(heading, rawH, 0.08);

  const ov = document.getElementById('ar-ov');
  const W = ov.clientWidth;
  const H = ov.clientHeight;
  const FOV = CONFIG.arFOV || 100;

  document.getElementById('ar-heading-text').textContent = Math.round(heading) + '° · AR Live';
  ov.innerHTML = '';

  // Trier par distance décroissante — lointains dessinés en premier
  const poisWithDist = PLACES.map(p => ({
    ...p,
    dist: calcDist(userLat, userLng, p.lat, p.lng),
  })).sort((a, b) => b.dist - a.dist);

  poisWithDist.forEach(poi => {
    if (poi.dist > (CONFIG.arRayonMax || 2000)) return;

    const bear = getBearing(userLat, userLng, poi.lat, poi.lng);
    let diff = bear - heading;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    if (Math.abs(diff) > FOV / 2) return;

    // Position X
    const x = W / 2 + (diff / (FOV / 2)) * (W / 2);

    // Ratio distance (courbe douce)
    const ratio = Math.pow(Math.min(poi.dist / 800, 1), 0.5);

    // Position Y — proche = bas, loin = haut
    const y = H * 0.72 - ratio * (H * 0.54);

    // Scale — effet profondeur
    const scale = 1.5 - ratio * 1.1;
    const opacity = 1.0 - ratio * 0.45;

    const col = CATS[poi.cat]?.color || '#333';

    const el = document.createElement('div');
    el.className = 'arc';
    el.style.cssText = `
      position:absolute;
      left:${x.toFixed(1)}px;
      top:${y.toFixed(1)}px;
      transform:translateX(-50%) scale(${scale.toFixed(3)});
      transform-origin:bottom center;
      opacity:${opacity.toFixed(2)};
      --cc:${col};
    `;
    el.innerHTML = `
      <div class="arc-bubble" style="--cc:${col}">
        <div class="arc-icon" style="background:${col};border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px">${poi.emoji || '📍'}</div>
        <div class="arc-info">
          <div class="arc-name">${poi.name}</div>
          <div class="arc-dist">${poi.dist < 1000 ? Math.round(poi.dist) + 'm' : (poi.dist / 1000).toFixed(1) + 'km'}</div>
        </div>
      </div>
      <div class="arc-stem"></div>
      <div class="arc-dot" style="--cc:${col}"></div>`;

    el.onclick = () => {
      stopAR();
      setTimeout(() => openImmersive(poi.id), 300);
    };

    ov.appendChild(el);
  });

  // Debug HUD
  const dbg = document.getElementById('ar-debug');
  if (dbg) dbg.innerHTML =
    'rawCompass: ' + ((window._rawCompass || 0).toFixed(1)) + '°<br>' +
    'calibOffset: ' + calibOffset.toFixed(1) + '°<br>' +
    'heading: ' + heading.toFixed(1) + '°<br>' +
    'GPS: ' + userLat.toFixed(5) + ', ' + userLng.toFixed(5) + '<br>' +
    'POIs: ' + ov.children.length;

  arRAF = requestAnimationFrame(arLoop);
}

// ─── ORIENTATION ──────────────────────────────────────────────
function handleOrientation(e) {
  let raw = 0;
  if (typeof e.webkitCompassHeading === 'number' && e.webkitCompassHeading >= 0) {
    raw = e.webkitCompassHeading;
  } else if (e.absolute === true && e.alpha != null) {
    raw = (360 - e.alpha) % 360;
  } else if (e.alpha != null) {
    raw = (360 - e.alpha) % 360;
  }
  window._rawCompass = raw;
  rawH = (raw - calibOffset + 360) % 360;
  arHeading = rawH;
}

function lerpAngle(cur, tgt, t) {
  let d = tgt - cur;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return (cur + d * t + 360) % 360;
}

// ─── GHOST MODE ───────────────────────────────────────────────
function toggleGhostMode() {
  ghostMode = !ghostMode;
  _applyGhostMode(ghostMode);
  const btn = document.getElementById('ar-ghost-btn');
  if (ghostMode) {
    btn.classList.add('active');
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 15,15"/></svg> Époque active`;
    document.getElementById('ar-epoch-banner').classList.add('on');
    showToast('Mode Histoire activé');
  } else {
    btn.classList.remove('active');
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 15,15"/></svg> Mode Histoire`;
    document.getElementById('ar-epoch-banner').classList.remove('on');
  }
}

function _applyGhostMode(on) {
  const video = document.getElementById('ar-video');
  const grain = document.getElementById('ar-grain');
  const vignette = document.getElementById('ar-vignette');
  const scratches = document.getElementById('ar-scratches');
  const ghostOv = document.getElementById('ar-ghost-ov');

  if (on) {
    video.classList.add('ghost-mode');
    grain.classList.add('on');
    vignette.classList.add('on');
    scratches.classList.add('on');
    ghostOv.classList.add('on');
    // Flash effect
    const flash = document.getElementById('ar-flash');
    flash.classList.remove('flash');
    void flash.offsetWidth;
    flash.classList.add('flash');
  } else {
    video.classList.remove('ghost-mode');
    grain.classList.remove('on');
    vignette.classList.remove('on');
    scratches.classList.remove('on');
    ghostOv.classList.remove('on');
  }
}

// ─── RADAR ────────────────────────────────────────────────────
function openRadar() {
  stopAR();
  document.getElementById('radar-view').classList.add('on');
  startGPSWatch();
  setTimeout(drawRadar, 100);
}

function closeRadar() {
  document.getElementById('radar-view').classList.remove('on');
  document.getElementById('radar-info').classList.add('hidden');
  selectedRadarPlace = null;
}

function drawRadar() {
  if (!document.getElementById('radar-view').classList.contains('on')) return;

  const canvas = document.getElementById('radar-canvas');
  const wrap = document.getElementById('radar-canvas-wrap');
  const size = Math.min(wrap.clientWidth, wrap.clientHeight - 20);
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2, cy = size / 2, r = size / 2 - 10;

  // Fond radial
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, 'rgba(26,115,232,0.08)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

  // Cercles
  [0.33, 0.66, 1].forEach((f, i) => {
    ctx.beginPath(); ctx.arc(cx, cy, r * f, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(26,115,232,${0.15 - i * 0.03})`; ctx.lineWidth = 1; ctx.stroke();
    const labels = ['200m', '500m', '1km'];
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '10px Manrope'; ctx.textAlign = 'center';
    ctx.fillText(labels[i], cx, cy - r * f + 14);
  });

  // Axes
  [['N', 0], ['E', 90], ['S', 180], ['O', 270]].forEach(([l, a]) => {
    const rad = a * Math.PI / 180;
    ctx.fillStyle = a === 0 ? '#e74c3c' : 'rgba(255,255,255,0.5)';
    ctx.font = 'bold 11px Manrope'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(l, cx + Math.sin(rad) * (r + 2), cy - Math.cos(rad) * (r + 2));
  });

  // Sweep animé
  const sweep = (Date.now() / 3000) % 1 * Math.PI * 2;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(sweep);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + 0.8, false);
  ctx.fillStyle = 'rgba(26,115,232,0.15)'; ctx.fill();
  ctx.restore();

  // Point utilisateur
  ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#0f1923'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill();

  // Pins des lieux
  const pinsLayer = document.getElementById('radar-pins-layer');
  pinsLayer.innerHTML = '';
  pinsLayer.style.cssText = 'position:absolute;inset:0;pointer-events:auto';
  const maxDist = CONFIG.radarRayonMax || 1000;

  PLACES.forEach(place => {
    const dist = calcDist(userLat, userLng, place.lat, place.lng);
    if (dist > maxDist * 1.5) return;
    const bearing = getBearing(userLat, userLng, place.lat, place.lng);
    const normDist = Math.min(dist / maxDist, 1);
    const rad = bearing * Math.PI / 180;
    const px = cx + Math.sin(rad) * normDist * r;
    const py = cy - Math.cos(rad) * normDist * r;
    const col = CATS[place.cat]?.color || '#1a73e8';
    const dTxt = dist < 1000 ? Math.round(dist) + 'm' : (dist / 1000).toFixed(1) + 'km';

    const pin = document.createElement('div');
    pin.className = 'radar-pin';
    pin.style.cssText = `left:${px}px;top:${py}px;`;
    pin.innerHTML = `
      <div class="radar-pin-dot" style="background:${col};color:${col}"></div>
      <div class="radar-pin-label">${place.name}<br><span class="radar-pin-dist">${dTxt}</span></div>`;
    pin.onclick = () => selectRadarPlace(place, col, dTxt);
    pinsLayer.appendChild(pin);
  });

  requestAnimationFrame(drawRadar);
}

function selectRadarPlace(place, col, dTxt) {
  selectedRadarPlace = place;
  const info = document.getElementById('radar-info');
  info.classList.remove('hidden');
  document.getElementById('radar-info-icon').innerHTML = `<div style="width:40px;height:40px;border-radius:50%;background:${col};display:flex;align-items:center;justify-content:center;font-size:20px">${place.emoji || '🏛️'}</div>`;
  document.getElementById('radar-info-name').textContent = place.name;
  document.getElementById('radar-info-dist').textContent = `${dTxt} · ${CATS[place.cat]?.label || ''}`;
}

function navigateToSelected() {
  if (!selectedRadarPlace) return;
  closeRadar();
  startNavigation(selectedRadarPlace);
}

function navigateToNearest() {
  const nearest = PLACES.reduce((best, p) => {
    const d = calcDist(userLat, userLng, p.lat, p.lng);
    return d < best.d ? { d, p } : best;
  }, { d: Infinity, p: null });
  if (nearest.p) { stopAR(); startNavigation(nearest.p); }
}

// ─── LIGHTBOX HISTORIQUE ──────────────────────────────────────
function openHistLightbox(src, caption) {
  document.getElementById('hist-lightbox-img').src = src;
  document.getElementById('hist-lightbox-caption').textContent = caption;
  document.getElementById('hist-lightbox').classList.add('on');
}

function closeHistLightbox() {
  document.getElementById('hist-lightbox').classList.remove('on');
}
