// ═══════════════════════════════════════════════════════════
// CORE/AR.JS — Logique AR v2 : Pitch + Tilt Compensation + Smoothing
// ═══════════════════════════════════════════════════════════

let arStream = null;
let arActive = false;
let arRAF = null;

// Heading (horizontal) - boussole
let rawHeading = 0;
let heading = 0;
let calibOffset = 0;

// Pitch (vertical) - inclinaison avant/arrière
let rawPitch = 0;
let pitch = 0;

// Roll - rotation gauche/droite (utile pour tilt compensation Android)
let rawRoll = 0;

// Position GPS lissée (moyenne glissante)
let gpsBuffer = [];
const GPS_BUFFER_SIZE = 5;

// Ghost mode
let ghostMode = false;

// État capteurs
let hasAbsoluteOrientation = false;
let isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

// ═══════════════════════════════════════════════════════════
// DÉMARRAGE AR
// ═══════════════════════════════════════════════════════════

function startAR() {
  document.getElementById('nav-ar').classList.add('active');
  document.querySelectorAll('.n-btn:not(#nav-ar)').forEach(b => b.classList.remove('active'));

  // Permission iOS 13+
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(perm => {
      if (perm === 'granted') {
        window.addEventListener('deviceorientation', handleOrientation, true);
      } else {
        showToast('Permission orientation refusée');
      }
    }).catch(() => {
      window.addEventListener('deviceorientation', handleOrientation, true);
    });
  } else {
    // Android : préfère deviceorientationabsolute (boussole absolue)
    window.addEventListener('deviceorientationabsolute', (e) => {
      hasAbsoluteOrientation = true;
      handleOrientation(e);
    }, true);
    window.addEventListener('deviceorientation', handleOrientation, true);
  }

  _startARAsync();
}

async function _startARAsync() {
  try {
    arStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { exact: 'environment' } },
      audio: false
    });
  } catch {
    try {
      arStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
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
    // Lissage GPS : moyenne glissante pour stabiliser
    gpsBuffer.push({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    if (gpsBuffer.length > GPS_BUFFER_SIZE) gpsBuffer.shift();

    const avg = gpsBuffer.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 });
    userLat = avg.lat / gpsBuffer.length;
    userLng = avg.lng / gpsBuffer.length;

    if (!gpsReady) {
      gpsReady = true;
      pill.textContent = `GPS · ${pos.coords.accuracy.toFixed(0)}m`;
    } else {
      pill.textContent = `GPS · ${pos.coords.accuracy.toFixed(0)}m`;
    }
  }, () => {
    pill.textContent = 'GPS erreur';
  }, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 15000
  });

  arActive = true;
  heading = rawHeading;
  pitch = rawPitch;
  arLoop();
}

// ═══════════════════════════════════════════════════════════
// ARRÊT AR
// ═══════════════════════════════════════════════════════════

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

  gpsBuffer = [];
}

// ═══════════════════════════════════════════════════════════
// GESTION ORIENTATION (boussole + inclinaison)
// ═══════════════════════════════════════════════════════════

function handleOrientation(e) {
  // ─── HEADING (boussole horizontale) ────────────────────
  let rawH = 0;

  if (typeof e.webkitCompassHeading === 'number' && e.webkitCompassHeading >= 0) {
    // iOS : valeur déjà compensée en tilt, c'est la meilleure source
    rawH = e.webkitCompassHeading;
  } else if (e.absolute === true && e.alpha != null) {
    // Android avec boussole absolue
    rawH = compensateCompassTilt(e.alpha, e.beta, e.gamma);
  } else if (e.alpha != null) {
    // Fallback : alpha brute (moins précis mais fonctionnel)
    rawH = (360 - e.alpha) % 360;
  }

  rawHeading = (rawH - calibOffset + 360) % 360;

  // ─── PITCH (inclinaison avant/arrière) ──────────────────
  // beta: 0° = couché à plat, 90° = debout vertical
  // On veut convertir pour que 0 = regard horizontal
  if (e.beta != null) {
    // beta va de -180 à 180. En usage AR (téléphone tenu devant soi)
    // beta est généralement entre 0 et 90
    // On veut : 0 = horizontal, +1 = regard vers le haut, -1 = regard vers le bas
    rawPitch = 90 - e.beta; // Si beta=90 (téléphone vertical) → pitch=0 (regard horizontal)
  }

  // ─── ROLL (pour tilt compensation) ──────────────────────
  if (e.gamma != null) {
    rawRoll = e.gamma;
  }

  // Pour debug éventuel
  window._rawCompass = rawH;
  window._rawPitch = rawPitch;
}

