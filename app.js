'use strict';

// All composite definitions. JS generates the DOM for each.
// Photos draw first; frame PNG overlays on top (transparent center reveals photos).
const VUONG_FRAME = 'assets/khung-vuong.png';
const X34_FRAME = 'assets/khung-3x4.png';
const FULL_SLOT = { x: 0, y: 0, w: 1, h: 1, cssLeft: '0%', cssTop: '0%', cssWidth: '100%', cssHeight: '100%', label: 'Ảnh' };

// Helper to build single-image specs (1 slot covering whole canvas)
function single(canvasW, canvasH, frame, title) {
  return {
    canvas: { w: canvasW, h: canvasH },
    framePath: frame,
    title,
    aspectRatio: `${canvasW} / ${canvasH}`,
    slots: {
      full: { x: 0, y: 0, w: canvasW, h: canvasH, cssLeft: '0%', cssTop: '0%', cssWidth: '100%', cssHeight: '100%', label: '' },
    },
  };
}

const SLOT_COORDS = {
  // === Group: composites (1 large + 2 small) ===
  'vuong': {
    group: 'composite', canvas: { w: 1000, h: 1000 }, framePath: VUONG_FRAME,
    title: 'Vuông có khung', subtitle: '1000×1000', aspectRatio: '1 / 1',
    slots: {
      large:    { x: 330, y:   0, w: 670, h: 1000, cssLeft: '33%', cssTop: '0%',  cssWidth: '67%', cssHeight: '100%', label: 'Lớn' },
      smallTop: { x:   0, y:   0, w: 330, h:  500, cssLeft: '0%',  cssTop: '0%',  cssWidth: '33%', cssHeight: '50%',  label: 'Trên' },
      smallBot: { x:   0, y: 500, w: 330, h:  500, cssLeft: '0%',  cssTop: '50%', cssWidth: '33%', cssHeight: '50%',  label: 'Dưới' },
    },
  },
  '3x4': {
    group: 'composite', canvas: { w: 1200, h: 1600 }, framePath: X34_FRAME,
    title: '3:4 có khung', subtitle: '1200×1600', aspectRatio: '3 / 4',
    slots: {
      large:    { x: 400, y:   0, w: 800, h: 1600, cssLeft: '33.333%', cssTop: '0%',  cssWidth: '66.666%', cssHeight: '100%', label: 'Lớn' },
      smallTop: { x:   0, y:   0, w: 400, h:  800, cssLeft: '0%',      cssTop: '0%',  cssWidth: '33.333%', cssHeight: '50%',  label: 'Trên' },
      smallBot: { x:   0, y: 800, w: 400, h:  800, cssLeft: '0%',      cssTop: '50%', cssWidth: '33.333%', cssHeight: '50%',  label: 'Dưới' },
    },
  },
  'vuong-plain': {
    group: 'composite', canvas: { w: 1000, h: 1000 }, framePath: null,
    title: 'Vuông không khung', subtitle: '1000×1000', aspectRatio: '1 / 1',
    slots: {
      large:    { x: 330, y:   0, w: 670, h: 1000, cssLeft: '33%', cssTop: '0%',  cssWidth: '67%', cssHeight: '100%', label: 'Lớn' },
      smallTop: { x:   0, y:   0, w: 330, h:  500, cssLeft: '0%',  cssTop: '0%',  cssWidth: '33%', cssHeight: '50%',  label: 'Trên' },
      smallBot: { x:   0, y: 500, w: 330, h:  500, cssLeft: '0%',  cssTop: '50%', cssWidth: '33%', cssHeight: '50%',  label: 'Dưới' },
    },
  },

  // === Group: 4 single vuông (1 photo per frame) ===
  'vuong-s1': { group: 'single-vuong', ...single(1000, 1000, VUONG_FRAME, 'Vuông 1') },
  'vuong-s2': { group: 'single-vuong', ...single(1000, 1000, VUONG_FRAME, 'Vuông 2') },
  'vuong-s3': { group: 'single-vuong', ...single(1000, 1000, VUONG_FRAME, 'Vuông 3') },
  'vuong-s4': { group: 'single-vuong', ...single(1000, 1000, VUONG_FRAME, 'Vuông 4') },

  // === Group: 4 single 3:4 (1 photo per frame) ===
  '3x4-s1': { group: 'single-3x4', ...single(1200, 1600, X34_FRAME, '3:4 #1') },
  '3x4-s2': { group: 'single-3x4', ...single(1200, 1600, X34_FRAME, '3:4 #2') },
  '3x4-s3': { group: 'single-3x4', ...single(1200, 1600, X34_FRAME, '3:4 #3') },
  '3x4-s4': { group: 'single-3x4', ...single(1200, 1600, X34_FRAME, '3:4 #4') },
};

