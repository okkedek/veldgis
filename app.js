/* Veldapp: prototype. Kaart in RD (EPSG:28992), data live van PDOK / AHN / Topotijdreis. */

// ---------- Projectie & tegelroosters ----------
proj4.defs('EPSG:28992',
  '+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 ' +
  '+ellps=bessel +towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs');
ol.proj.proj4.register(proj4);
const RD = ol.proj.get('EPSG:28992');
const RD_EXTENT = [-285401.92, 22598.08, 595401.92, 903401.92];
RD.setExtent(RD_EXTENT);

const PDOK_RES = Array.from({ length: 16 }, (_, i) => 3440.64 / 2 ** i);
const pdokGrid = new ol.tilegrid.TileGrid({ origin: [RD_EXTENT[0], RD_EXTENT[3]], resolutions: PDOK_RES, extent: RD_EXTENT });

// Topotijdreis gebruikt een eigen RD-rooster (ArcGIS)
const TIJDREIS_RES = [3251.206502413005, 1625.6032512065026, 812.8016256032513, 406.40081280162565,
  203.20040640081282, 101.60020320040641, 50.800101600203206, 25.400050800101603,
  12.700025400050801, 6.350012700025401, 3.1750063500127004, 1.5875031750063502];
const tijdreisGrid = new ol.tilegrid.TileGrid({ origin: [-30515500, 31112399.999999993], resolutions: TIJDREIS_RES });

// ---------- Bronnen ----------
const PDOK = 'https://service.pdok.nl';
const WMS = {
  bodem: { url: `${PDOK}/bzk/bro-bodemkaart/wms/v1_0`, layer: 'soilarea' },
  geo: { url: `${PDOK}/bzk/bro-geomorfologischekaart/wms/v2_0`, layer: 'geomorphological_area' },
  ahn: { url: `${PDOK}/rws/ahn/wms/v1_0`, layer: 'dtm_05m' },
};
const AHN_WCS = `${PDOK}/rws/ahn/wcs/v1_0`;

const wmts = (url, attributions) => new ol.layer.Tile({
  visible: false,
  source: new ol.source.XYZ({ url, projection: RD, tileGrid: pdokGrid, crossOrigin: 'anonymous', attributions }),
});
const wms = ({ url, layer }, attributions, opacity = 1) => new ol.layer.Tile({
  visible: false, opacity,
  source: new ol.source.TileWMS({
    url, projection: RD, tileGrid: pdokGrid, crossOrigin: 'anonymous', attributions,
    params: { LAYERS: layer, FORMAT: 'image/png', TRANSPARENT: true, VERSION: '1.3.0' },
  }),
});

const L = {
  topo: wmts(`${PDOK}/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:28992/{z}/{x}/{y}.png`, '© Kadaster / PDOK'),
  grijs: wmts(`${PDOK}/brt/achtergrondkaart/wmts/v2_0/grijs/EPSG:28992/{z}/{x}/{y}.png`, '© Kadaster / PDOK'),
  foto: wmts(`${PDOK}/hwh/luchtfotorgb/wmts/v1_0/Actueel_orthoHR/EPSG:28992/{z}/{x}/{y}.jpeg`, 'Luchtfoto © Beeldmateriaal NL'),
  bodem: wms(WMS.bodem, 'Bodemkaart © BRO / WUR', 0.85),
  geo: wms(WMS.geo, 'Geomorfologische kaart © BRO / WUR', 0.85),
  tijd: new ol.layer.Tile({
    visible: false,
    source: new ol.source.XYZ({ projection: RD, tileGrid: tijdreisGrid, crossOrigin: 'anonymous', attributions: 'Topotijdreis © Kadaster' }),
  }),
};

// Hoofdlaag -> welke kaartlagen zichtbaar zijn (onder naar boven)
const STACKS = {
  topo: ['topo'],
  foto: ['foto'],
  bodem: ['grijs', 'bodem'],
  geo: ['grijs', 'geo'],
  natuur: ['grijs', 'plantDichtheid', 'planten'],
  tijd: ['tijd'],
};

