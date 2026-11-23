// Gurbani Tag Seva Project — fixed copy of readgurbani.com/js/katha.js
// FIX: the original parser assumed fixed columns [id, uid, line, is_mainline, shabad_id, gurmukhi].
// The current readgurbani CSVs have extra is_heading columns (1 on most Angs, 3 on Ang 1),
// so 'gurmukhi' is no longer at index 5 and the original site renders no Gurbani text.
// This version reads the gurmukhi + uid columns BY HEADER NAME, so any column layout works.
// Also: https:// for Sehaj Paath audio (http:// is blocked as mixed content on https pages),
// and graceful handling when an Ang has no Katha track file.
const trackSelect = document.getElementById('trackSelect');
const linesTableBody = document.querySelector('#linesTable tbody');
const audioPlayer = document.getElementById('audioPlayer');
const exportTaggedBtn = document.getElementById('exportTagged');
const exportFlatBtn = document.getElementById('exportFlat');
const pageInput = document.getElementById('pageInput');
const loadPageBtn = document.getElementById('loadPageBtn');

let currentAng = 1;
let currentTrackId = 1;
let currentAngLinesStart = 0;
let currentAngLines = 0;
let lines = [];        // normalized rows: {uid, gurmukhi}
let timestamps = {};   // { uid: [seconds] }
let gurbani = {};      // {uid: gurmukhi}
let audioUrls = [];
let isKatha = true;

const audioSourceSelect = document.getElementById('audioSourceSelect');

audioSourceSelect.addEventListener('change', function () {
  isKatha = this.value === 'katha';
});

function loadPage(ang) {
  currentAng = ang;
  timestamps = {};
  lines = [];
  gurbani = {};
  isKatha = audioSourceSelect.value === 'katha';
  let angsToLoad = [];
  if (!isKatha) {
    angsToLoad = [ang];
  } else if (ang > 1 && ang < 1430) {
    angsToLoad = [ang - 1, ang, ang + 1];
  } else if (ang === 1) {
    angsToLoad = [ang, ang + 1];
  } else if (ang === 1430) {
    angsToLoad = [ang - 1, ang];
  } else {
    return;
  }
  const fetchPromises = angsToLoad.map(a =>
    fetch(`data/sggs/gurbani/${a}.csv`)
      .then(r => r.ok ? r.text() : '')
      .then(text => parseGurbaniTSV(text))
  );

  Promise.all(fetchPromises).then(results => {
    if (isKatha) {
      if (results.length === 3) {
        currentAngLinesStart = results[0].length;
        currentAngLines = results[1].length;
      } else if (currentAng === 1 && results.length === 2) {
        currentAngLinesStart = 0;
        currentAngLines = results[0].length;
      } else if (currentAng === 1430 && results.length === 2) {
        currentAngLinesStart = results[0].length;
        currentAngLines = results[1].length;
      }
    }
    lines = results.flat();
    renderTable();
  });

  if (isKatha) {
    fetch(`data/sggs/katha/katha_${ang}.csv`)
      .then(r => r.ok ? r.text() : '')
      .then(text => {
        audioUrls = text.trim() ? parseKathaTSV(text) : [];
        populateKathaTrackDropdown();
      })
      .catch(() => { audioUrls = []; populateKathaTrackDropdown(); });
  } else {
    populateSehajPaathDropdown();
  }
}

// Parse a gurbani CSV by header name: returns [{uid, gurmukhi}]
function parseGurbaniTSV(text) {
  if (!text || !text.trim()) return [];
  const rows = text.trim().split('\n');
  const header = rows[0].split('\t').map(h => h.trim());
  const uidIdx = header.indexOf('uid');
  const gurbaniIdx = header.indexOf('gurmukhi');
  if (uidIdx === -1 || gurbaniIdx === -1) return [];
  return rows.slice(1)
    .map(line => line.split('\t'))
    .filter(cols => cols[uidIdx] && cols[gurbaniIdx])
    .map(cols => ({ uid: cols[uidIdx], gurmukhi: cols[gurbaniIdx] }));
}

