// ═══════════════════════════════════════════════════════════
// CORE/UI.JS — Logique carte, popups, immersif, navigation
// ═══════════════════════════════════════════════════════════

let map, userMarker, routeLayer, routeActive = false;
let userLat = CONFIG.lat, userLng = CONFIG.lng;
let currentSection = 'tourisme';
let navRouteLayer = null, navUserMarker = null;
let navActive = false, navDestLat = null, navDestLng = null;
let selectedRadarPlace = null;
let immTypewriterTimer = null;
let gpsWatchId = null;

// ─── INIT CARTE ───────────────────────────────────────────────
function initMap() {
  document.title = CONFIG.titre;
  document.getElementById('ar-epoch-banner').textContent = CONFIG.epochBanner;

  map = L.map('map', {
    center: [CONFIG.lat, CONFIG.lng],
    zoom: CONFIG.zoom,
    zoomControl: true,
    attributionControl: false,
  });

  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
  }).addTo(map);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
    maxZoom: 19, opacity: 0.85,
  }).addTo(map);

  map.zoomControl.setPosition('bottomright');
  buildFilterBar();
  renderPlaces('tourisme');
  initEvenementsMarkers();

  map.on('click', () => closeCustomPopup());

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(p => {
      userLat = p.coords.latitude;
      userLng = p.coords.longitude;
      userMarker = L.marker([userLat, userLng], { icon: makeUserMarkerIcon() }).addTo(map);
    }, () => {});
  }

  window.leafletMap = map;
}

// ─── BARRE DE FILTRES ─────────────────────────────────────────
function buildFilterBar() {
  const bar = document.getElementById('filter-bar');
  bar.innerHTML = '';

  const cats = [...new Set(PLACES.map(p => p.cat))];
  const allBtn = document.createElement('button');
  allBtn.className = 'fp active';
  allBtn.style.setProperty('--cc', CONFIG.couleurPrimaire);
  allBtn.innerHTML = `<span class="fdot" style="background:${CONFIG.couleurPrimaire}"></span>Tout`;
  allBtn.onclick = () => { filterPlaces(null); setFilterActive(allBtn); };
  bar.appendChild(allBtn);

  cats.forEach(cat => {
    const c = CATS[cat];
    if (!c) return;
    const btn = document.createElement('button');
    btn.className = 'fp';
    btn.style.setProperty('--cc', c.color);
    btn.innerHTML = `<span class="fdot" style="background:${c.dot}"></span>${c.label}`;
    btn.onclick = () => { filterPlaces(cat); setFilterActive(btn); };
    bar.appendChild(btn);
  });
}