// ---------- Reliëf: hillshade berekend uit AHN-hoogtes (WCS) ----------
const TILE = 256;
const EXAGGERATION = 4;   // Nederland is vlak: reliëf overdrijven
const GAIN = 1.6;         // contrast rond neutraal grijs
const SUN_AZ = 315 * Math.PI / 180, SUN_ALT = 45 * Math.PI / 180;
const LX = Math.cos(SUN_ALT) * Math.sin(SUN_AZ), LY = Math.cos(SUN_ALT) * Math.cos(SUN_AZ), LZ = Math.sin(SUN_ALT);

const reliefGrid = new ol.tilegrid.TileGrid({ origin: [RD_EXTENT[0], RD_EXTENT[3]], resolutions: PDOK_RES.slice(0, 14), extent: RD_EXTENT });

function reliefUrl(tileCoord) {
  const [x0, y0, x1, y1] = reliefGrid.getTileCoordExtent(tileCoord);
  const px = (x1 - x0) / TILE; // één pixel rand rondom voor naadloze tegels
  return `${AHN_WCS}?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID=dtm_05m&FORMAT=image/tiff` +
    `&SUBSET=x(${x0 - px},${x1 + px})&SUBSET=y(${y0 - px},${y1 + px})&SCALESIZE=x(${TILE + 2}),y(${TILE + 2})` +
    `#${px}`;
}

const isNoData = (v) => !(v > -50 && v < 400);

