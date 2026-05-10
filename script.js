// ===== PIN GATE =====
const PIN_CODE = '24021994';
let pinInput = '';
let pinVerified = false;

if (sessionStorage.getItem('pin_verified') === 'true') {
  pinVerified = true;
}

function pinPress(digit) {
  if (pinVerified) return;
  if (pinInput.length >= 8) return;
  pinInput += digit;
  updatePinDisplay();
}

function pinClear() {
  if (pinVerified) return;
  pinInput = pinInput.slice(0, -1);
  updatePinDisplay();
}

function updatePinDisplay() {
  for (let i = 1; i <= 8; i++) {
    const dot = document.getElementById('pinDot' + i);
    if (i <= pinInput.length) {
      dot.classList.add('filled');
      dot.classList.remove('error');
    } else {
      dot.classList.remove('filled', 'error');
    }
  }
  document.getElementById('pinError').textContent = '';
}

function pinSubmit() {
  if (pinVerified) return;
  if (pinInput === PIN_CODE) {
    pinVerified = true;
    sessionStorage.setItem('pin_verified', 'true');
    document.getElementById('pinOverlay').classList.add('hidden');
  } else {
    for (let i = 1; i <= 8; i++) {
      document.getElementById('pinDot' + i).classList.add('error');
    }
    document.getElementById('pinError').textContent = 'Code incorrect. Essayez encore.';
    pinInput = '';
    setTimeout(() => {
      for (let i = 1; i <= 8; i++) {
        document.getElementById('pinDot' + i).classList.remove('error');
      }
    }, 400);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (pinVerified) {
    document.getElementById('pinOverlay').classList.add('hidden');
  }
});

document.addEventListener('keydown', (e) => {
  if (pinVerified) return;
  if (e.key >= '0' && e.key <= '9') pinPress(e.key);
  if (e.key === 'Backspace') pinClear();
  if (e.key === 'Enter') pinSubmit();
});

// ===== TOAST SYSTEM =====
function showToast(msg, type = 'info', duration = 3500) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i class="fas ${icons[type] || icons.info} toast-icon-${type}"></i><span class="toast-msg">${msg}</span><i class="fas fa-times toast-close" onclick="this.parentElement.remove()"></i>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ===== APP STATE =====
let currentLang = localStorage.getItem('lang') || 'fr';
let player = null;
let allChannels = [], allCategories = [], vodCategories = [], seriesCategories = [];
let activeCat = 'all', searchQuery = '', currentChannelIndex = -1;
let displayedCount = 0, activeTab = 'live';
let currentVodStreams = [], currentSeriesList = [], currentSeriesEpisodes = [];
const PAGE_SIZE = 50;
let channelNavIndex = -1; // keyboard navigation

// ===== FAVORITES =====
function getFavorites() {
  try { return JSON.parse(localStorage.getItem('sv_favorites') || '[]'); } catch { return []; }
}
function setFavorites(favs) {
  localStorage.setItem('sv_favorites', JSON.stringify(favs));
}
function toggleFavorite(streamId, e) {
  if (e) e.stopPropagation();
  const favs = getFavorites();
  const idx = favs.indexOf(streamId);
  if (idx >= 0) { favs.splice(idx, 1); showToast(currentLang === 'fr' ? 'Retiré des favoris' : 'Removed from favorites', 'info', 2000); }
  else { favs.push(streamId); showToast(currentLang === 'fr' ? 'Ajouté aux favoris ⭐' : 'Added to favorites ⭐', 'success', 2000); }
  setFavorites(favs);
  // Update all star buttons for this streamId
  document.querySelectorAll(`.ch-fav[data-id="${streamId}"]`).forEach(btn => btn.classList.toggle('active', favs.includes(streamId)));
}
function isFav(id) { return getFavorites().includes(String(id)) || getFavorites().includes(Number(id)); }

// ===== RECENTLY WATCHED =====
function getRecent() {
  try { return JSON.parse(localStorage.getItem('sv_recent') || '[]'); } catch { return []; }
}
function addRecent(ch) {
  let recent = getRecent();
  recent = recent.filter(r => r.id !== ch.id);
  recent.unshift({ id: ch.id, name: ch.name, icon: ch.stream_icon || '', type: ch.type || 'live', ts: Date.now() });
  recent = recent.slice(0, 20);
  localStorage.setItem('sv_recent', JSON.stringify(recent));
}

// ===== FETCH =====
const XTREAM = { host: 'http://smarters2026.sbs:8080', user: 'lxkbttgxyw', pass: '23mpvq5l7d' };