/**
 * Tilt compensation pour Android (sans webkitCompassHeading)
 * Convertit alpha/beta/gamma en heading réel même si le téléphone est incliné
 */
function compensateCompassTilt(alpha, beta, gamma) {
  if (alpha == null || beta == null || gamma == null) {
    return (360 - (alpha || 0)) % 360;
  }

  const alphaRad = alpha * Math.PI / 180;
  const betaRad = beta * Math.PI / 180;
  const gammaRad = gamma * Math.PI / 180;

  const cA = Math.cos(alphaRad), sA = Math.sin(alphaRad);
  const cB = Math.cos(betaRad), sB = Math.sin(betaRad);
  const cG = Math.cos(gammaRad), sG = Math.sin(gammaRad);

  // Matrice de rotation pour projeter le nord magnétique
  const rA = -cA * sG - sA * sB * cG;
  const rB = -sA * sG + cA * sB * cG;

  let heading = Math.atan2(rA, rB) * 180 / Math.PI;
  if (heading < 0) heading += 360;

  return heading;
}

// ═══════════════════════════════════════════════════════════
// BOUCLE AR
// ═══════════════════════════════════════════════════════════

function arLoop() {
  if (!arActive) return;

  // ─── LISSAGE : lerp adaptatif ──────────────────────────
  // Plus la différence est grande, plus on rattrape vite (éviter le lag visuel)
  const diffH = angleDiff(rawHeading, heading);
  const smoothH = Math.abs(diffH) > 15 ? 0.35 : 0.18;
  heading = lerpAngle(heading, rawHeading, smoothH);

  // Pitch : lissage plus doux car moins de bruit
  pitch = pitch + (rawPitch - pitch) * 0.2;

  // ─── DIMENSIONS & FOV ──────────────────────────────────
  const ov = document.getElementById('ar-ov');
  const W = ov.clientWidth;
  const H = ov.clientHeight;
  const FOV_H = CONFIG.arFOV || 70;        // FOV horizontal caméra (~70° typique)
  const FOV_V = (FOV_H * H) / W;           // FOV vertical dérivé du ratio écran

  document.getElementById('ar-heading-text').textContent =
    Math.round(heading) + '° · AR';

  ov.innerHTML = '';

  // ─── TRI POI par distance (plus loin = rendu en premier, donc en arrière) ─
  const poisWithDist = PLACES.map(p => ({
    ...p,
    dist: calcDist(userLat, userLng, p.lat, p.lng),
    bearing: getBearing(userLat, userLng, p.lat, p.lng)
  })).sort((a, b) => b.dist - a.dist);

  poisWithDist.forEach(poi => {
    if (poi.dist > (CONFIG.arRayonMax || 2000)) return;

    // ─── ANGLE HORIZONTAL ────────────────────────────────
    let diffH = poi.bearing - heading;
    while (diffH > 180) diffH -= 360;
    while (diffH < -180) diffH += 360;

    // POI hors du champ de vision horizontal → skip
    if (Math.abs(diffH) > FOV_H / 2) return;

    // ─── POSITION X (horizontale) ────────────────────────
    const x = W / 2 + (diffH / (FOV_H / 2)) * (W / 2);

    // ─── POSITION Y (verticale) — GROS CHANGEMENT ─────────
    // On simule une altitude au niveau du sol
    // Plus le POI est loin, plus il doit être haut sur l'écran (horizon)
    // + On compense avec le pitch du téléphone

    // Angle d'élévation apparent du POI (approximation simple)
    // POI proche = bas dans le champ de vision, POI loin = proche de l'horizon
    const poiElevationAngle = Math.atan2(-2, poi.dist) * 180 / Math.PI;
    // -2 = hauteur approx du POI sous les yeux (2m en dessous du regard)

    // Position Y : combinaison de l'élévation du POI et du pitch du téléphone
    const verticalAngleFromCenter = poiElevationAngle + pitch;

    // Conversion angle → pixels
    const y = H / 2 - (verticalAngleFromCenter / (FOV_V / 2)) * (H / 2);

    // POI hors du champ vertical → skip
    if (y < -50 || y > H + 50) return;

    // ─── TAILLE & OPACITÉ selon distance ──────────────────
    const distRatio = Math.min(poi.dist / 1000, 1);
    const scale = Math.max(0.5, 1.3 - distRatio * 0.7);
    const opacity = Math.max(0.5, 1.0 - distRatio * 0.4);

    const col = CATS[poi.cat]?.color || '#333';
    const distTxt = poi.dist < 1000
      ? Math.round(poi.dist) + 'm'
      : (poi.dist / 1000).toFixed(1) + 'km';

    // ─── CRÉATION ÉLÉMENT DOM ─────────────────────────────
    const el = document.createElement('div');
    el.className = 'arc';
    el.style.cssText = `
      position:absolute;
      left:${x.toFixed(1)}px;
      top:${y.toFixed(1)}px;
      transform:translate(-50%, -50%) scale(${scale.toFixed(3)});
      transform-origin:center center;
      opacity:${opacity.toFixed(2)};
      --cc:${col};
      will-change:transform, left, top;
    `;

    el.innerHTML = `
      <div class="arc-bubble" style="--cc:${col}">
        <div class="arc-icon" style="background:${col};border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C8 2 4 5 4 9c0 5 8 13 8 13s8-8 8-13c0-4-4-7-8-7z"/>
          </svg>
        </div>
        <div class="arc-info">
          <div class="arc-name">${poi.name}</div>
          <div class="arc-dist">${distTxt}</div>
        </div>
      </div>
      <div class="arc-stem"></div>
      <div class="arc-dot" style="--cc:${col}"></div>
    `;

    el.onclick = () => {
      stopAR();
      setTimeout(() => openImmersive(poi.id), 300);
    };

    ov.appendChild(el);
  });

  arRAF = requestAnimationFrame(arLoop);
}