function hillshade(z, cell) {
  const n = TILE + 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TILE;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(TILE, TILE);
  const k = EXAGGERATION / (8 * cell);
  for (let r = 0; r < TILE; r++) {
    for (let c = 0; c < TILE; c++) {
      const i = (r + 1) * n + (c + 1);
      const z0 = z[i];
      let v = 128;
      if (!isNoData(z0)) {
        const g = (j) => (isNoData(z[j]) ? z0 : z[j]);
        const a = g(i - n - 1), b = g(i - n), cc = g(i - n + 1);
        const d = g(i - 1), f = g(i + 1);
        const gg = g(i + n - 1), h = g(i + n), ii = g(i + n + 1);
        const p = ((cc + 2 * f + ii) - (a + 2 * d + gg)) * k;  // dz/dx (oost)
        const q = ((a + 2 * b + cc) - (gg + 2 * h + ii)) * k;  // dz/dy (noord)
        const shade = (-p * LX - q * LY + LZ) / Math.sqrt(p * p + q * q + 1);
        v = Math.max(0, Math.min(255, 128 + (shade - LZ) * GAIN * 255));
      }
      const o = (r * TILE + c) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

L.relief = new ol.layer.Tile({
  className: 'relief-layer',
  maxResolution: 14,  // pas vanaf ~3 km tegelbreedte, anders te zware WCS-verzoeken
  source: new ol.source.TileImage({
    projection: RD,
    tileGrid: reliefGrid,
    attributions: 'Reliëf uit AHN © Rijkswaterstaat',
    tileUrlFunction: reliefUrl,
    tileLoadFunction: async (tile, src) => {
      const [url, px] = src.split('#');
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(res.status);
        const tiff = await GeoTIFF.fromArrayBuffer(await res.arrayBuffer());
        const [band] = await (await tiff.getImage()).readRasters();
        tile.getImage().src = hillshade(band, Number(px)).toDataURL();
      } catch (e) {
        tile.setState(ol.TileState.ERROR);
      }
    },
  }),
});

// ---------- Natuur: plantwaarnemingen uit GBIF (o.a. iNaturalist, Waarneming.nl) ----------
const GBIF = 'https://api.gbif.org';
const PLANT_YEARS = '2000,2026';
const PLANT_DETAIL_RES = 4;   // ingezoomder dan dit: losse waarnemingen met namen
const PLANT_LABEL_RES = 1.5;  // nog verder ingezoomd: namen bij de stippen

// Uitgezoomd: dichtheid van waarnemingen (GBIF-tegels in Web Mercator, OpenLayers herprojecteert naar RD)
L.plantDichtheid = new ol.layer.Tile({
  visible: false, minResolution: PLANT_DETAIL_RES,
  source: new ol.source.XYZ({
    url: `${GBIF}/v2/map/occurrence/density/{z}/{x}/{y}@1x.png?srs=EPSG:3857&taxonKey=6&country=NL&year=${PLANT_YEARS}&bin=hex&hexPerTile=40&style=green.poly`,
    crossOrigin: 'anonymous', attributions: 'Plantwaarnemingen © GBIF.org', maxZoom: 16,
  }),
});

// Nederlandse naam per soort, één keer opgehaald
const nameCache = new Map();
function dutchName(key) {
  if (!nameCache.has(key)) {
    nameCache.set(key, fetch(`${GBIF}/v1/species/${key}/vernacularNames?limit=300`)
      .then((r) => r.json())
      .then((j) => {
        const nl = (j.results || []).filter((x) => x.language === 'nld');
        // Nederlands Soortenregister gaat voor, dan de rest
        const n = (nl.find((x) => /Soortenregister/.test(x.source)) || nl[0])?.vernacularName;
        return n ? n[0].toUpperCase() + n.slice(1) : null;
      })
      .catch(() => null));
  }
  return nameCache.get(key);
}

const plantSource = new ol.source.Vector({ attributions: 'Plantwaarnemingen © GBIF.org' });
const plantDot = new ol.style.Circle({ radius: 7, fill: new ol.style.Fill({ color: '#2e8b2e' }), stroke: new ol.style.Stroke({ color: '#fff', width: 2.5 }) });
const plantText = { font: '700 15px system-ui, sans-serif', fill: new ol.style.Fill({ color: '#0d2b0d' }), stroke: new ol.style.Stroke({ color: '#fff', width: 4 }), offsetY: -17 };
L.planten = new ol.layer.Vector({
  visible: false, maxResolution: PLANT_DETAIL_RES, source: plantSource, declutter: true,
  style: (f, res) => new ol.style.Style({
    image: plantDot,
    text: res <= PLANT_LABEL_RES ? new ol.style.Text({ ...plantText, text: f.get('naam') }) : undefined,
  }),
});

const rdToWkt = (ext) => {
  const [a, b, c, d] = ol.proj.transformExtent(ext, RD, 'EPSG:4326').map((v) => v.toFixed(5));
  return `POLYGON((${a} ${b},${c} ${b},${c} ${d},${a} ${d},${a} ${b}))`; // tegen de klok in, zoals GBIF wil
};
async function plantRecords(ext, max, signal) {
  const out = [];
  for (let offset = 0; offset < max; offset += 300) {
    const q = new URLSearchParams({ geometry: rdToWkt(ext), kingdomKey: 6, year: PLANT_YEARS, hasGeospatialIssue: false, limit: 300, offset });
    const j = await (await fetch(`${GBIF}/v1/occurrence/search?${q}`, { signal })).json();
    out.push(...j.results.filter((r) => r.speciesKey && r.decimalLongitude));
    if (j.endOfRecords) break;
  }
  return out;
}

let plantAbort;
async function loadPlants() {
  if (!L.planten.getVisible() || view.getResolution() > PLANT_DETAIL_RES) return;
  plantAbort?.abort();
  plantAbort = new AbortController();
  let records;
  try { records = await plantRecords(view.calculateExtent(map.getSize()), 900, plantAbort.signal); } catch { return; }
  const added = [];
  for (const r of records) {
    if (plantSource.getFeatureById(r.key)) continue;
    const f = new ol.Feature({ geometry: new ol.geom.Point(ol.proj.fromLonLat([r.decimalLongitude, r.decimalLatitude], RD)), key: r.speciesKey, naam: r.species });
    f.setId(r.key);
    added.push(f);
  }
  plantSource.addFeatures(added);
  for (const f of added) dutchName(f.get('key')).then((n) => { if (n) f.set('naam', n); });
}

// ---------- Positie ----------
const posSource = new ol.source.Vector();
const posAccuracy = new ol.Feature();
const posPoint = new ol.Feature();
posAccuracy.setStyle(new ol.style.Style({
  fill: new ol.style.Fill({ color: 'rgba(10,91,214,0.12)' }),
  stroke: new ol.style.Stroke({ color: 'rgba(10,91,214,0.6)', width: 2 }),
}));
posPoint.setStyle(new ol.style.Style({
  image: new ol.style.Circle({ radius: 11, fill: new ol.style.Fill({ color: '#0a5bd6' }), stroke: new ol.style.Stroke({ color: '#fff', width: 4 }) }),
}));
posSource.addFeatures([posAccuracy, posPoint]);
const posLayer = new ol.layer.Vector({ source: posSource, zIndex: 100 });

// ---------- Kaart ----------
const map = new ol.Map({
  target: 'map',
  layers: [L.topo, L.grijs, L.foto, L.bodem, L.geo, L.tijd, L.plantDichtheid, L.relief, L.planten, posLayer],
  controls: [new ol.control.Attribution({ collapsible: true })],
  view: new ol.View({ projection: RD, center: [155000, 463000], resolution: 215, maxResolution: 860, minResolution: 0.1, constrainResolution: false }),
});
const view = map.getView();
let plantTimer;
map.on('moveend', () => { clearTimeout(plantTimer); plantTimer = setTimeout(loadPlants, 500); });

// ---------- Instellingen onthouden ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('veldapp.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('veldapp.' + k, JSON.stringify(v)); } catch { /* geen opslag */ } },
};

// ---------- Hoofdlaag kiezen ----------
const layerButtons = document.querySelectorAll('#layers button');
function setMainLayer(key) {
  for (const name of ['topo', 'grijs', 'foto', 'bodem', 'geo', 'tijd', 'plantDichtheid', 'planten']) L[name].setVisible(STACKS[key].includes(name));
  loadPlants();
  layerButtons.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.layer === key)));
  document.getElementById('year-row').hidden = key !== 'tijd';
  store.set('layer', key);
}
layerButtons.forEach((b) => b.addEventListener('click', () => setMainLayer(b.dataset.layer)));