async function xtreamFetch(endpoint) {
  // Extract query part after '?'
  const query = endpoint.split('?')[1] || '';
  const proxied = `/api/xtream?${query}`;

  try {
    const r = await fetch(proxied, { signal: AbortSignal.timeout(15000) });
    if (r.ok) return await r.json();
  } catch(e) {}

  try {
    const r = await fetch(`${XTREAM.host}${endpoint}`, { signal: AbortSignal.timeout(10000) });
    if (r.ok) return await r.json();
  } catch(e) {}

  const encodedUrl = encodeURIComponent(`${XTREAM.host}${endpoint}`);
  const proxies = [
    `https://api.allorigins.win/raw?url=${encodedUrl}`,
    `https://cors.eu.org/${XTREAM.host}${endpoint}`,
  ];
  for (const proxy of proxies) {
    try {
      const r = await fetch(proxy, { signal: AbortSignal.timeout(20000) });
      if (r.ok) {
        const data = await r.json();
        if (Array.isArray(data) || (data && typeof data === 'object')) return data;
      }
    } catch(e) {}
  }
  return null;
}

async function fetchCategories() {
  const d = await xtreamFetch(`/player_api.php?username=${XTREAM.user}&password=${XTREAM.pass}&action=get_live_categories`);
  allCategories = d || [];
}

async function fetchChannels() {
  const l = document.getElementById('channelList');
  if (l) l.innerHTML = renderSkeletons(6);
  const d = await xtreamFetch(`/player_api.php?username=${XTREAM.user}&password=${XTREAM.pass}&action=get_live_streams`);
  allChannels = d || [];
  if (allChannels.length === 0 && !d) {
    showCorsWarning();
    return;
  }
  displayedCount = 0;
  renderChannels(true);
  showToast(`${allChannels.length.toLocaleString()} ${currentLang === 'fr' ? 'chaînes chargées' : 'channels loaded'}`, 'success', 2500);
}

function showCorsWarning() {
  const list = document.getElementById('channelList');
  if (!list) return;
  const isGH = location.hostname.includes('github.io');
  list.innerHTML = `
    <div class="channel-empty" style="padding:30px 20px">
      <i class="fas fa-shield-halved" style="font-size:2rem;color:#ff6b6b;margin-bottom:12px;display:block"></i>
      <p style="color:#ff6b6b;font-weight:600;margin:0 0 8px">⚠️ ${currentLang === 'fr' ? 'Streaming bloqué par le navigateur' : 'Streaming blocked by browser'}</p>
      <p style="color:rgba(255,255,255,0.5);font-size:0.85rem;margin:0 0 16px">
        ${isGH
          ? 'GitHub Pages ne peut pas se connecter au serveur IPTV.<br><b>Lancez le site en local :</b>'
          : 'Le serveur proxy local n\'a pas répondu.<br><b>Redémarrez avec server.py :</b>'}
      </p>
      <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:12px;text-align:left;font-family:monospace;font-size:0.8rem;color:#ccc">
        cd iptv-webapp<br>
        python server.py
      </div>
      <button onclick="location.reload()" style="margin-top:16px;background:#673de6;color:#fff;border:none;padding:10px 28px;border-radius:8px;cursor:pointer;font-weight:600">↻ ${currentLang === 'fr' ? 'Réessayer' : 'Retry'}</button>
    </div>`;
}

async function fetchVodCategories() {
  const d = await xtreamFetch(`/player_api.php?username=${XTREAM.user}&password=${XTREAM.pass}&action=get_vod_categories`);
  vodCategories = d || [];
  renderVodCategories();
}

async function fetchSeriesCategories() {
  const d = await xtreamFetch(`/player_api.php?username=${XTREAM.user}&password=${XTREAM.pass}&action=get_series_categories`);
  seriesCategories = d || [];
  renderSeriesCategories();
}

// ===== SKELETON LOADER =====
function renderSkeletons(count) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `<div class="skeleton-item"><div class="skeleton-logo"></div><div class="skeleton-lines"><div class="skeleton-line l1"></div><div class="skeleton-line l2"></div></div></div>`;
  }
  return html;
}

// ===== HELPERS =====
function clean(n) { return n ? n.replace(/\|[A-Z]+\|\s*/g,'').replace(/✪/g,'').replace(/★/g,'').replace(/⭐/g,'').replace(/\s+/g,' ').trim() : ''; }