const RATIO_FILENAMES = {
  'vuong': 'Shopee_Vuong',
  '3x4': 'Shopee_3x4',
  'vuong-plain': 'Vuong_KhongKhung',
  'vuong-s1': 'Vuong_1', 'vuong-s2': 'Vuong_2', 'vuong-s3': 'Vuong_3', 'vuong-s4': 'Vuong_4',
  '3x4-s1': '3x4_1', '3x4-s2': '3x4_2', '3x4-s3': '3x4_3', '3x4-s4': '3x4_4',
};

const GROUP_CONTAINERS = {
  'composite':    'composites-main',
  'single-vuong': 'composites-vuong',
  'single-3x4':   'composites-3x4',
};

// State
const pool = [];                     // [{ id, dataUrl, img }]
const assignments = {};              // ratio -> slot -> pool item id
const frameImages = {};              // ratio -> HTMLImageElement (preloaded)
let nextId = 1;

// Initialize assignments
for (const [ratio, spec] of Object.entries(SLOT_COORDS)) {
  assignments[ratio] = {};
  for (const slotName of Object.keys(spec.slots)) assignments[ratio][slotName] = null;
}

// ----- Init -----
function init() {
  preloadFrames();
  buildCompositeDOM();
  bindPaste();
  bindFileInput();
  bindDragDrop();
  bindButtons();
  bindUrlFetch();
  renderPool();
  renderAllSlots();
}

function preloadFrames() {
  const seen = new Set();
  for (const spec of Object.values(SLOT_COORDS)) {
    const path = spec.framePath;
    if (!path || seen.has(path)) continue;
    seen.add(path);
    const img = new Image();
    img.src = path;
    // Tag with all ratios that use this frame
    for (const [ratio, s] of Object.entries(SLOT_COORDS)) {
      if (s.framePath === path) frameImages[ratio] = img;
    }
  }
}

// ----- Build composite DOM dynamically -----
function buildCompositeDOM() {
  for (const [ratio, spec] of Object.entries(SLOT_COORDS)) {
    const containerId = GROUP_CONTAINERS[spec.group];
    const container = document.getElementById(containerId);
    if (!container) continue;

    const article = document.createElement('article');
    article.className = 'composite composite--' + spec.group;
    article.dataset.ratio = ratio;

    const head = document.createElement('header');
    head.className = 'composite__head';
    head.innerHTML = `
      <h2>${spec.title}${spec.subtitle ? ` <small>${spec.subtitle}</small>` : ''}</h2>
      <button class="btn-download" data-ratio="${ratio}" title="Tải ảnh này">⬇</button>
    `;
    article.appendChild(head);

    const stage = document.createElement('div');
    stage.className = 'composite__stage';
    const slotsEl = document.createElement('div');
    slotsEl.className = 'slots';
    slotsEl.dataset.ratio = ratio;
    slotsEl.style.aspectRatio = spec.aspectRatio;

    for (const [slotName, s] of Object.entries(spec.slots)) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.slot = slotName;
      slot.dataset.ratio = ratio;
      slot.style.left = s.cssLeft;
      slot.style.top = s.cssTop;
      slot.style.width = s.cssWidth;
      slot.style.height = s.cssHeight;
      if (s.label) {
        const label = document.createElement('span');
        label.className = 'slot-label';
        label.textContent = s.label;
        slot.appendChild(label);
      }
      slotsEl.appendChild(slot);
    }
    if (spec.framePath) {
      const frame = document.createElement('img');
      frame.className = 'frame-overlay';
      frame.src = spec.framePath;
      frame.alt = '';
      slotsEl.appendChild(frame);
    }
    stage.appendChild(slotsEl);
    article.appendChild(stage);
    container.appendChild(article);
  }
}