// ---------- Reliëfslider ----------
const reliefInput = document.getElementById('relief');
const reliefValue = document.getElementById('relief-value');
function setRelief(pct) {
  reliefInput.value = pct;
  reliefValue.textContent = `${pct}%`;
  L.relief.setOpacity(pct / 100);
  L.relief.setVisible(pct > 0);
  store.set('relief', Number(pct));
}
reliefInput.addEventListener('input', () => setRelief(reliefInput.value));

// ---------- Jaarslider (Topotijdreis) ----------
const yearInput = document.getElementById('year');
const yearLabel = document.getElementById('year-label');
let yearTimer;
function applyYear(y) {
  L.tijd.getSource().setUrl(
    `https://tiles.arcgis.com/tiles/nSZVuSZjHpEZZbRo/arcgis/rest/services/Historische_tijdreis_${y}/MapServer/tile/{z}/{y}/{x}`);
  store.set('year', Number(y));
}
yearInput.addEventListener('input', () => {
  yearLabel.textContent = yearInput.value;
  clearTimeout(yearTimer);
  yearTimer = setTimeout(() => applyYear(yearInput.value), 300);  // pas laden als je even stilstaat
});

// ---------- GPS volgen / zelf kiezen ----------
const followBtn = document.getElementById('btn-follow');
let follow = true;
let myPos = null;      // [x, y] in RD
let firstFix = true;