function getGroup(n) {
  const x = n.toLowerCase();
  if (x.includes('sport')||x.includes('bein')||x.includes('dazn')||x.includes('eurosport')||x.includes('espn')||x.includes('ppv')||x.includes('event')) return 'sport';
  if (x.includes('news')||x.includes('info')||x.includes('al jazeera')||x.includes('cnn')||x.includes('bbc')||x.includes('france 24')) return 'news';
  if (x.includes('cinema')||x.includes('movie')||x.includes('film')||x.includes('hbo')||x.includes('netflix')||x.includes('box office')||x.includes('افلام')||x.includes('فيلم')) return 'movies';
  if (x.includes('music')||x.includes('musique')||x.includes('spotify')||x.includes('mtv')) return 'music';
  if (x.includes('kid')||x.includes('enfant')||x.includes('jeunesse')||x.includes('cartoon')||x.includes('nick')||x.includes('disney')||x.includes('انمي')) return 'kids';
  if (x.includes('document')||x.includes('discovery')||x.includes('national geographic')||x.includes('وثائقي')) return 'docs';
  if (x.includes('ramadan')||x.includes('رمضان')||x.includes('serie')||x.includes('مسلسل')||x.includes('drama')) return 'series';
  if (x.includes('morocco')||x.includes('maroc')||x.includes('مغرب')) return 'ma';
  if (x.includes('france')||x.includes('français')||x.includes('tnt')||x.includes('canal')||x.includes('rmc')||x.includes('tf1')) return 'fr';
  if (x.includes('spain')||x.includes('espa')||x.includes('la liga')) return 'es';
  if (x.includes('germany')||x.includes('deutsch')||x.includes('bundesliga')) return 'de';
  if (x.includes('italy')||x.includes('italia')||x.includes('serie a')) return 'it';
  if (x.includes('uk')||x.includes('britain')||x.includes('sky uk')) return 'uk';
  if (x.includes('belgium')||x.includes('belgique')||x.includes('vlaams')) return 'be';
  if (x.includes('netherlands')||x.includes('nederland')) return 'nl';
  if (x.includes('arab')||x.includes('mbc')||x.includes('rotana')||x.includes('osn')||x.includes('shahid')||x.includes('عرب')) return 'ar';
  if (x.includes('africa')||x.includes('afrique')||x.includes('dstv')) return 'af';
  if (x.includes('turk')||x.includes('türkiye')) return 'tr';
  if (x.includes('india')||x.includes('hindi')||x.includes('bollywood')||x.includes('هند')) return 'in';
  return 'other';
}

const GL = {
  sport:'⚽ Sport', news:'📰 Info', movies:'🎬 Cinéma', music:'🎵 Musique',
  kids:'🧒 Enfants', docs:'🔬 Docs', series:'📺 Séries',
  ma:'🇲🇦 Maroc', fr:'🇫🇷 France', es:'🇪🇸 Espagne', de:'🇩🇪 Allemagne',
  it:'🇮🇹 Italie', uk:'🇬🇧 UK', be:'🇧🇪 Belgique', nl:'🇳🇱 Pays-Bas',
  ar:'🌙 Arabe', af:'🌍 Afrique', tr:'🇹🇷 Turquie', in:'🇮🇳 Inde', other:'📺 Autres'
};

// ===== CATEGORY PILLS =====
function renderCatPills() {
  const c = document.getElementById('catPills');
  if (!c) return;
  const groups = {};
  allCategories.forEach(cat => {
    const name = clean(cat.category_name);
    const g = getGroup(name);
    if (!groups[g]) groups[g] = [];
    groups[g].push({ id: cat.category_id, name: name });
  });

  // Add Favorites pill if there are favorites
  const favs = getFavorites();
  let favCount = 0;
  if (favs.length > 0) {
    favCount = allChannels.filter(ch => favs.includes(String(ch.stream_id)) || favs.includes(Number(ch.stream_id))).length;
  }

  let html = `<div class="cat-pill active" onclick="switchChannelCat('all',this)">📺 <span data-fr="Tous" data-en="All">Tous</span> <span class="cpill-count">(${allChannels.length})</span></div>`;

  if (favCount > 0) {
    html += `<div class="cat-pill" onclick="switchChannelCat('favorites',this)" data-group="favorites">⭐ <span data-fr="Favoris" data-en="Favorites">Favoris</span> <span class="cpill-count">(${favCount})</span></div>`;
  }

  ['sport','news','movies','music','kids','docs','series','ma','fr','es','de','it','uk','be','nl','ar','af','tr','in','other'].forEach(g => {
    if (!groups[g]||groups[g].length===0) return;
    const total = allChannels.filter(ch => {
      const ids = ch.category_ids || (ch.category_id ? [ch.category_id] : []);
      return ids.some(id => groups[g].some(c=>String(c.id)===String(id)));
    }).length;
    if (total === 0) return;
    html += `<div class="cat-pill" onclick="switchChannelCat('${g}',this)" data-group="${g}">${GL[g]||g} <span class="cpill-count">(${total})</span></div>`;
  });
  c.innerHTML = html;
}

// ===== VOD CATEGORIES =====
function renderVodCategories() {
  const c = document.getElementById('vodCategories'); if (!c) return;
  const groups = {};
  vodCategories.forEach(cat => {
    const name = clean(cat.category_name);
    const g = getGroup(name);
    if (!groups[g]) groups[g] = [];
    groups[g].push({ id: cat.category_id, name: name });
  });
  let html = '';
  Object.keys(groups).sort().forEach(g => {
    html += `<div class="vod-group-title">${GL[g]||g}</div>`;
    groups[g].sort((a,b) => a.name.localeCompare(b.name,'fr'));
    groups[g].slice(0,12).forEach(cat => {
      html += `<div class="vod-cat-item" onclick="loadVodStreams('${cat.id}')"><span class="ci">📂</span>${cat.name}</div>`;
    });
  });
  c.innerHTML = html || '<div class="channel-empty"><p>No categories</p></div>';
}