// ----- Paste -----
function bindPaste() {
  const zone = document.getElementById('pasteZone');
  zone.addEventListener('click', () => zone.focus());
  document.addEventListener('paste', handlePaste);

  ['dragenter', 'dragover'].forEach(ev => {
    zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('is-drop-active'); });
  });
  ['dragleave', 'drop'].forEach(ev => {
    zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove('is-drop-active'); });
  });
  zone.addEventListener('drop', e => {
    const files = [...(e.dataTransfer?.files || [])].filter(f => f.type.startsWith('image/'));
    files.forEach(addFile);
  });
}

function handlePaste(e) {
  const items = [...(e.clipboardData?.items || [])];
  let added = 0;
  for (const item of items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) { addFile(file); added++; }
    }
  }
  if (added > 0) e.preventDefault();
}

function bindFileInput() {
  const input = document.getElementById('fileInput');
  input.addEventListener('change', () => {
    [...input.files].filter(f => f.type.startsWith('image/')).forEach(addFile);
    input.value = '';
  });
}

function addFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    const img = new Image();
    img.onload = () => {
      pool.push({ id: nextId++, dataUrl, img });
      renderPool();
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

// ----- Pool render -----
function renderPool() {
  const list = document.getElementById('poolList');
  const count = document.getElementById('poolCount');
  count.textContent = `(${pool.length})`;
  list.innerHTML = '';
  if (pool.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'pool-empty';
    empty.textContent = 'Chưa có ảnh. Dán link hoặc paste ảnh ở trên.';
    list.appendChild(empty);
    return;
  }
  const inUse = new Set();
  for (const ratio of Object.keys(assignments)) {
    for (const slotName of Object.keys(assignments[ratio])) {
      const id = assignments[ratio][slotName];
      if (id != null) inUse.add(id);
    }
  }
  for (const item of pool) {
    const div = document.createElement('div');
    div.className = 'thumb' + (inUse.has(item.id) ? ' is-in-use' : '');
    div.style.backgroundImage = `url("${item.dataUrl}")`;
    div.setAttribute('draggable', 'true');
    div.dataset.poolId = item.id;
    div.title = inUse.has(item.id) ? 'Đang dùng' : 'Kéo vào ô để dùng';

    const remove = document.createElement('button');
    remove.className = 'thumb-remove';
    remove.type = 'button';
    remove.textContent = '×';
    remove.title = 'Xoá';
    remove.addEventListener('click', e => { e.stopPropagation(); removeFromPool(item.id); });
    div.appendChild(remove);

    div.addEventListener('dragstart', e => {
      div.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'pool', id: item.id }));
    });
    div.addEventListener('dragend', () => div.classList.remove('is-dragging'));

    list.appendChild(div);
  }
}

function removeFromPool(id) {
  const idx = pool.findIndex(p => p.id === id);
  if (idx === -1) return;
  pool.splice(idx, 1);
  for (const ratio of Object.keys(assignments)) {
    for (const slotName of Object.keys(assignments[ratio])) {
      if (assignments[ratio][slotName] === id) assignments[ratio][slotName] = null;
    }
  }
  renderPool();
  renderAllSlots();
}

// ----- Slots drag/drop -----
function bindDragDrop() {
  const slots = document.querySelectorAll('.slot');
  slots.forEach(slot => {
    slot.setAttribute('draggable', 'true');

    slot.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      slot.classList.add('is-drop-active');
    });
    slot.addEventListener('dragleave', () => slot.classList.remove('is-drop-active'));

    slot.addEventListener('drop', e => {
      e.preventDefault();
      slot.classList.remove('is-drop-active');
      const ratio = slot.dataset.ratio;
      const slotName = slot.dataset.slot;
      let payload;
      try { payload = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
      if (!payload) return;
      if (payload.source === 'pool') {
        assignments[ratio][slotName] = payload.id;
      } else if (payload.source === 'slot') {
        if (payload.ratio === ratio) {
          const src = assignments[ratio][payload.slot];
          const dst = assignments[ratio][slotName];
          assignments[ratio][slotName] = src;
          assignments[ratio][payload.slot] = dst;
        } else {
          assignments[ratio][slotName] = assignments[payload.ratio][payload.slot];
        }
      }
      renderPool();
      renderAllSlots();
    });

    slot.addEventListener('dragstart', e => {
      const ratio = slot.dataset.ratio;
      const slotName = slot.dataset.slot;
      const id = assignments[ratio][slotName];
      if (id == null) { e.preventDefault(); return; }
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'slot', ratio, slot: slotName, id }));
    });

    slot.addEventListener('click', () => {
      const ratio = slot.dataset.ratio;
      const slotName = slot.dataset.slot;
      if (assignments[ratio][slotName] != null) {
        if (confirm('Bỏ ảnh ở ô này?')) {
          assignments[ratio][slotName] = null;
          renderPool();
          renderAllSlots();
        }
      }
    });
  });
}