function setFollow(on) {
  follow = on;
  followBtn.setAttribute('aria-pressed', String(on));
  if (on && myPos) view.animate({ center: myPos, duration: 400 });
}
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const formatDist = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toLocaleString('nl-NL', { maximumFractionDigits: 1 })} km`);

followBtn.addEventListener('click', () => setFollow(true));
map.on('pointerdrag', () => { if (follow) setFollow(false); });

if ('geolocation' in navigator) {
  navigator.geolocation.watchPosition((p) => {
    myPos = ol.proj.fromLonLat([p.coords.longitude, p.coords.latitude], RD);
    posPoint.setGeometry(new ol.geom.Point(myPos));
    posAccuracy.setGeometry(new ol.geom.Circle(myPos, p.coords.accuracy));
    if (follow) {
      if (firstFix) view.setResolution(3.36);
      view.setCenter(myPos);
    }
    firstFix = false;
  }, () => setFollow(false), { enableHighAccuracy: true, maximumAge: 5000 });
} else {
  setFollow(false);
}

// ---------- Schermvullende kaart <-> kaartkeuze ----------
const appEl = document.getElementById('app');
const fullBtn = document.getElementById('btn-full');
function setFull(on) {
  appEl.classList.toggle('full', on);
  fullBtn.setAttribute('aria-pressed', String(on));
  fullBtn.setAttribute('aria-label', on ? 'Kaarten kiezen' : 'Kaart schermvullend');
  // Ook de browserbalken weg waar dat kan (Android); iOS negeert dit
  try {
    if (on && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    if (!on && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  } catch { /* niet ondersteund */ }
}
fullBtn.addEventListener('click', () => setFull(!appEl.classList.contains('full')));
// Terug-gebaar of Esc verlaat volledig scherm: dan ook de bediening terug
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && appEl.classList.contains('full')) setFull(false); });

// ---------- Scherm aan houden ----------
let wakeLock = null;
async function keepAwake() {
  try { if ('wakeLock' in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request('screen'); wakeLock?.addEventListener('release', () => { wakeLock = null; }); } catch { /* niet toegestaan */ }
}
document.addEventListener('click', keepAwake, { once: true });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });

// ---------- Wat is hier? ----------
const infoEl = document.getElementById('info');
const infoBody = document.getElementById('info-body');
const infoTitle = document.getElementById('info-title');

// Plantensoorten binnen een vierkant van 2 x 100 m rond het punt, meest waargenomen eerst
async function plantsNear([x, y], r = 100) {
  const records = await plantRecords([x - r, y - r, x + r, y + r], 300);
  const bySpecies = new Map();
  for (const rec of records) {
    const s = bySpecies.get(rec.speciesKey) || { key: rec.speciesKey, sci: rec.species, n: 0 };
    s.n++;
    bySpecies.set(rec.speciesKey, s);
  }
  const top = [...bySpecies.values()].sort((a, b) => b.n - a.n);
  await Promise.all(top.slice(0, 15).map(async (s) => { s.nl = await dutchName(s.key); }));
  return top;
}

async function featureInfo({ url, layer }, [x, y]) {
  const q = new URLSearchParams({
    SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetFeatureInfo', CRS: 'EPSG:28992',
    BBOX: `${x - 5},${y - 5},${x + 5},${y + 5}`, WIDTH: 11, HEIGHT: 11, I: 5, J: 5,
    LAYERS: layer, QUERY_LAYERS: layer, STYLES: '', INFO_FORMAT: 'application/json',
  });
  const res = await fetch(`${url}?${q}`);
  const json = await res.json();
  return json.features?.[0]?.properties ?? null;
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const card = (k, v, s = '') => `<div class="card"><div class="k">${k}</div><div class="v">${v}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`;

let infoSeq = 0;
async function showInfo() {
  const seq = ++infoSeq;
  const pt = view.getCenter();
  infoEl.hidden = false;
  infoTitle.textContent = follow && myPos ? 'Hier sta je' : 'Op het vizier';
  if (!infoBody.innerHTML) infoBody.innerHTML = '<p class="loading">Ophalen…</p>';

  const [bodem, geo, ahn, planten] = await Promise.allSettled([
    featureInfo(WMS.bodem, pt), featureInfo(WMS.geo, pt), featureInfo(WMS.ahn, pt), plantsNear(pt),
  ]);
  if (seq !== infoSeq) return; // er is inmiddels een nieuwere vraag

  let html = '';
  if (bodem.status === 'rejected') html += card('Bodem', 'Niet bereikbaar');
  else if (!bodem.value) html += card('Bodem', 'Niet gekarteerd', 'Vaak bebouwing, water of vergraven grond.');
  else html += card('Bodem', esc(bodem.value.first_soilname || bodem.value.normal_soilprofile_name), `Code ${esc(bodem.value.soilcode)}`);

  if (geo.status === 'rejected') html += card('Landvorm', 'Niet bereikbaar');
  else if (!geo.value) html += card('Landvorm', 'Niet gekarteerd');
  else {
    const g = geo.value;
    const [genese, ...uitleg] = (g.geneseDescription || '').split(':');
    const sub = [
      genese && `<b>${esc(genese)}</b>${uitleg.length ? ': ' + esc(uitleg.join(':').trim()) : ''}`,
      g.reliefKlasse && esc(g.reliefKlasse),
      g.landformSubgroupUrl && `<a href="${esc(g.landformSubgroupUrl)}" target="_blank" rel="noopener">Meer over ${esc(g.landformSubgroupCode)} ›</a>`,
    ].filter(Boolean).join('<br>');
    html += card('Landvorm', esc(g.landformSubgroupDescription), sub);
  }

  if (planten.status === 'rejected') html += card('Planten in de buurt', 'Niet bereikbaar');
  else if (!planten.value.length) html += card('Planten in de buurt', 'Geen waarnemingen', 'Binnen 100 m sinds 2000. Dat zegt vooral iets over waarnemers, niet over de plek.');
  else {
    const list = planten.value.slice(0, 15).map((s) => s.nl
      ? `<b>${esc(s.nl)}</b> <i>${esc(s.sci)}</i>${s.n > 1 ? ` (${s.n}×)` : ''}`
      : `<b><i>${esc(s.sci)}</i></b>${s.n > 1 ? ` (${s.n}×)` : ''}`).join('<br>');
    const more = planten.value.length > 15 ? `<br>… en ${planten.value.length - 15} andere soorten` : '';
    html += card('Planten in de buurt', `${planten.value.length} ${planten.value.length === 1 ? 'soort' : 'soorten'} waargenomen`,
      `${list}${more}<br><small>Binnen 100 m, sinds 2000 · bron GBIF</small>`);
  }

  const h = ahn.status === 'fulfilled' && ahn.value ? parseFloat(ahn.value.value_list) : NaN;
  html += card('Hoogte', Number.isFinite(h) && h < 1000
    ? `${h.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m +NAP`
    : 'Geen hoogte (water of gebouw)');

  const [lon, lat] = ol.proj.toLonLat(pt, RD);
  const where = myPos && !(follow) ? ` · ${formatDist(distance(myPos, pt))} van jou` : '';
  html += card('Plek', `RD ${Math.round(pt[0])}, ${Math.round(pt[1])}`, `${lat.toFixed(5)}° N, ${lon.toFixed(5)}° O${where}`);
  infoBody.innerHTML = html;
}

let infoTimer;
document.getElementById('btn-info').addEventListener('click', showInfo);
document.getElementById('btn-close').addEventListener('click', () => { infoEl.hidden = true; infoBody.innerHTML = ''; });
map.on('moveend', () => {
  if (infoEl.hidden) return;
  clearTimeout(infoTimer);
  infoTimer = setTimeout(showInfo, 800);  // ververs tijdens lopen of verschuiven
});

// ---------- Start ----------
const startYear = store.get('year', 1900);
yearInput.value = startYear;
yearLabel.textContent = startYear;
applyYear(startYear);
setRelief(store.get('relief', 40));
const startLayer = store.get('layer', 'bodem');
setMainLayer(STACKS[startLayer] ? startLayer : 'bodem');