function renderSeriesCategories() {
  const c = document.getElementById('seriesCategories'); if (!c) return;
  const groups = {};
  seriesCategories.forEach(cat => {
    const name = clean(cat.category_name);
    const g = getGroup(name);
    if (!groups[g]) groups[g] = [];
    groups[g].push({ id: cat.category_id, name: name });
  });
  let html = '';
  Object.keys(groups).sort().forEach(g => {
    html += `<div class="vod-group-title">${GL[g]||g}</div>`;
    groups[g].sort((a,b) => a.name.localeCompare(b.name,'fr'));
    groups[g].slice(0,12).forEach(cat => {
      html += `<div class="vod-cat-item" onclick="loadSeriesList('${cat.id}')"><span class="ci">📂</span>${cat.name}</div>`;
    });
  });
  c.innerHTML = html || '<div class="channel-empty"><p>No categories</p></div>';
}

// ===== RENDER CHANNELS =====
function renderChannels(reset = false) {
  const list = document.getElementById('channelList'); if (!list) return;
  let filtered = allChannels;

  if (activeCat === 'favorites') {
    const favs = getFavorites();
    filtered = filtered.filter(ch => favs.includes(String(ch.stream_id)) || favs.includes(Number(ch.stream_id)));
  } else if (activeCat !== 'all') {
    filtered = filtered.filter(ch => {
      const ids = ch.category_ids || (ch.category_id ? [ch.category_id] : []);
      return ids.some(id => {
        const cat = allCategories.find(c=>String(c.category_id)===String(id));
        return cat && getGroup(clean(cat.category_name)) === activeCat;
      });
    });
  }
  if (searchQuery) { const q = searchQuery.toLowerCase(); filtered = filtered.filter(ch => ch.name.toLowerCase().includes(q)); }
  if (reset) { displayedCount = 0; list.innerHTML = ''; }
  const start = displayedCount; const end = Math.min(start + PAGE_SIZE, filtered.length);
  const page = filtered.slice(start, end); displayedCount = end;

  if (filtered.length === 0 && reset) {
    list.innerHTML = `<div class="channel-empty"><i class="fas fa-search"></i><p>${currentLang==='fr'?'Aucune chaîne':'No channels'}</p></div>`;
    updateCount(0);
    return;
  }

  const html = page.map(ch => {
    const idx = allChannels.indexOf(ch);
    const isActive = currentChannelIndex === idx;
    const logo = ch.stream_icon ? `<img src="${ch.stream_icon}" loading="lazy" onerror="this.parentElement.innerHTML='<span>${ch.name.charAt(0).toUpperCase()}</span>'">` : `<span>${ch.name.charAt(0).toUpperCase()}</span>`;
    const catName = clean(getCatName(ch.category_id)).substring(0,22);
    const isF = isFav(ch.stream_id);
    return `<div class="channel-item ${isActive?'active':''}" onclick="playChannel(${idx})" data-idx="${idx}">
      <div class="ch-logo">${logo}</div>
      <div class="ch-info">
        <div class="ch-name">${ch.name}</div>
        <div class="ch-meta"><span class="ch-cat">${catName}</span><span class="ch-live"><span class="dot"></span>LIVE</span></div>
      </div>
      <button class="ch-fav ${isF?'active':''}" data-id="${ch.stream_id}" onclick="toggleFavorite(${ch.stream_id},event)">⭐</button>
    </div>`;
  }).join('');
  list.insertAdjacentHTML('beforeend', html);

  if (displayedCount < filtered.length) {
    const rem = filtered.length - displayedCount;
    const btn = document.createElement('div');
    btn.className = 'channel-loadmore';
    btn.textContent = `+ ${Math.min(PAGE_SIZE,rem)} ${currentLang==='fr'?'de plus':'more'}`;
    btn.onclick = () => { btn.remove(); renderChannels(false); };
    list.appendChild(btn);
  }
  updateCount(filtered.length);
}

function getCatName(id) { const c = allCategories.find(x=>String(x.category_id)===String(id)); return c?c.category_name:''; }
function updateCount(n) { const e = document.getElementById('channelCount'); if(e) e.textContent = `${n} ch.`; }

// ===== VOD =====
async function loadVodStreams(catId) {
  const list = document.getElementById('channelList');
  if (list) list.innerHTML = renderSkeletons(4);
  const d = await xtreamFetch(`/player_api.php?username=${XTREAM.user}&password=${XTREAM.pass}&action=get_vod_streams&category_id=${catId}`);
  currentVodStreams = d || [];
  displayedCount = 0;
  renderVodStreams(true);
}