function setFilterActive(el) {
  document.querySelectorAll('.fp').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

// ─── MARKERS ─────────────────────────────────────────────────
let allMarkers = [];

function makePinSVG(color) {
  return `<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 9.33 14 26 14 26S28 23.33 28 14C28 6.27 21.73 0 14 0z" fill="${color}"/>
    <circle cx="14" cy="14" r="6" fill="white" opacity="0.9"/>
  </svg>`;
}

function renderPlaces(section) {
  allMarkers.forEach(m => map.removeLayer(m));
  allMarkers = [];
  const list = section === 'commerce' ? COMMERCES : PLACES;
  list.forEach(place => {
    const col = CATS[place.cat]?.color || CONFIG.couleurPrimaire;
    const icon = L.divIcon({ html: makePinSVG(col), className: '', iconSize: [28, 40], iconAnchor: [14, 40] });
    const m = L.marker([place.lat, place.lng], { icon });
    m._poi = place;
    m.on('click', () => openCustomPopup(buildPopupHTML(place)));
    m.addTo(map);
    allMarkers.push(m);
  });
}

function filterPlaces(cat) {
  allMarkers.forEach(m => map.removeLayer(m));
  allMarkers = [];
  const list = currentSection === 'commerce' ? COMMERCES : PLACES;
  const filtered = cat ? list.filter(p => p.cat === cat) : list;
  filtered.forEach(place => {
    const col = CATS[place.cat]?.color || CONFIG.couleurPrimaire;
    const icon = L.divIcon({ html: makePinSVG(col), className: '', iconSize: [28, 40], iconAnchor: [14, 40] });
    const m = L.marker([place.lat, place.lng], { icon });
    m._poi = place;
    m.on('click', () => openCustomPopup(buildPopupHTML(place)));
    m.addTo(map);
    allMarkers.push(m);
  });
}

// ─── POPUP RAPIDE ─────────────────────────────────────────────
function buildPopupHTML(place) {
  const col = CATS[place.cat]?.color || '#333';
  const label = CATS[place.cat]?.label || '';
  const dist = calcDist(userLat, userLng, place.lat, place.lng);
  const dTxt = dist < 1000 ? Math.round(dist) + 'm' : (dist / 1000).toFixed(1) + 'km';

  if (PLACES.find(p => p.id === place.id)) {
    return `<div class="pw">
      <div class="pw-img-wrap">
        ${place.bg ? `<img class="pw-img" src="${place.bg}" alt="${place.name}"/>` :
          `<div class="pw-img" style="background:linear-gradient(135deg,${col}22,${col}55);display:flex;align-items:center;justify-content:center;"></div>`}
        <span class="pw-badge" style="background:${col}">${label}</span>
        <button class="pw-x" onclick="closeCustomPopup()">✕</button>
      </div>
      <div class="pw-body">
        <div class="pw-name">${place.name}</div>
        <div class="pw-desc">${place.desc}</div>
        <div class="pw-footer">
          <div class="pw-era">${place.era || ''} · ${dTxt}</div>
          <button class="pw-cta" onclick="closeCustomPopup();openImmersive(${place.id})">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8 2 4 5 4 9c0 5 8 13 8 13s8-8 8-13c0-4-4-7-8-7z"/></svg>
            Découvrir
          </button>
          <button class="pw-nav" onclick="startRoute(${place.lat},${place.lng});closeCustomPopup()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M21 3L3 10.53v.98l6.84 2.65L12.48 21h.98L21 3z"/></svg>
            Y aller
          </button>
        </div>
      </div>
    </div>`;
  }

  return `<div class="pw">
    <div class="pw-img-wrap" style="height:80px;background:linear-gradient(135deg,${col}22,${col}44);display:flex;align-items:center;justify-content:center;">
      <button class="pw-x" onclick="closeCustomPopup()">✕</button>
    </div>
    <div class="pw-body">
      <div class="pw-name">${place.name}</div>
      <div class="pw-desc">${place.desc}</div>
      ${place.horaires ? `<div style="font-family:'Manrope';font-size:11px;color:#888;margin-bottom:10px">${place.horaires}</div>` : ''}
      <div class="pw-footer">
        <div class="pw-era" style="color:${col}">${label} · ${dTxt}</div>
        <button class="pw-nav" onclick="startRoute(${place.lat},${place.lng});closeCustomPopup()">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M21 3L3 10.53v.98l6.84 2.65L12.48 21h.98L21 3z"/></svg>
          Y aller
        </button>
      </div>
    </div>
  </div>`;
}

function openCustomPopup(html) {
  const card = document.getElementById('popup-card');
  const container = document.getElementById('popup-container');
  card.innerHTML = html;
  container.classList.add('active');
  document.getElementById('map').classList.add('map-blur');
  document.getElementById('filter-bar').style.filter = 'blur(3px)';
  const locateBtn = document.getElementById('locate-btn');
  if (locateBtn) locateBtn.style.filter = 'blur(3px)';
  const bottomnav = document.getElementById('bottomnav');
  if (bottomnav) bottomnav.style.filter = 'blur(3px)';
  setTimeout(() => card.classList.add('visible'), 10);
}

function closeCustomPopup() {
  const card = document.getElementById('popup-card');
  const container = document.getElementById('popup-container');
  card.classList.remove('visible');
  document.getElementById('map').classList.remove('map-blur');
  document.getElementById('filter-bar').style.filter = '';
  const locateBtn = document.getElementById('locate-btn');
  if (locateBtn) locateBtn.style.filter = '';
  const bottomnav = document.getElementById('bottomnav');
  if (bottomnav) bottomnav.style.filter = '';
  setTimeout(() => { container.classList.remove('active'); card.innerHTML = ''; }, 280);
}

// ─── SECTIONS ─────────────────────────────────────────────────
function switchSection(section) {
  currentSection = section;
  document.querySelectorAll('.n-btn').forEach(b => b.classList.remove('active'));

  if (section === 'tourisme') {
    document.getElementById('nav-tourisme')?.classList.add('active');
    renderPlaces('tourisme');
    buildFilterBar();
  } else if (section === 'commerce') {
    document.getElementById('nav-commerce')?.classList.add('active');
    renderPlaces('commerce');
    document.getElementById('filter-bar').innerHTML = '';
  } else if (section === 'evenements') {
    document.getElementById('nav-evenements')?.classList.add('active');
    allMarkers.forEach(m => map.removeLayer(m));
    allMarkers = [];
    renderEvenements();
    document.getElementById('filter-bar').innerHTML = '';
  }
  closeCustomPopup();
}

// ─── ÉVÉNEMENTS ───────────────────────────────────────────────
function renderEvenements() {
  EVENEMENTS.forEach(ev => {
    const col = CATS[ev.cat]?.color || '#333';
    const icon = L.divIcon({ html: makePinSVG(col), className: '', iconSize: [28, 40], iconAnchor: [14, 40] });
    const m = L.marker([ev.lat, ev.lng], { icon });
    m.on('click', () => {
      openCustomPopup(`<div class="pw">
        <div class="pw-img-wrap" style="height:90px;background:linear-gradient(135deg,${col}22,${col}44);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px">
          <span style="font-family:'Manrope';font-size:11px;color:${col};font-weight:700">${ev.date || ''}</span>
          <button class="pw-x" onclick="closeCustomPopup()">✕</button>
        </div>
        <div class="pw-body">
          <div class="pw-name">${ev.name}</div>
          <div class="pw-desc">${ev.desc}</div>
        </div>
      </div>`);
    });
    m.addTo(map);
    allMarkers.push(m);
  });
}

function initEvenementsMarkers() {}

// ─── EXPÉRIENCE IMMERSIVE ─────────────────────────────────────
function openImmersive(placeId) {
  const place = PLACES.find(p => p.id === placeId);
  if (!place) return;

  const theme = CAT_THEMES[place.cat] || CAT_THEMES.monument;
  const dist = calcDist(userLat, userLng, place.lat, place.lng);
  const dTxt = dist < 1000 ? Math.round(dist) + 'm' : (dist / 1000).toFixed(1) + 'km';

  const ov = document.getElementById('imm-overlay');
  ov.style.setProperty('--acc', theme.accent);
  ov.style.setProperty('--acc-mid', theme.accentLight);
  ov.classList.add('open');
  ov.classList.remove('ready', 'bars-open');

  const bg = document.getElementById('imm-bg');
  if (place.bg) {
    bg.style.backgroundImage = `url(${place.bg})`;
  } else {
    bg.style.background = `linear-gradient(135deg, #0a0a0a 0%, ${theme.accent}33 100%)`;
  }

  document.getElementById('imm-tint').style.background = theme.tint;
  document.getElementById('imm-era-badge').textContent = (place.era || '').toUpperCase();
  document.getElementById('imm-title').textContent = place.name;
  document.getElementById('imm-subtitle').textContent = CONFIG.ville.toUpperCase();
  document.getElementById('imm-stat-age').textContent = place.siecle ? place.siecle + 's' : '—';
  document.getElementById('imm-stat-cat').textContent = CATS[place.cat]?.label || '—';
  document.getElementById('imm-stat-dist').textContent = dTxt;

  document.getElementById('imm-navigate-btn').onclick = () => {
    closeImmersive();
    startRoute(place.lat, place.lng);
  };

  const narEl = document.getElementById('imm-narration-text');
  const cursor = document.getElementById('imm-cursor');
  narEl.textContent = '';
  cursor.classList.remove('done');
  const txt = place.anecdote || place.desc || '';

  requestAnimationFrame(() => {
    bg.classList.add('ready');
    document.getElementById('imm-tint').classList.add('ready');
    setTimeout(() => {
      ov.classList.add('ready');
      ov.classList.remove('bars-open');
      spawnParticles(theme.particles);
      typewrite(narEl, txt, cursor);
    }, 400);
  });

  buildImmDetail(place, theme);

  let startY = 0;
  ov.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
  ov.addEventListener('touchend', e => {
    const dy = startY - e.changedTouches[0].clientY;
    if (dy > 60) document.getElementById('imm-detail').classList.add('open');
    if (dy < -60) document.getElementById('imm-detail').classList.remove('open');
  }, { passive: true });

  document.getElementById('imm-scroll').onclick = () => {
    document.getElementById('imm-detail').classList.toggle('open');
  };
}

function buildImmDetail(place, theme) {
  const inner = document.getElementById('imm-detail-inner');
  inner.innerHTML = '';
  if (place.histoire) {
    const sec = document.createElement('div');
    sec.className = 'imm-detail-section';
    sec.innerHTML = `<h4>Histoire</h4><p>${place.histoire}</p>`;
    inner.appendChild(sec);
  }
  if (place.timeline?.length) {
    const sec = document.createElement('div');
    sec.className = 'imm-detail-section';
    const tlHTML = place.timeline.map(t =>
      `<div class="imm-tl-item">
        <div class="imm-tl-dot"></div>
        <div class="imm-tl-year">${t.year}</div>
        <div class="imm-tl-text">${t.text}</div>
      </div>`
    ).join('');
    sec.innerHTML = `<h4>Chronologie</h4><div class="imm-timeline">${tlHTML}</div>`;
    inner.appendChild(sec);
  }
  if (place.anecdote) {
    const sec = document.createElement('div');
    sec.className = 'imm-detail-section';
    sec.innerHTML = `<h4>L'anecdote</h4><p>${place.anecdote}</p>`;
    inner.appendChild(sec);
  }
}

function closeImmersive() {
  clearTimeout(immTypewriterTimer);
  const ov = document.getElementById('imm-overlay');
  ov.classList.remove('ready', 'open');
  ov.classList.add('bars-open');
  document.getElementById('imm-detail').classList.remove('open');
  document.getElementById('imm-bg').classList.remove('ready');
  document.getElementById('imm-tint').classList.remove('ready');
  document.getElementById('imm-particles').innerHTML = '';
}

// ─── MACHINE À ÉCRIRE ─────────────────────────────────────────
function typewrite(el, text, cursor, i = 0) {
  if (i >= text.length) { cursor.classList.add('done'); return; }
  el.textContent += text[i];
  immTypewriterTimer = setTimeout(() => typewrite(el, text, cursor, i + 1), 22);
}

// ─── PARTICULES ───────────────────────────────────────────────
function spawnParticles(color) {
  const container = document.getElementById('imm-particles');
  container.innerHTML = '';
  for (let i = 0; i < 12; i++) {
    const p = document.createElement('div');
    p.className = 'imm-particle';
    p.style.cssText = `left:${Math.random()*100}%;bottom:${Math.random()*20}%;width:${3+Math.random()*4}px;height:${3+Math.random()*4}px;background:${color};animation-duration:${4+Math.random()*6}s;animation-delay:${Math.random()*3}s;`;
    container.appendChild(p);
  }
}

// ─── ROUTE — VOITURE + PIÉTON ─────────────────────────────────
function startRoute(lat, lng) {
  if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
  map.eachLayer(l => { if (l._isRouteMarker) map.removeLayer(l); });
  document.getElementById('route-banner')?.remove();
  showToast('Calcul des itinéraires…');

  navigator.geolocation?.getCurrentPosition(
    pos => {
      userLat = pos.coords.latitude;
      userLng = pos.coords.longitude;
      _computeRoute(parseFloat(lat), parseFloat(lng));
    },
    () => _computeRoute(parseFloat(lat), parseFloat(lng)),
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

function _computeRoute(dLat, dLng) {
  // Fetch les deux modes en parallèle
  const footUrl = `https://router.project-osrm.org/route/v1/foot/${userLng},${userLat};${dLng},${dLat}?overview=full&geometries=geojson`;
  const carUrl  = `https://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${dLng},${dLat}?overview=full&geometries=geojson`;

  Promise.all([fetch(footUrl).then(r => r.json()), fetch(carUrl).then(r => r.json())])
    .then(([footData, carData]) => {
      const foot = footData.routes?.[0];
      const car  = carData.routes?.[0];
      if (!foot) { showToast('Itinéraire introuvable'); return; }

      // Affiche le tracé piéton par défaut
      const coords = foot.geometry.coordinates.map(c => [c[1], c[0]]);
      routeLayer = L.polyline(coords, {
        color: CONFIG.couleurPrimaire, weight: 5, opacity: 0.85,
        lineCap: 'round', lineJoin: 'round',
      }).addTo(map);

      // Marqueurs départ / arrivée
      [
        L.divIcon({ html: '<div style="width:14px;height:14px;border-radius:50%;background:#fff;border:3px solid #0f1923;box-shadow:0 2px 8px rgba(26,115,232,.5)"></div>', className: '', iconSize: [14,14], iconAnchor: [7,7] }),
        L.divIcon({ html: '<div style="width:16px;height:16px;border-radius:50%;background:#0f1923;border:3px solid #fff;box-shadow:0 2px 8px rgba(26,115,232,.6)"></div>', className: '', iconSize: [16,16], iconAnchor: [8,8] }),
      ].forEach((icon, i) => {
        const pos = i === 0 ? [userLat, userLng] : [dLat, dLng];
        const mk = L.marker(pos, { icon }).addTo(map);
        mk._isRouteMarker = true;
      });

      map.fitBounds(routeLayer.getBounds(), { padding: [60, 60] });
      routeActive = true;

      // Données formatées
      const footDist = foot.distance < 1000 ? Math.round(foot.distance) + 'm' : (foot.distance/1000).toFixed(1) + 'km';
      const footTime = Math.round(foot.duration / 60) + ' min';
      const carDist  = car ? (car.distance < 1000 ? Math.round(car.distance) + 'm' : (car.distance/1000).toFixed(1) + 'km') : '—';
      const carTime  = car ? Math.round(car.duration / 60) + ' min' : '—';

      // Banner avec les deux modes + bouton annuler
      const banner = document.createElement('div');
      banner.id = 'route-banner';
      banner.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:10px;flex:1;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:32px;height:32px;border-radius:50%;background:#f0f4ff;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#0f1923"><path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/></svg>
            </div>
            <div style="flex:1;">
              <div style="font-family:'Manrope';font-weight:800;font-size:13px;color:#0f1923;">À pied · ${footTime}</div>
              <div style="font-family:'Manrope';font-size:11px;color:#9aa0a6;">${footDist}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:32px;height:32px;border-radius:50%;background:#f0f4ff;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#0f1923"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>
            </div>
            <div style="flex:1;">
              <div style="font-family:'Manrope';font-weight:800;font-size:13px;color:#0f1923;">En voiture · ${carTime}</div>
              <div style="font-family:'Manrope';font-size:11px;color:#9aa0a6;">${carDist}</div>
            </div>
          </div>
        </div>
        <button onclick="cancelRoute()" style="
          background:#0f1923;border:none;border-radius:12px;
          color:#fff;font-family:'Manrope';font-weight:800;font-size:12px;
          cursor:pointer;padding:10px 16px;flex-shrink:0;
          display:flex;align-items:center;gap:6px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          Annuler
        </button>`;
      const container = document.querySelector('main') || document.body;
      container.appendChild(banner);
      showToast('Itinéraires calculés ✓');
    })
    .catch(() => showToast('Erreur réseau'));
}

function cancelRoute() {
  if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
  map.eachLayer(l => { if (l._isRouteMarker) map.removeLayer(l); });
  document.getElementById('route-banner')?.remove();
  routeActive = false;
  showToast('Itinéraire annulé');
}

// ─── NAVIGATION GPS ───────────────────────────────────────────
function startNavigation(place) {
  navDestLat = place.lat; navDestLng = place.lng;
  navActive = true;
  document.getElementById('nav-overlay').classList.add('on');
  document.getElementById('nav-dest-name').textContent = place.name;
  document.getElementById('nav-dest-cat').textContent = CATS[place.cat]?.label || '';
  switchSection('tourisme');
  startGPSWatch();
  _computeNavRoute(place);
}

function _computeNavRoute(place) {
  document.getElementById('nav-top-dist').textContent = 'Calcul en cours…';
  navigator.geolocation?.getCurrentPosition(pos => {
    userLat = pos.coords.latitude; userLng = pos.coords.longitude;
    fetch(`https://router.project-osrm.org/route/v1/foot/${userLng},${userLat};${place.lng},${place.lat}?overview=full&geometries=geojson`)
      .then(r => r.json())
      .then(data => {
        if (!data.routes?.length) { showToast('Itinéraire introuvable'); return; }
        const route = data.routes[0];
        const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
        document.getElementById('nav-top-time').textContent = Math.round(route.duration / 60) + ' min';
        document.getElementById('nav-top-dist').textContent = (route.distance < 1000 ? Math.round(route.distance) + 'm' : (route.distance/1000).toFixed(1) + 'km') + ' · piéton';
        if (navRouteLayer) map.removeLayer(navRouteLayer);
        navRouteLayer = L.polyline(coords, { color: CONFIG.couleurPrimaire, weight: 6, opacity: 0.9 }).addTo(map);
        map.fitBounds(navRouteLayer.getBounds(), { padding: [80, 80] });
      });
  }, () => {}, { enableHighAccuracy: true, timeout: 8000 });
}

function stopNavigation() {
  navActive = false;
  document.getElementById('nav-overlay').classList.remove('on');
  if (navRouteLayer) { map.removeLayer(navRouteLayer); navRouteLayer = null; }
  if (navUserMarker) { map.removeLayer(navUserMarker); navUserMarker = null; }
}

// ─── GPS WATCH ────────────────────────────────────────────────
function startGPSWatch() {
  if (gpsWatchId) return;
  gpsWatchId = navigator.geolocation?.watchPosition(pos => {
    userLat = pos.coords.latitude; userLng = pos.coords.longitude;
    if (navActive) updateNavigation();
  }, () => {}, { enableHighAccuracy: true, maximumAge: 0 });
}

function updateNavigation() {
  if (!navActive || !navDestLat) return;
  const dist = calcDist(userLat, userLng, navDestLat, navDestLng);
  document.getElementById('nav-top-dist').textContent = (dist < 1000 ? Math.round(dist) + 'm' : (dist/1000).toFixed(1) + 'km') + ' restants';
  if (dist < 30) { showToast('Vous êtes arrivé !'); stopNavigation(); }
}

// ─── GPS LOCATE ───────────────────────────────────────────────
function locateUser() {
  navigator.geolocation?.getCurrentPosition(pos => {
    userLat = pos.coords.latitude; userLng = pos.coords.longitude;
    map.setView([userLat, userLng], 16);
    if (userMarker) map.removeLayer(userMarker);
    userMarker = L.marker([userLat, userLng], { icon: makeUserMarkerIcon() }).addTo(map);
    showToast('Position trouvée');
  }, () => showToast('GPS refusé'));
}

function makeUserMarkerIcon() {
  return L.divIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center;">
      <div style="position:relative;display:flex;align-items:center;justify-content:center;width:44px;height:44px;">
        <div class="yah-ring"></div>
        <div class="yah-dot"></div>
      </div>
      <div class="yah-label">Vous</div>
    </div>`,
    className: '', iconSize: [80, 60], iconAnchor: [40, 22],
  });
}

// ─── TOAST ────────────────────────────────────────────────────
let _toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// ─── UTILITAIRES ──────────────────────────────────────────────
function calcDist(la1, lo1, la2, lo2) {
  const R = 6371000, r = Math.PI / 180;
  const dla = (la2 - la1) * r, dlo = (lo2 - lo1) * r;
  return R * 2 * Math.asin(Math.sqrt(Math.sin(dla/2)**2 + Math.cos(la1*r)*Math.cos(la2*r)*Math.sin(dlo/2)**2));
}

function getBearing(la1, lo1, la2, lo2) {
  const dlo = (lo2 - lo1) * Math.PI / 180;
  const y = Math.sin(dlo) * Math.cos(la2 * Math.PI / 180);
  const x = Math.cos(la1 * Math.PI / 180) * Math.sin(la2 * Math.PI / 180) - Math.sin(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.cos(dlo);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// ─── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initMap);