function renderAllSlots() {
  document.querySelectorAll('.slot').forEach(slot => {
    const ratio = slot.dataset.ratio;
    const slotName = slot.dataset.slot;
    const id = assignments[ratio][slotName];
    if (id == null) {
      slot.style.backgroundImage = '';
      slot.classList.add('is-empty');
      slot.classList.remove('has-image');
    } else {
      const item = pool.find(p => p.id === id);
      if (item) {
        slot.style.backgroundImage = `url("${item.dataUrl}")`;
        slot.classList.remove('is-empty');
        slot.classList.add('has-image');
      } else {
        assignments[ratio][slotName] = null;
        slot.style.backgroundImage = '';
        slot.classList.add('is-empty');
        slot.classList.remove('has-image');
      }
    }
  });
}

// ----- Render to canvas & download -----
function renderRatio(ratio) {
  const spec = SLOT_COORDS[ratio];
  const canvas = document.createElement('canvas');
  canvas.width = spec.canvas.w;
  canvas.height = spec.canvas.h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const [slotName, rect] of Object.entries(spec.slots)) {
    const id = assignments[ratio][slotName];
    if (id == null) continue;
    const item = pool.find(p => p.id === id);
    if (!item || !item.img.complete) continue;
    drawCoverFit(ctx, item.img, rect.x, rect.y, rect.w, rect.h);
  }

  const frame = frameImages[ratio];
  if (frame && frame.complete) {
    ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
  }
  return canvas;
}

