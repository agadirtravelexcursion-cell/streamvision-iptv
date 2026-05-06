// ===== PIN GATE =====
const PIN_CODE = '24021994';
let pinInput = '';
let pinVerified = false;

// Check if already verified this session
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
    // Shake animation on dots
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

// Show PIN overlay on load
document.addEventListener('DOMContentLoaded', () => {
  if (pinVerified) {
    document.getElementById('pinOverlay').classList.add('hidden');
  }
});

// Also support Enter key
document.addEventListener('keydown', (e) => {
  if (pinVerified) return;
  if (e.key >= '0' && e.key <= '9') pinPress(e.key);
  if (e.key === 'Backspace') pinClear();
  if (e.key === 'Enter') pinSubmit();
});

let currentLang = localStorage.getItem('lang') || 'fr';
let player = null;
let allChannels = [], allCategories = [], vodCategories = [], seriesCategories = [];
let activeCat = 'all', searchQuery = '', currentChannelIndex = -1;
let displayedCount = 0, activeTab = 'live';
let currentVodStreams = [], currentSeriesList = [], currentSeriesEpisodes = [];
const PAGE_SIZE = 50;

const XTREAM = { host: 'http://smarters2026.sbs:8080', user: 'lxkbttgxyw', pass: '23mpvq5l7d' };

// ===== FETCH =====
async function xtreamFetch(endpoint) {
  try { const r = await fetch(`${XTREAM.host}${endpoint}`, { signal: AbortSignal.timeout(15000) }); if (r.ok) return await r.json(); } catch(e) {}
  try { const r = await fetch(`https://corsproxy.io/?${encodeURIComponent(XTREAM.host + endpoint)}`, { signal: AbortSignal.timeout(20000) }); if (r.ok) return await r.json(); } catch(e) {}
  return null;
}

async function fetchCategories() {
  const d = await xtreamFetch(`/player_api.php?username=${XTREAM.user}&password=${XTREAM.pass}&action=get_live_categories`);
  allCategories = d || [];
}

async function fetchChannels() {
  const l = document.getElementById('channelList'); if(l) l.innerHTML = '<div class="channel-loading"><i class="fas fa-spinner fa-spin"></i></div>';
  const d = await xtreamFetch(`/player_api.php?username=${XTREAM.user}&password=${XTREAM.pass}&action=get_live_streams`);
  allChannels = d || []; displayedCount = 0; renderChannels(true);
}

async function fetchVodCategories() {
  const d = await xtreamFetch(`/player_api.php?username=${XTREAM.user}&password=${XTREAM.pass}&action=get_vod_categories`);
  vodCategories = d || []; renderVodCategories();
}