function renderVodStreams(reset = false) {
  const list = document.getElementById('channelList'); if (!list) return;
  if (reset) { displayedCount = 0; list.innerHTML = ''; }
  const start = displayedCount; const end = Math.min(start + PAGE_SIZE, currentVodStreams.length);
  const page = currentVodStreams.slice(start, end); displayedCount = end;
  if (currentVodStreams.length === 0 && reset) { list.innerHTML = `<div class="channel-empty"><i class="fas fa-film"></i><p>${currentLang==='fr'?'Aucun film':'No movies'}</p></div>`; updateCount(0); return; }
  const html = page.map(v => {
    const logo = v.stream_icon ? `<img src="${v.stream_icon}" loading="lazy" onerror="this.parentElement.innerHTML='<span>🎬</span>'">` : '<span>🎬</span>';
    return `<div class="channel-item vod-item" onclick="playVod(${v.stream_id},'${v.container_extension||'mp4'}')"><div class="ch-logo">${logo}</div><div class="ch-info"><div class="ch-name">${v.name}</div><div class="ch-meta"><span class="ch-cat">🎬 Movie</span></div></div></div>`;
  }).join('');
  list.insertAdjacentHTML('beforeend', html);
  if (displayedCount < currentVodStreams.length) { const rem = currentVodStreams.length - displayedCount; const btn = document.createElement('div'); btn.className = 'channel-loadmore'; btn.textContent = `+ ${Math.min(PAGE_SIZE,rem)} more`; btn.onclick = () => { btn.remove(); renderVodStreams(false); }; list.appendChild(btn); }
  updateCount(currentVodStreams.length);
}

function filterVod() {
  const q = (document.getElementById('vodSearch')||{}).value||'';
  if (!q) { renderVodStreams(true); return; }
  const f = currentVodStreams.filter(v=>v.name.toLowerCase().includes(q.toLowerCase()));
  displayedCount = 0;
  const list = document.getElementById('channelList'); if (!list) return;
  list.innerHTML = '';
  const html = f.slice(0,PAGE_SIZE).map(v => {
    const logo = v.stream_icon ? `<img src="${v.stream_icon}" loading="lazy" onerror="this.parentElement.innerHTML='<span>🎬</span>'">` : '<span>🎬</span>';
    return `<div class="channel-item vod-item" onclick="playVod(${v.stream_id},'${v.container_extension||'mp4'}')"><div class="ch-logo">${logo}</div><div class="ch-info"><div class="ch-name">${v.name}</div><div class="ch-meta"><span class="ch-cat">🎬 Movie</span></div></div></div>`;
  }).join('');
  list.innerHTML = html || `<div class="channel-empty"><i class="fas fa-search"></i><p>${currentLang==='fr'?'Aucun film':'No movies'}</p></div>`;
  updateCount(f.length);
}

// ===== SERIES =====
async function loadSeriesList(catId) {
  const list = document.getElementById('channelList');
  if (list) list.innerHTML = renderSkeletons(4);
  const d = await xtreamFetch(`/player_api.php?username=${XTREAM.user}&password=${XTREAM.pass}&action=get_series&category_id=${catId}`);
  currentSeriesList = d || [];
  displayedCount = 0;
  renderSeriesList(true);
}

function renderSeriesList(reset = false) {
  const list = document.getElementById('channelList'); if (!list) return;
  if (reset) { displayedCount = 0; list.innerHTML = ''; }
  const start = displayedCount; const end = Math.min(start + PAGE_SIZE, currentSeriesList.length);
  const page = currentSeriesList.slice(start, end); displayedCount = end;
  if (currentSeriesList.length === 0 && reset) { list.innerHTML = `<div class="channel-empty"><i class="fas fa-tv"></i><p>${currentLang==='fr'?'Aucune série':'No series'}</p></div>`; updateCount(0); return; }
  const html = page.map(s => {
    const logo = s.cover ? `<img src="${s.cover}" loading="lazy" onerror="this.parentElement.innerHTML='<span>📺</span>'">` : '<span>📺</span>';
    const year = s.releaseDate||s.release_date||s.year||'';
    return `<div class="channel-item vod-item" onclick="loadSeriesEpisodes(${s.series_id})"><div class="ch-logo">${logo}</div><div class="ch-info"><div class="ch-name">${s.name}</div><div class="ch-meta"><span class="ch-cat">📺 Series${year?' • '+year:''}</span></div></div></div>`;
  }).join('');
  list.insertAdjacentHTML('beforeend', html);
  if (displayedCount < currentSeriesList.length) { const rem = currentSeriesList.length - displayedCount; const btn = document.createElement('div'); btn.className = 'channel-loadmore'; btn.textContent = `+ ${Math.min(PAGE_SIZE,rem)} more`; btn.onclick = () => { btn.remove(); renderSeriesList(false); }; list.appendChild(btn); }
  updateCount(currentSeriesList.length);
}