// ═══════════════════════════════════════════════════════════
// UTILS ANGLES
// ═══════════════════════════════════════════════════════════

function lerpAngle(cur, tgt, t) {
  let d = tgt - cur;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return (cur + d * t + 360) % 360;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

// ═══════════════════════════════════════════════════════════
// GHOST MODE
// ═══════════════════════════════════════════════════════════

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
    if (scratches) scratches.classList.add('on');
    ghostOv.classList.add('on');
    const flash = document.getElementById('ar-flash');
    flash.classList.remove('flash');
    void flash.offsetWidth;
    flash.classList.add('flash');
  } else {
    video.classList.remove('ghost-mode');
    grain.classList.remove('on');
    vignette.classList.remove('on');
    if (scratches) scratches.classList.remove('on');
    ghostOv.classList.remove('on');
  }
}

// ═══════════════════════════════════════════════════════════
// RADAR (inchangé - ça marchait bien)
// ═══════════════════════════════════════════════════════════

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

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, 'rgba(26,115,232,0.08)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

  [0.33, 0.66, 1].forEach((f, i) => {
    ctx.beginPath(); ctx.arc(cx, cy, r * f, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(26,115,232,${0.15 - i * 0.03})`; ctx.lineWidth = 1; ctx.stroke();
    const labels = ['200m', '500m', '1km'];
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '10px Manrope'; ctx.textAlign = 'center';
    ctx.fillText(labels[i], cx, cy - r * f + 14);
  });

  [['N', 0], ['E', 90], ['S', 180], ['O', 270]].forEach(([l, a]) => {
    const rad = a * Math.PI / 180;
    ctx.fillStyle = a === 0 ? '#e74c3c' : 'rgba(255,255,255,0.5)';
    ctx.font = 'bold 11px Manrope'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(l, cx + Math.sin(rad) * (r + 2), cy - Math.cos(rad) * (r + 2));
  });

  const sweep = (Date.now() / 3000) % 1 * Math.PI * 2;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(sweep);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + 0.8, false);
  ctx.fillStyle = 'rgba(26,115,232,0.15)'; ctx.fill();
  ctx.restore();

  ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#0f1923'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill();

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
  document.getElementById('radar-info-icon').innerHTML = `
    <div style="width:40px;height:40px;border-radius:50%;background:${col};display:flex;align-items:center;justify-content:center;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 2C8 2 4 5 4 9c0 5 8 13 8 13s8-8 8-13c0-4-4-7-8-7z"/></svg>
    </div>`;
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

// ═══════════════════════════════════════════════════════════
// LIGHTBOX HISTORIQUE
// ═══════════════════════════════════════════════════════════

function openHistLightbox(src, caption) {
  document.getElementById('hist-lightbox-img').src = src;
  document.getElementById('hist-lightbox-caption').textContent = caption;
  document.getElementById('hist-lightbox').classList.add('on');
}

function closeHistLightbox() {
  document.getElementById('hist-lightbox').classList.remove('on');
}