// Parse a katha CSV (header: id, url): returns [[id, url], ...]
function parseKathaTSV(text) {
  const rows = text.trim().split('\n');
  return rows.slice(1)
    .map(line => line.split('\t'))
    .filter(cols => cols.length >= 2 && cols[1]);
}

function renderTable() {
  linesTableBody.innerHTML = '';
  lines.forEach(({ uid, gurmukhi }, index) => {
    gurbani[uid] = gurmukhi;
    const tr = document.createElement('tr');
    if (isKatha && index >= currentAngLinesStart && index < currentAngLinesStart + currentAngLines) {
      tr.classList.add('mainAng');
    }
    const tdUid = document.createElement('td');
    tdUid.textContent = uid;
    const tdG = document.createElement('td');
    tdG.textContent = gurmukhi;
    const tdActions = document.createElement('td');
    const tagBtn = document.createElement('button');
    tagBtn.id = 'tagTimestamp';
    tagBtn.textContent = 'Tag';
    tagBtn.addEventListener('click', () => tagTimestamp(uid));
    const undoBtn = document.createElement('button');
    undoBtn.id = 'removeTimestamp';
    undoBtn.textContent = 'Undo';
    undoBtn.addEventListener('click', () => removeLastTimestamp(uid));
    tdActions.append(tagBtn, undoBtn);
    const tdRaw = document.createElement('td');
    tdRaw.className = 'timestamps';
    tdRaw.dataset.uid = uid;
    const tdHuman = document.createElement('td');
    tdHuman.className = 'human-timestamps';
    tdHuman.dataset.uid = uid;
    tr.append(tdUid, tdG, tdActions, tdRaw, tdHuman);
    tr.setAttribute('data-uid', uid);
    linesTableBody.appendChild(tr);
  });
}

function populateKathaTrackDropdown() {
  trackSelect.innerHTML = '';
  if (!audioUrls.length) {
    const opt = document.createElement('option');
    opt.textContent = 'No Katha tracks for this Ang';
    trackSelect.appendChild(opt);
    trackSelect.disabled = true;
    audioPlayer.removeAttribute('src');
    return;
  }
  audioUrls.forEach(([id, url], index) => {
    const opt = document.createElement('option');
    opt.value = `${url}|${id}`;
    opt.textContent = `${index + 1}: Track #${id}`;
    trackSelect.appendChild(opt);
  });
  trackSelect.disabled = audioUrls.length === 1;
  const firstTrack = audioUrls[0];
  loadKathaAudio(`${firstTrack[1]}|${firstTrack[0]}`);
  trackSelect.onchange = () => loadKathaAudio(trackSelect.value);
}

function populateSehajPaathDropdown() {
  trackSelect.innerHTML = '';
  const opt = document.createElement('option');
  opt.value = `${currentAng}`;
  opt.textContent = `Ang ${currentAng}`;
  trackSelect.appendChild(opt);
  trackSelect.disabled = true;
  loadSehajPaathAudio();
}

function loadKathaAudio(data) {
  const trackData = data.split('|');
  const endpoint = trackData[0];
  const trackId = trackData[1];
  currentTrackId = trackId;
  const base_url = 'https://www.gurmatveechar.com/audios';
  const path = '/Katha/01_Puratan_Katha/Sant_Gurbachan_Singh_%28Bhindran_wale%29/Guru_Granth_Sahib_Larivaar_Katha/';
  currentAudioUrl = `${base_url}${path}${endpoint}.mp3`;
  if (typeof localBoostMode !== 'undefined' && localBoostMode) {
    setBoostStatus('Boost mode ON hai — nava track sunan layi pehle usdi file download karke load karo, ja "Exit boost mode" dabao.');
    return;
  }
  audioPlayer.src = currentAudioUrl;
  audioPlayer.load();
}