function filterSeries() {
  const q = (document.getElementById('seriesSearch')||{}).value||'';
  if (!q) { renderSeriesList(true); return; }
  const f = currentSeriesList.filter(s=>s.name.toLowerCase().includes(q.toLowerCase()));
  displayedCount = 0;
  const list = document.getElementById('channelList'); if (!list) return;
  list.innerHTML = '';
  const html = f.slice(0,PAGE_SIZE).map(s => {
    const logo = s.cover ? `<img src="${s.cover}" loading="lazy" onerror="this.parentElement.innerHTML='<span>📺</span>'">` : '<span>📺</span>';
    return `<div class="channel-item vod-item" onclick="loadSeriesEpisodes(${s.series_id})"><div class="ch-logo">${logo}</div><div class="ch-info"><div class="ch-name">${s.name}</div><div class="ch-meta"><span class="ch-cat">📺 Series</span></div></div></div>`;
  }).join('');
  list.innerHTML = html || `<div class="channel-empty"><i class="fas fa-search"></i><p>${currentLang==='fr'?'Aucune série':'No series'}</p></div>`;
  updateCount(f.length);
}

async function loadSeriesEpisodes(seriesId) {
  const list = document.getElementById('channelList');
  if (list) list.innerHTML = renderSkeletons(4);
  const d = await xtreamFetch(`/player_api.php?username=${XTREAM.user}&password=${XTREAM.pass}&action=get_series_info&series_id=${seriesId}`);
  if (!d) { list.innerHTML = '<div class="channel-empty"><p>Error</p></div>'; return; }
  currentSeriesEpisodes = [];
  if (d.episodes) {
    if (typeof d.episodes === 'object') { Object.keys(d.episodes).forEach(s=>d.episodes[s].forEach(e=>currentSeriesEpisodes.push({...e,season:s}))); }
    else if (Array.isArray(d.episodes)) { d.episodes.forEach(e=>currentSeriesEpisodes.push(e)); }
  }
  displayedCount = 0;
  renderEpisodes(true);
}

function renderEpisodes(reset = false) {
  const list = document.getElementById('channelList'); if (!list) return;
  if (reset) {
    list.innerHTML = '';
    const b = document.createElement('div');
    b.className = 'vod-back-btn';
    b.innerHTML = '<i class="fas fa-arrow-left"></i> Back';
    b.onclick = () => { displayedCount = 0; renderSeriesList(true); };
    list.appendChild(b);
    displayedCount = 0;
  }
  if (currentSeriesEpisodes.length === 0 && reset) { list.innerHTML += `<div class="channel-empty"><i class="fas fa-tv"></i><p>${currentLang==='fr'?'Aucun épisode':'No episodes'}</p></div>`; return; }
  const start = displayedCount; const end = Math.min(start + PAGE_SIZE, currentSeriesEpisodes.length);
  const page = currentSeriesEpisodes.slice(start, end); displayedCount = end;
  const html = page.map(ep => {
    const t = ep.title||`S${ep.season||'?'}E${ep.episode_num||'?'}`;
    return `<div class="channel-item vod-item" onclick="playEpisode(${ep.id},'${ep.container_extension||'mp4'}')"><div class="ch-logo"><span>▶</span></div><div class="ch-info"><div class="ch-name">${t}</div><div class="ch-meta"><span class="ch-cat">📺 Episode</span></div></div></div>`;
  }).join('');
  list.insertAdjacentHTML('beforeend', html);
  if (displayedCount < currentSeriesEpisodes.length) { const rem = currentSeriesEpisodes.length - displayedCount; const btn = document.createElement('div'); btn.className = 'channel-loadmore'; btn.textContent = `+ ${Math.min(PAGE_SIZE,rem)} more`; btn.onclick = () => { btn.remove(); renderEpisodes(false); }; list.appendChild(btn); }
}

// ===== PLAYER =====
function liveUrl(id) { return `${XTREAM.host}/live/${XTREAM.user}/${XTREAM.pass}/${id}.m3u8`; }
function vodUrl(id, ext) { return `${XTREAM.host}/movie/${XTREAM.user}/${XTREAM.pass}/${id}.${ext||'mp4'}`; }
function epUrl(id, ext) { return `${XTREAM.host}/series/${XTREAM.user}/${XTREAM.pass}/${id}.${ext||'mp4'}`; }

function initPlayer() {
  const el = document.getElementById('streamPlayer');
  if (!el || typeof videojs === 'undefined') return;
  player = videojs('streamPlayer', {
    html5: { vhs: { overrideNative: true }, nativeAudioTracks: false, nativeVideoTracks: false },
    responsive: true, fluid: true, liveui: true,
    controlBar: { volumePanel: { inline: false } },
    playbackRates: [0.5, 1, 1.25, 1.5, 2]
  });

  player.on('error', () => {
    showToast(currentLang === 'fr' ? 'Erreur de lecture — Réessayez' : 'Playback error — Try again', 'error');
  });

  player.on('playing', () => {
    document.getElementById('playerOverlay')?.classList.add('hidden');
  });
}