function drawCoverFit(ctx, img, dx, dy, dw, dh) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const slotRatio = dw / dh;
  const imgRatio = iw / ih;
  let sx, sy, sw, sh;
  if (imgRatio > slotRatio) {
    sh = ih; sw = ih * slotRatio; sx = (iw - sw) / 2; sy = 0;
  } else {
    sw = iw; sh = iw / slotRatio; sx = 0; sy = (ih - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function downloadCanvas(canvas, filename) {
  return new Promise(resolve => {
    canvas.toBlob(blob => {
      if (!blob) { alert('Lỗi xuất ' + filename); resolve(); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => { URL.revokeObjectURL(url); resolve(); }, 300);
    }, 'image/png');
  });
}

function hasAnyImage(ratio) {
  const a = assignments[ratio];
  return Object.values(a).some(v => v != null);
}

async function downloadRatio(ratio) {
  if (!hasAnyImage(ratio)) {
    alert('Chưa có ảnh trong khung "' + SLOT_COORDS[ratio].title + '". Kéo ảnh vào trước.');
    return;
  }
  const canvas = renderRatio(ratio);
  const ts = timestamp();
  const prefix = RATIO_FILENAMES[ratio] || ratio;
  await downloadCanvas(canvas, `${prefix}_${ts}.png`);
}

async function downloadAllFilled() {
  const filled = Object.keys(SLOT_COORDS).filter(hasAnyImage);
  if (filled.length === 0) {
    alert('Chưa có khung nào được điền ảnh.');
    return;
  }
  for (const ratio of filled) {
    const canvas = renderRatio(ratio);
    const ts = timestamp();
    const prefix = RATIO_FILENAMES[ratio] || ratio;
    await downloadCanvas(canvas, `${prefix}_${ts}.png`);
    await new Promise(r => setTimeout(r, 150));
  }
}

function timestamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function bindButtons() {
  document.querySelectorAll('.btn-download').forEach(btn => {
    btn.addEventListener('click', () => downloadRatio(btn.dataset.ratio));
  });
  document.getElementById('downloadAll').addEventListener('click', downloadAllFilled);
  document.getElementById('clearAll').addEventListener('click', () => {
    if (!confirm('Xoá hết ảnh và các vị trí đã chọn?')) return;
    pool.length = 0;
    for (const r of Object.keys(assignments)) {
      for (const s of Object.keys(assignments[r])) assignments[r][s] = null;
    }
    renderPool();
    renderAllSlots();
  });
}

// ----- URL fetcher -----
function bindUrlFetch() {
  const input = document.getElementById('urlInput');
  const btn = document.getElementById('fetchBtn');
  const status = document.getElementById('urlStatus');

  const setStatus = (msg, kind = '') => {
    status.textContent = msg;
    status.classList.remove('is-error', 'is-success');
    if (kind) status.classList.add(kind);
  };

  const doFetch = async () => {
    const url = input.value.trim();
    if (!url) { setStatus('Dán link sản phẩm trước.', 'is-error'); return; }
    if (!/^https?:\/\//i.test(url)) { setStatus('Link phải bắt đầu bằng http:// hoặc https://', 'is-error'); return; }
    btn.disabled = true;
    setStatus('Đang tải trang sản phẩm + lọc phân loại size S...');
    try {
      const imgUrls = await extractProductImages(url);
      if (imgUrls.length === 0) {
        setStatus('Không có ảnh nào trong các phân loại size S.', 'is-error');
        return;
      }
      setStatus(`Tìm thấy ${imgUrls.length} ảnh size S. Đang tải về trình duyệt...`);
      let ok = 0, fail = 0;
      for (let i = 0; i < imgUrls.length; i++) {
        try {
          await addImageFromUrl(imgUrls[i]);
          ok++;
          setStatus(`Size S — đang tải ${i + 1}/${imgUrls.length} (thành công ${ok})...`);
        } catch (e) {
          console.warn('Failed image', imgUrls[i], e);
          fail++;
        }
      }
      setStatus(`✓ Đã thêm ${ok} ảnh size S vào pool${fail ? ` (lỗi ${fail})` : ''}. Kéo vào ô các khung.`, 'is-success');
    } catch (e) {
      console.error(e);
      setStatus('Lỗi: ' + e.message, 'is-error');
    } finally {
      btn.disabled = false;
    }
  };

  btn.addEventListener('click', doFetch);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doFetch(); });
}

async function extractProductImages(productUrl) {
  const proxyUrl = 'https://r.jina.ai/' + productUrl;
  const res = await fetch(proxyUrl, { headers: { 'X-Return-Format': 'html' } });
  if (!res.ok) throw new Error(`Proxy trả về ${res.status}`);
  const html = await res.text();

  const marker = html.search(/product\.dispatch\(\s*['"]viewProduct['"]\s*,\s*\{/);
  if (marker === -1) throw new Error('Không tìm thấy dữ liệu sản phẩm. Trang có đúng dạng Lysilk/Pancake không?');
  const braceStart = html.indexOf('{', marker);
  const jsonEnd = findMatchingBrace(html, braceStart);
  if (jsonEnd === -1) throw new Error('Không parse được JSON sản phẩm.');
  let product;
  try { product = JSON.parse(html.slice(braceStart, jsonEnd + 1)); }
  catch (e) { throw new Error('JSON sản phẩm lỗi: ' + e.message); }

  const variations = Array.isArray(product.variations) ? product.variations : [];
  if (variations.length === 0) throw new Error('Sản phẩm không có phân loại nào.');

  const sizeS = variations.filter(v => {
    const fields = Array.isArray(v.fields) ? v.fields : [];
    return fields.some(f =>
      f && typeof f.name === 'string' && /size/i.test(f.name) &&
      typeof f.value === 'string' && f.value.trim().toUpperCase() === 'S'
    );
  });
  if (sizeS.length === 0) throw new Error('Không có phân loại nào với size S.');

  const seen = new Set();
  const result = [];
  for (const v of sizeS) {
    const imgs = Array.isArray(v.images) ? v.images : [];
    for (const u of imgs) {
      const hash = u.match(/\/([a-f0-9]{32,})/);
      const key = hash ? hash[1] : u;
      if (seen.has(key)) continue;
      seen.add(key);
      const resized = u.replace(/\/web-media(?:-\d+)?\//, '/1/s1500x2250/fwebp80/');
      result.push(resized);
    }
  }
  return result;
}

function findMatchingBrace(s, start) {
  if (s[start] !== '{') return -1;
  let depth = 0, inStr = false, escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

async function addImageFromUrl(imgUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        const localImg = new Image();
        localImg.onload = () => {
          pool.push({ id: nextId++, dataUrl, img: localImg });
          renderPool();
          resolve();
        };
        localImg.onerror = () => reject(new Error('Không decode được ảnh local'));
        localImg.src = dataUrl;
      } catch (err) { reject(err); }
    };
    img.onerror = () => reject(new Error('Không tải được ảnh từ CDN'));
    img.src = imgUrl;
  });
}

init();