function loadSehajPaathAudio() {
  currentTrackId = currentAng;
  const ang = String(currentAng).padStart(4, '0');
  const base_url = 'https://media.gursevak.com/media/';
  const path = 'Sehaj_Paath_Pagewise/Sehaj_Paath_16kbps/';
  currentAudioUrl = `${base_url}${path}${ang}.mp3`;
  if (typeof localBoostMode !== 'undefined' && localBoostMode) {
    setBoostStatus('Boost mode ON hai — nava track sunan layi pehle usdi file download karke load karo, ja "Exit boost mode" dabao.');
    return;
  }
  audioPlayer.src = currentAudioUrl;
  audioPlayer.load();
}

function tagTimestamp(uid) {
  const time = audioPlayer.currentTime;
  if (!timestamps[uid]) timestamps[uid] = [];
  if (!isKatha && timestamps[uid].length > 0) {
    return;
  }
  timestamps[uid].push(time);
  updateTimestampDisplay(uid);
  showTooltip(time, gurbani[uid]);
}

function removeLastTimestamp(uid) {
  if (timestamps[uid]?.length > 0) {
    timestamps[uid].pop();
    updateTimestampDisplay(uid);
  }
}

function updateTimestampDisplay(uid) {
  const raw = (timestamps[uid] || []).map(t => t.toFixed(3)).join(';');
  const human = (timestamps[uid] || []).map(secondsToHMS).join(';');
  const rawEl = document.querySelector(`.timestamps[data-uid="${uid}"]`);
  const humanEl = document.querySelector(`.human-timestamps[data-uid="${uid}"]`);
  if (rawEl) rawEl.textContent = raw;
  if (humanEl) humanEl.textContent = human;
  resetTooltips();
}