function playChannel(index) {
  const ch = allChannels[index];
  if (!ch) return;
  if (!player) { showToast(currentLang === 'fr' ? 'Lecteur non disponible' : 'Player not available', 'error'); return; }
  currentChannelIndex = index;
  document.getElementById('playerOverlay')?.classList.add('hidden');
  const np = document.getElementById('nowPlayingChannel');
  if (np) np.textContent = ch.name;

  // Add to recently watched
  addRecent({ id: ch.stream_id, name: ch.name, stream_icon: ch.stream_icon, type: 'live' });

  player.src({ src: liveUrl(ch.stream_id), type: 'application/x-mpegURL' });
  player.play().catch(() => {});

  // Update active state
  document.querySelectorAll('#channelList .channel-item').forEach(el => el.classList.toggle('active', parseInt(el.dataset.idx) === index));

  // Scroll active item into view
  const activeEl = document.querySelector(`#channelList .channel-item[data-idx="${index}"]`);
  if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Update EPG bar if epg_channel_id available
  updateEpgBar(ch);

  if (window.innerWidth < 768) document.getElementById('player')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateEpgBar(ch) {
  const epgBar = document.getElementById('epgBar');
  if (!epgBar) return;
  if (ch.epg_channel_id) {
    epgBar.innerHTML = `<span class="epg-label">📡 EPG:</span><span class="epg-text">${ch.epg_channel_id}</span>`;
    epgBar.style.display = 'flex';
  } else {
    epgBar.innerHTML = `<span class="epg-label">📺 Channel ID:</span><span class="epg-text">${ch.stream_id}</span>`;
    epgBar.style.display = 'flex';
  }
}

function playVod(id, ext) {
  if (!player) return;
  document.getElementById('playerOverlay')?.classList.add('hidden');
  const np = document.getElementById('nowPlayingChannel');
  if (np) np.textContent = '🎬 VOD';
  player.src({ src: vodUrl(id, ext), type: 'video/mp4' });
  player.play().catch(() => {});
}

function playEpisode(id, ext) {
  if (!player) return;
  document.getElementById('playerOverlay')?.classList.add('hidden');
  const np = document.getElementById('nowPlayingChannel');
  if (np) np.textContent = '📺 Episode';
  player.src({ src: epUrl(id, ext), type: 'video/mp4' });
  player.play().catch(() => {});
}

function togglePiP() {
  const v = document.querySelector('#streamPlayer video') || document.getElementById('streamPlayer');
  if (v && document.pictureInPictureEnabled) {
    if (document.pictureInPictureElement) document.exitPictureInPicture();
    else v.requestPictureInPicture().catch(() => {});
  }
}

function toggleFullscreen() {
  if (player) player.isFullscreen() ? player.exitFullscreen() : player.requestFullscreen();
}

// ===== KEYBOARD NAVIGATION =====
document.addEventListener('keydown', (e) => {
  if (pinVerified) {
    const list = document.getElementById('channelList');
    if (!list) return;
    const items = list.querySelectorAll('.channel-item');
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      channelNavIndex = Math.min(channelNavIndex + 1, items.length - 1);
      highlightChannelItem(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      channelNavIndex = Math.max(channelNavIndex - 1, 0);
      highlightChannelItem(items);
    } else if (e.key === 'Enter' && channelNavIndex >= 0) {
      e.preventDefault();
      items[channelNavIndex].click();
    }
  }
});

function highlightChannelItem(items) {
  items.forEach(el => el.style.outline = 'none');
  if (items[channelNavIndex]) {
    items[channelNavIndex].style.outline = '2px solid var(--primary)';
    items[channelNavIndex].style.outlineOffset = '-2px';
    // Hide overlay
    document.getElementById('playerOverlay')?.classList.add('hidden');
  }
}

// ===== TABS =====
function switchPlayerTab(tab, btn) {
  activeTab = tab;
  document.querySelectorAll('.player-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('livePanel').classList.toggle('hidden', tab !== 'live');
  document.getElementById('moviesPanel').classList.toggle('hidden', tab !== 'movies');
  document.getElementById('seriesPanel').classList.toggle('hidden', tab !== 'series');
  
  if (tab === 'live') {
    displayedCount = 0;
    renderChannels(true);
  } else if (tab === 'movies') {
    // Switch to VOD categories view
    const vodCategoriesContainer = document.getElementById('vodCategories');
    const vodListContainer = document.getElementById('vodList');
    if (vodCategoriesContainer) vodCategoriesContainer.innerHTML = '<div class="vod-group-title">📂 <span data-fr="Chargement des catégories..." data-en="Loading categories..."></span></div>';
    if (vodListContainer) vodListContainer.innerHTML = '<div class="vod-group-title">📂 <span data-fr="Sélectionnez une catégorie" data-en="Select a category">Sélectionnez une catégorie</span></div>';
    fetchVodCategories();
  } else if (tab === 'series') {
    // Switch to series categories view
    const seriesCategoriesContainer = document.getElementById('seriesCategories');
    const seriesListContainer = document.getElementById('seriesList');
    if (seriesCategoriesContainer) seriesCategoriesContainer.innerHTML = '<div class="vod-group-title">📂 <span data-fr="Chargement des catégories..." data-en="Loading categories..."></span></div>';
    if (seriesListContainer) seriesListContainer.innerHTML = '<div class="vod-group-title">📂 <span data-fr="Sélectionnez une catégorie" data-en="Select a category">Sélectionnez une catégorie</span></div>';
    fetchSeriesCategories();
  }
}

function switchChannelCat(id, pill) {
  activeCat = id;
  displayedCount = 0;
  channelNavIndex = -1;
  document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
  if (pill) pill.classList.add('active');
  renderChannels(true);
}

function filterChannels() {
  const i = document.getElementById('channelSearch');
  searchQuery = i ? i.value.trim() : '';
  displayedCount = 0;
  renderChannels(true);
}

// ===== LANGUAGE =====
function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  document.querySelectorAll('.lang-switcher button').forEach(b => b.classList.toggle('active', b.textContent.toLowerCase() === lang));
  document.querySelectorAll('[data-fr][data-en]').forEach(el => {
    const t = el.getAttribute(`data-${lang}`);
    if (t) el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ? el.placeholder = t : el.innerHTML = t;
  });
  document.documentElement.lang = lang;
  renderCatPills();
  renderChannels(true);
}

// ===== THEME =====
function toggleTheme() {
  const html = document.documentElement;
  const icon = document.getElementById('themeIcon');
  const current = html.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  if (icon) icon.className = next === 'light' ? 'fas fa-moon' : 'fas fa-sun';
}

(function() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  const icon = document.getElementById('themeIcon');
  if (icon) icon.className = saved === 'light' ? 'fas fa-moon' : 'fas fa-sun';
})();