async function fetchSeriesCategories() {
  const d = await xtreamFetch(`/player_api.php?username=${XTREAM.user}&password=${XTREAM.pass}&action=get_series_categories`);
  seriesCategories = d || []; renderSeriesCategories();
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
  const c = document.getElementById('catPills'); if (!c) return;
  const groups = {};
  allCategories.forEach(cat => {
    const name = clean(cat.category_name);
    const g = getGroup(name);
    if (!groups[g]) groups[g] = [];
    groups[g].push({ id: cat.category_id, name: name });
  });
  let html = `<div class="cat-pill active" onclick="switchChannelCat('all',this)">📺 <span data-fr="Tous" data-en="All">Tous</span> <span class="cpill-count">(${allChannels.length})</span></div>`;
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
  if (activeCat !== 'all') {
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

  if (filtered.length === 0 && reset) { list.innerHTML = `<div class="channel-empty"><i class="fas fa-search"></i><p>${currentLang==='fr'?'Aucune chaîne':'No channels'}</p></div>`; updateCount(0); return; }

  const html = page.map(ch => {
    const idx = allChannels.indexOf(ch); const isActive = currentChannelIndex === idx;
    const logo = ch.stream_icon ? `<img src="${ch.stream_icon}" loading="lazy" onerror="this.parentElement.innerHTML='<span>${ch.name.charAt(0).toUpperCase()}</span>'">` : `<span>${ch.name.charAt(0).toUpperCase()}</span>`;
    const catName = clean(getCatName(ch.category_id)).substring(0,22);
    return `<div class="channel-item ${isActive?'active':''}" onclick="playChannel(${idx})"><div class="ch-logo">${logo}</div><div class="ch-info"><div class="ch-name">${ch.name}</div><div class="ch-meta"><span class="ch-cat">${catName}</span><span class="ch-live"><span class="dot"></span>LIVE</span></div></div></div>`;
  }).join('');
  list.insertAdjacentHTML('beforeend', html);
  if (displayedCount < filtered.length) { const rem = filtered.length - displayedCount; const btn = document.createElement('div'); btn.className = 'channel-loadmore'; btn.textContent = `+ ${Math.min(PAGE_SIZE,rem)} ${currentLang==='fr'?'de plus':'more'}`; btn.onclick = () => { btn.remove(); renderChannels(false); }; list.appendChild(btn); }
  updateCount(filtered.length);
}

function getCatName(id) { const c = allCategories.find(x=>String(x.category_id)===String(id)); return c?c.category_name:''; }
function updateCount(n) { const e = document.getElementById('channelCount'); if(e) e.textContent = `${n} ch.`; }

// ===== VOD =====
async function loadVodStreams(catId) {
  const list = document.getElementById('channelList'); if(list) list.innerHTML = '<div class="channel-loading"><i class="fas fa-spinner fa-spin"></i></div>';
  const d = await xtreamFetch(`/player_api.php?username=${XTREAM.user}&password=${XTREAM.pass}&action=get_vod_streams&category_id=${catId}`);
  currentVodStreams = d || []; displayedCount = 0; renderVodStreams(true);
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

function filterVod() { const q = (document.getElementById('vodSearch')||{}).value||''; if(!q){renderVodStreams(true);return;} const f = currentVodStreams.filter(v=>v.name.toLowerCase().includes(q.toLowerCase())); displayedCount=0; const list=document.getElementById('channelList'); if(!list)return; list.innerHTML=''; const html=f.slice(0,PAGE_SIZE).map(v=>{const logo=v.stream_icon?`<img src="${v.stream_icon}" loading="lazy" onerror="this.parentElement.innerHTML='<span>🎬</span>'">`:'<span>🎬</span>';return `<div class="channel-item vod-item" onclick="playVod(${v.stream_id},'${v.container_extension||'mp4'}')"><div class="ch-logo">${logo}</div><div class="ch-info"><div class="ch-name">${v.name}</div><div class="ch-meta"><span class="ch-cat">🎬 Movie</span></div></div></div>`;}).join(''); list.innerHTML=html||`<div class="channel-empty"><i class="fas fa-search"></i><p>${currentLang==='fr'?'Aucun film':'No movies'}</p></div>`; updateCount(f.length); }

// ===== SERIES =====
async function loadSeriesList(catId) {
  const list = document.getElementById('channelList'); if(list) list.innerHTML = '<div class="channel-loading"><i class="fas fa-spinner fa-spin"></i></div>';
  const d = await xtreamFetch(`/player_api.php?username=${XTREAM.user}&password=${XTREAM.pass}&action=get_series&category_id=${catId}`);
  currentSeriesList = d || []; displayedCount = 0; renderSeriesList(true);
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

function filterSeries() { const q = (document.getElementById('seriesSearch')||{}).value||''; if(!q){renderSeriesList(true);return;} const f = currentSeriesList.filter(s=>s.name.toLowerCase().includes(q.toLowerCase())); displayedCount=0; const list=document.getElementById('channelList'); if(!list)return; list.innerHTML=''; const html=f.slice(0,PAGE_SIZE).map(s=>{const logo=s.cover?`<img src="${s.cover}" loading="lazy" onerror="this.parentElement.innerHTML='<span>📺</span>'">`:'<span>📺</span>';return `<div class="channel-item vod-item" onclick="loadSeriesEpisodes(${s.series_id})"><div class="ch-logo">${logo}</div><div class="ch-info"><div class="ch-name">${s.name}</div><div class="ch-meta"><span class="ch-cat">📺 Series</span></div></div></div>`;}).join(''); list.innerHTML=html||`<div class="channel-empty"><i class="fas fa-search"></i><p>${currentLang==='fr'?'Aucune série':'No series'}</p></div>`; updateCount(f.length); }

async function loadSeriesEpisodes(seriesId) {
  const list = document.getElementById('channelList'); if(list) list.innerHTML = '<div class="channel-loading"><i class="fas fa-spinner fa-spin"></i></div>';
  const d = await xtreamFetch(`/player_api.php?username=${XTREAM.user}&password=${XTREAM.pass}&action=get_series_info&series_id=${seriesId}`);
  if (!d) { list.innerHTML = '<div class="channel-empty"><p>Error</p></div>'; return; }
  currentSeriesEpisodes = [];
  if (d.episodes) { if (typeof d.episodes === 'object') { Object.keys(d.episodes).forEach(s=>d.episodes[s].forEach(e=>currentSeriesEpisodes.push({...e,season:s}))); } else if (Array.isArray(d.episodes)) { d.episodes.forEach(e=>currentSeriesEpisodes.push(e)); } }
  displayedCount = 0; renderEpisodes(true);
}

function renderEpisodes(reset = false) {
  const list = document.getElementById('channelList'); if (!list) return;
  if (reset) { list.innerHTML = ''; const b = document.createElement('div'); b.className='vod-back-btn'; b.innerHTML='<i class="fas fa-arrow-left"></i> Back'; b.onclick=()=>{displayedCount=0;renderSeriesList(true);}; list.appendChild(b); displayedCount=0; }
  if (currentSeriesEpisodes.length === 0 && reset) { list.innerHTML = `<div class="channel-empty"><i class="fas fa-tv"></i><p>${currentLang==='fr'?'Aucun épisode':'No episodes'}</p></div>`; return; }
  const start = displayedCount; const end = Math.min(start + PAGE_SIZE, currentSeriesEpisodes.length);
  const page = currentSeriesEpisodes.slice(start, end); displayedCount = end;
  const html = page.map(ep => { const t = ep.title||`S${ep.season||'?'}E${ep.episode_num||'?'}`; return `<div class="channel-item vod-item" onclick="playEpisode(${ep.id},'${ep.container_extension||'mp4'}')"><div class="ch-logo"><span>▶</span></div><div class="ch-info"><div class="ch-name">${t}</div><div class="ch-meta"><span class="ch-cat">📺 Episode</span></div></div></div>`; }).join('');
  list.insertAdjacentHTML('beforeend', html);
  if (displayedCount < currentSeriesEpisodes.length) { const rem = currentSeriesEpisodes.length - displayedCount; const btn = document.createElement('div'); btn.className = 'channel-loadmore'; btn.textContent = `+ ${Math.min(PAGE_SIZE,rem)} more`; btn.onclick = () => { btn.remove(); renderEpisodes(false); }; list.appendChild(btn); }
}

// ===== PLAYER =====
function liveUrl(id) { return `${XTREAM.host}/live/${XTREAM.user}/${XTREAM.pass}/${id}.m3u8`; }
function vodUrl(id, ext) { return `${XTREAM.host}/movie/${XTREAM.user}/${XTREAM.pass}/${id}.${ext||'mp4'}`; }
function epUrl(id, ext) { return `${XTREAM.host}/series/${XTREAM.user}/${XTREAM.pass}/${id}.${ext||'mp4'}`; }

function initPlayer() {
  const el = document.getElementById('streamPlayer'); if (!el || typeof videojs === 'undefined') return;
  player = videojs('streamPlayer', { html5: { vhs: { overrideNative: true }, nativeAudioTracks: false, nativeVideoTracks: false }, responsive: true, fluid: true, liveui: true, controlBar: { volumePanel: { inline: false } } });
}

function playChannel(index) {
  const ch = allChannels[index]; if (!ch || !player) return;
  currentChannelIndex = index; document.getElementById('playerOverlay')?.classList.add('hidden');
  const np = document.getElementById('nowPlayingChannel'); if(np) np.textContent = ch.name;
  player.src({ src: liveUrl(ch.stream_id), type: 'application/x-mpegURL' }); player.play().catch(()=>{});
  document.querySelectorAll('#channelList .channel-item').forEach((el,i)=>el.classList.toggle('active',i===index));
  if (window.innerWidth < 768) document.getElementById('player')?.scrollIntoView({behavior:'smooth',block:'start'});
}

function playVod(id, ext) {
  if (!player) return; document.getElementById('playerOverlay')?.classList.add('hidden');
  const np = document.getElementById('nowPlayingChannel'); if(np) np.textContent = '🎬 VOD';
  player.src({ src: vodUrl(id, ext), type: 'video/mp4' }); player.play().catch(()=>{});
}

function playEpisode(id, ext) {
  if (!player) return; document.getElementById('playerOverlay')?.classList.add('hidden');
  const np = document.getElementById('nowPlayingChannel'); if(np) np.textContent = '📺 Episode';
  player.src({ src: epUrl(id, ext), type: 'video/mp4' }); player.play().catch(()=>{});
}

function togglePiP() { const v = document.querySelector('#streamPlayer video')||document.getElementById('streamPlayer'); if(v&&document.pictureInPictureEnabled){if(document.pictureInPictureElement)document.exitPictureInPicture();else v.requestPictureInPicture().catch(()=>{});} }
function toggleFullscreen() { if(player) player.isFullscreen()?player.exitFullscreen():player.requestFullscreen(); }

// ===== TABS =====
function switchPlayerTab(tab, btn) {
  activeTab = tab; document.querySelectorAll('.player-tab').forEach(t=>t.classList.remove('active')); if(btn) btn.classList.add('active');
  document.getElementById('livePanel').classList.toggle('hidden', tab!=='live');
  document.getElementById('moviesPanel').classList.toggle('hidden', tab!=='movies');
  document.getElementById('seriesPanel').classList.toggle('hidden', tab!=='series');
  const list = document.getElementById('channelList');
  if (tab==='live') { displayedCount=0; renderChannels(true); }
  else if (tab==='movies') { if(list) list.innerHTML=`<div class="channel-empty"><i class="fas fa-film"></i><p>${currentLang==='fr'?'Sélectionnez une catégorie de films':'Select a movie category'}</p></div>`; }
  else if (tab==='series') { if(list) list.innerHTML=`<div class="channel-empty"><i class="fas fa-tv"></i><p>${currentLang==='fr'?'Sélectionnez une catégorie de séries':'Select a series category'}</p></div>`; }
}

function switchChannelCat(id, pill) {
  activeCat = id; displayedCount = 0;
  document.querySelectorAll('.cat-pill').forEach(p=>p.classList.remove('active'));
  if (pill) pill.classList.add('active');
  renderChannels(true);
}

function filterChannels() { const i = document.getElementById('channelSearch'); searchQuery = i ? i.value.trim() : ''; displayedCount = 0; renderChannels(true); }

// ===== LANGUAGE =====
function setLang(lang) {
  currentLang=lang; localStorage.setItem('lang',lang);
  document.querySelectorAll('.lang-switcher button').forEach(b=>b.classList.toggle('active',b.textContent.toLowerCase()===lang));
  document.querySelectorAll('[data-fr][data-en]').forEach(el=>{ const t=el.getAttribute(`data-${lang}`); if(t) el.tagName==='INPUT'||el.tagName==='TEXTAREA'?el.placeholder=t:el.innerHTML=t; });
  document.documentElement.lang=lang; renderCatPills(); renderChannels(true);
}

// ===== NAVBAR / FAQ / TUTORIALS / SCROLL / ANIMATIONS =====
function initNavbar() { const n=document.getElementById('navbar'); if(n) window.addEventListener('scroll',()=>n.classList.toggle('scrolled',window.scrollY>50)); }
function toggleMobileNav() { const n=document.getElementById('mobileNav'); if(n) n.classList.toggle('open'); }
function toggleFaq(btn) { const item=btn.parentElement; const a=item.classList.contains('active'); document.querySelectorAll('.faq-item').forEach(f=>f.classList.remove('active')); if(!a) item.classList.add('active'); }
function switchTutorial(id,btn) { document.querySelectorAll('.tutorial-content').forEach(c=>c.classList.remove('active')); document.querySelectorAll('.tutorial-tab').forEach(t=>t.classList.remove('active')); const t=document.getElementById('tutorial-'+id); if(t) t.classList.add('active'); if(btn) btn.classList.add('active'); }
function initAnimations() { const o=new IntersectionObserver((e)=>e.forEach(x=>{if(x.isIntersecting){x.target.classList.add('visible');o.unobserve(x.target);}}),{threshold:0.1,rootMargin:'0px 0px -50px 0px'}); document.querySelectorAll('.animate-in').forEach(el=>o.observe(el)); setTimeout(()=>document.querySelectorAll('.animate-in').forEach(el=>el.classList.add('visible')),2000); }
function initSmoothScroll() { document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',function(e){const t=document.querySelector(this.getAttribute('href'));if(t){e.preventDefault();window.scrollTo({top:t.getBoundingClientRect().top+window.scrollY-80,behavior:'smooth'});}})); }
function initActiveNav() { const s=document.querySelectorAll('section[id]'); window.addEventListener('scroll',()=>{let c='';s.forEach(x=>{if(window.scrollY>=x.offsetTop-100)c=x.getAttribute('id');});document.querySelectorAll('.nav-links a').forEach(l=>l.classList.toggle('active',l.getAttribute('href')===`#${c}`));}); }
function handleSubmit(e) { e.preventDefault(); const d=new FormData(e.target); let m='📋 *Nouvelle commande StreamVision IPTV*\n\n'; for(let[k,v] of d.entries()) if(v) m+=`*${k}*: ${v}\n`; window.open(`https://wa.me/212630463227?text=${encodeURIComponent(m)}`,'_blank'); alert(currentLang==='fr'?'✅ Merci !':'✅ Thank you!'); }

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  setLang(currentLang); initNavbar(); initAnimations(); initSmoothScroll(); initActiveNav();
  await fetchCategories();
  await fetchChannels();
  await fetchVodCategories();
  await fetchSeriesCategories();
  renderCatPills();
  if(typeof videojs!=='undefined') initPlayer(); else window.addEventListener('load',initPlayer);
});