function secondsToHMS(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function exportTagged() {
  let output = `uid\tgurmukhi\tang\ttrack_id\ttimestamp\tformatted_timestamp\n`;
  lines.forEach(({ uid, gurmukhi }) => {
    const raw = (timestamps[uid] || []).map(t => t.toFixed(3)).join(';');
    const human = (timestamps[uid] || []).map(secondsToHMS).join(';');
    if (!raw) return;
    output += `${uid}\t${gurmukhi}\t${currentAng}\t${currentTrackId}\t${raw}\t${human}\n`;
  });
  const trackNum = trackSelect.selectedIndex + 1;
  downloadTSV(output, `ang_${currentAng}_track_${trackNum}_tagged.csv`);
}

function exportFlat() {
  let output = 'timestamp\tuid\ttrack_id\n';
  Object.entries(timestamps).forEach(([uid, arr]) => {
    arr.forEach(time => {
      output += `${time.toFixed(3)}\t${uid}\t${currentTrackId}\n`;
    });
  });
  downloadTSV(output, `track_${currentTrackId}_flat.csv`);
}

function downloadTSV(data, filename) {
  const blob = new Blob([data], { type: 'text/tab-separated-values' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function showTooltip(time, text) {
  const marker = document.createElement('div');
  marker.className = 'tooltip-marker';
  const tooltip = document.createElement('div');
  const timeString = secondsToHMS(time);
  tooltip.className = 'custom-tooltip';
  tooltip.textContent = `${timeString} - ${text}`;
  marker.title = time;
  marker.appendChild(tooltip);
  const bar = document.querySelector('.progress');
  const duration = audioPlayer.duration || 1;
  const percent = (time / duration) * 100;
  marker.style.left = `${percent}%`;
  bar.appendChild(marker);
}

function resetTooltips() {
  document.querySelectorAll('.tooltip-marker').forEach(el => el.remove());
  Object.entries(timestamps).forEach(([uid, arr]) => {
    arr.forEach(t => {
      showTooltip(t, gurbani[uid]);
    });
  });
}

audioPlayer.addEventListener('loadedmetadata', () => {
  resetTooltips();
});

let lastHighlighted = null;

audioPlayer.addEventListener('timeupdate', () => {
  const currentTime = audioPlayer.currentTime;
  let closestUID = null;
  let closestTime = -1;

  for (const [uid, times] of Object.entries(timestamps)) {
    for (const t of times) {
      if (t <= currentTime && t > closestTime) {
        closestTime = t;
        closestUID = uid;
      }
    }
  }

  if (closestUID !== lastHighlighted) {
    if (lastHighlighted) {
      const oldRow = document.querySelector(`tr[data-uid="${lastHighlighted}"]`);
      if (oldRow) oldRow.classList.remove('highlight');
    }
    const newRow = document.querySelector(`tr[data-uid="${closestUID}"]`);
    if (newRow) newRow.classList.add('highlight');
    lastHighlighted = closestUID;
  }
});

loadPageBtn.onclick = () => {
  const ang = parseInt(pageInput.value);
  if (!isNaN(ang) && ang >= 1 && ang <= 1430) {
    loadPage(ang);
  }
};

document.getElementById('uploadTags').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  const rows = text.trim().split('\n');
  timestamps = {};
  for (const line of rows) {
    const [timeStr, uid, trackId] = line.split('\t');
    const time = parseFloat(timeStr);
    if (!isNaN(time) && trackId == currentTrackId) {
      if (!timestamps[uid]) timestamps[uid] = [];
      timestamps[uid].push(time);
      updateTimestampDisplay(uid);
    }
  }
  resetTooltips();
});

exportTaggedBtn.onclick = exportTagged;
exportFlatBtn.onclick = exportFlat;
// ---------- Volume Booster (VLC style, 100%–300%) — OUR-SIDE method ----------
// The audio sites give the browser no permission to touch their stream
// (verified live: fetch is CORS-blocked, no-cors downloads are unreadable,
// Web Audio routing of the stream is silently zeroed). So boost works on
// a FULLY DOWNLOADED LOCAL FILE instead — the stream is never touched:
//   1. Download the track with the audio player's own ⋮ menu (Download).
//   2. Load that file here with the file button (it never leaves the device).
//   3. The local file plays through a Web Audio gain chain: 100%–300%.
// Tagging, exports etc. work exactly the same in boost mode.
let currentAudioUrl = '';
let boostCtx = null;
let boostGain = null;
let boostChainBuilt = false;
let localBoostMode = false;

const boostSlider = document.getElementById('boostSlider');
const boostLabel = document.getElementById('boostLabel');
const boostStatus = document.getElementById('boostStatus');
const boostReset = document.getElementById('boostReset');
const boostFileBtn = document.getElementById('boostFileBtn');
const boostFileInput = document.getElementById('boostFileInput');
const boostExitBtn = document.getElementById('boostExitBtn');

function setBoostStatus(msg) { if (boostStatus) boostStatus.textContent = msg; }

function buildBoostChain() {
  if (boostChainBuilt) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try {
    boostCtx = new AC();
    const srcNode = boostCtx.createMediaElementSource(audioPlayer);
    boostGain = boostCtx.createGain();
    const comp = boostCtx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 8;
    srcNode.connect(boostGain);
    boostGain.connect(comp);
    comp.connect(boostCtx.destination);
    boostChainBuilt = true;
    return true;
  } catch (e) {
    return false;
  }
}

async function applyBoost() {
  const pct = parseInt(boostSlider.value, 10);
  boostLabel.textContent = `${pct}%`;
  if (localBoostMode) {
    if (boostCtx && boostCtx.state === 'suspended') await boostCtx.resume();
    if (boostGain) boostGain.gain.value = pct / 100;
    setBoostStatus(pct > 100 ? `Boost active: ${pct}% (local file)` : 'Local file loaded — boost 100% (normal)');
    return;
  }
  if (pct <= 100) { setBoostStatus(''); return; }
  // MEGA-style: download the FULL track inside the browser (nothing lands
  // in the Downloads folder, the stream site is never touched by the
  // player), then play the local copy through the boost chain.
  if (boostBusy || !currentAudioUrl) return;
  boostBusy = true;
  try {
    const blob = await downloadTrackInBrowser(currentAudioUrl);
    loadLocalTrackBlob(blob, 'downloaded track');
    if (boostGain) boostGain.gain.value = pct / 100;
    setBoostStatus(`Boost active: ${pct}% — track browser vich hi download ho gaya, hun local play ho reha hai.`);
  } catch (e) {
    boostSlider.value = 100;
    boostLabel.textContent = '100%';
    setBoostStatus('In-browser download fail ho gaya (' + e.message + '). Dooja tareeka: player de ⋮ menu ton track Download karke "Load downloaded track" naal file select karo — boost phir vi lag jayega.');
  }
  boostBusy = false;
}

let boostBusy = false;

// Full-track download that stays inside the browser. The audio hosts send
// no CORS headers, so the file is fetched through a CORS relay
// (api.cors.lol) purely as a download pipe — the relay only sees a file
// request, the audio stream/player is untouched. Downloaded tracks are
// kept in the browser's Cache Storage so the same track never downloads
// twice.
async function downloadTrackInBrowser(url) {
  const cacheName = 'tagseva-boost-v1';
  try {
    const cache = await caches.open(cacheName);
    const hit = await cache.match(url);
    if (hit) {
      const b = await hit.blob();
      if (b.size > 50000) { setBoostStatus('Track cache vicho mil gaya — boost lag reha hai…'); return b; }
    }
  } catch (e) { /* cache unavailable — download fresh */ }
  setBoostStatus('Track browser vich download ho reha hai… 0%');
  const resp = await fetch('https://api.cors.lol/?url=' + encodeURIComponent(url));
  if (!resp.ok) throw new Error('relay HTTP ' + resp.status);
  const total = parseInt(resp.headers.get('content-length') || '0', 10);
  let blob;
  if (resp.body && total > 0) {
    const reader = resp.body.getReader();
    const chunks = [];
    let got = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.length;
      setBoostStatus(`Track browser vich download ho reha hai… ${Math.round(got / total * 100)}%`);
    }
    blob = new Blob(chunks, { type: 'audio/mpeg' });
  } else {
    blob = await resp.blob();
  }
  if (!blob || blob.size < 50000) throw new Error('file puri nahi aayi');
  try {
    const cache = await caches.open(cacheName);
    await cache.put(url, new Response(blob, { headers: { 'Content-Type': 'audio/mpeg' } }));
  } catch (e) { /* caching is a bonus, not required */ }
  return blob;
}

function loadLocalTrackBlob(blob, label) {
  const wasPlaying = !audioPlayer.paused;
  const resumeAt = audioPlayer.currentTime || 0;
  const blobUrl = URL.createObjectURL(blob);
  // Build the gain chain ONLY while a local (blob) file is the source —
  // a blob is same-origin, so Web Audio can boost it safely.
  audioPlayer.src = blobUrl;
  audioPlayer.load();
  if (!buildBoostChain()) {
    setBoostStatus('Is browser vich Web Audio support nahi — boost nahi lag sakda.');
    return;
  }
  localBoostMode = true;
  if (boostExitBtn) boostExitBtn.style.display = '';
  audioPlayer.addEventListener('loadedmetadata', () => {
    try { if (resumeAt > 0) audioPlayer.currentTime = resumeAt; } catch (e) {}
    const pct = parseInt(boostSlider.value, 10);
    if (boostGain) boostGain.gain.value = pct / 100;
    if (wasPlaying) audioPlayer.play().catch(() => {});
  }, { once: true });
  setBoostStatus(`Local track ready (${label}) — boost hun lag sakda hai.`);
}

function loadLocalTrackFile(file) {
  if (!file) return;
  loadLocalTrackBlob(file, file.name);
}

if (boostSlider) {
  boostSlider.addEventListener('input', applyBoost);
  boostReset.addEventListener('click', () => { boostSlider.value = 100; applyBoost(); });
  boostFileBtn.addEventListener('click', () => boostFileInput.click());
  boostFileInput.addEventListener('change', () => loadLocalTrackFile(boostFileInput.files[0]));
  boostExitBtn.addEventListener('click', () => location.reload());
}