// ===== NAVBAR / FAQ / TUTORIALS / SCROLL / ANIMATIONS =====
function initNavbar() {
  const n = document.getElementById('navbar');
  if (n) window.addEventListener('scroll', () => n.classList.toggle('scrolled', window.scrollY > 50));
}

function toggleMobileNav() {
  const n = document.getElementById('mobileNav');
  if (n) n.classList.toggle('open');
}

function toggleFaq(btn) {
  const item = btn.parentElement;
  const a = item.classList.contains('active');
  document.querySelectorAll('.faq-item').forEach(f => f.classList.remove('active'));
  if (!a) item.classList.add('active');
}

function switchTutorial(id, btn) {
  document.querySelectorAll('.tutorial-content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.tutorial-tab').forEach(t => t.classList.remove('active'));
  const t = document.getElementById('tutorial-' + id);
  if (t) t.classList.add('active');
  if (btn) btn.classList.add('active');
}

function initAnimations() {
  const o = new IntersectionObserver((e) => e.forEach(x => {
    if (x.isIntersecting) { x.target.classList.add('visible'); o.unobserve(x.target); }
  }), { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
  document.querySelectorAll('.animate-in').forEach(el => o.observe(el));
  setTimeout(() => document.querySelectorAll('.animate-in').forEach(el => el.classList.add('visible')), 2000);
}

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', function(e) {
    const t = document.querySelector(this.getAttribute('href'));
    if (t) { e.preventDefault(); window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' }); }
  }));
}

function initActiveNav() {
  const s = document.querySelectorAll('section[id]');
  window.addEventListener('scroll', () => {
    let c = '';
    s.forEach(x => { if (window.scrollY >= x.offsetTop - 100) c = x.getAttribute('id'); });
    document.querySelectorAll('.nav-links a').forEach(l => l.classList.toggle('active', l.getAttribute('href') === `#${c}`));
  });
}

// ===== BACK TO TOP =====
function initBackToTop() {
  const btn = document.getElementById('backToTop');
  if (!btn) return;
  window.addEventListener('scroll', () => btn.classList.toggle('visible', window.scrollY > 500));
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// ===== ANIMATED COUNTER =====
function initCounter() {
  const counters = document.querySelectorAll('.counter-num');
  if (counters.length === 0) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.target) || 0;
        const duration = 2000;
        const start = performance.now();
        function update(now) {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          const val = Math.round(eased * target);
          el.textContent = val.toLocaleString() + (el.dataset.suffix || '');
          if (progress < 1) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(c => observer.observe(c));
}

function handleSubmit(e) {
  e.preventDefault();
  const d = new FormData(e.target);
  let m = '📋 *Nouvelle commande StreamVision IPTV*\n\n';
  for (let [k, v] of d.entries()) if (v) m += `*${k}*: ${v}\n`;
  window.open(`https://wa.me/212630463227?text=${encodeURIComponent(m)}`, '_blank');
  showToast(currentLang === 'fr' ? '✅ Merci ! Redirection vers WhatsApp...' : '✅ Thank you! Redirecting to WhatsApp...', 'success');
  e.target.reset();
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  setLang(currentLang);
  initNavbar();
  initAnimations();
  initSmoothScroll();
  initActiveNav();
  initBackToTop();
  initCounter();

  await fetchCategories();
  await fetchChannels();
  await fetchVodCategories();
  await fetchSeriesCategories();
  renderCatPills();

  if (typeof videojs !== 'undefined') initPlayer();
  else window.addEventListener('load', initPlayer);
});
