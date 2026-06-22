'use strict';

// Slot coordinates in the output canvas (pixels). Must match CSS % in styles.css.
// Photos are drawn first; the frame PNG is overlaid on top (transparent center reveals photos).
const SLOT_COORDS = {
  vuong: {
    canvas: { w: 1000, h: 1000 },
    framePath: 'assets/khung-vuong.png',
    slots: {
      large:    { x: 330, y:   0, w: 670, h: 1000 },
      smallTop: { x:   0, y:   0, w: 330, h:  500 },
      smallBot: { x:   0, y: 500, w: 330, h:  500 },
    },
  },
  '3x4': {
    canvas: { w: 1200, h: 1600 },
    framePath: 'assets/khung-3x4.png',
    slots: {
      large:    { x: 400, y:   0, w: 800, h: 1600 },
      smallTop: { x:   0, y:   0, w: 400, h:  800 },
      smallBot: { x:   0, y: 800, w: 400, h:  800 },
    },
  },
  'vuong-plain': {
    canvas: { w: 1000, h: 1000 },
    framePath: null, // no frame overlay
    slots: {
      large:    { x: 330, y:   0, w: 670, h: 1000 },
      smallTop: { x:   0, y:   0, w: 330, h:  500 },
      smallBot: { x:   0, y: 500, w: 330, h:  500 },
    },
  },
};

// State
const pool = [];                     // [{ id, dataUrl, img }]
const assignments = {                // ratio -> slot -> pool item id
  vuong: { large: null, smallTop: null, smallBot: null },
  '3x4': { large: null, smallTop: null, smallBot: null },
  'vuong-plain': { large: null, smallTop: null, smallBot: null },
};
const frameImages = {};              // ratio -> HTMLImageElement (preloaded)
let nextId = 1;

// ----- Init -----
function init() {
  preloadFrames();
  bindPaste();
  bindFileInput();
  bindDragDrop();
  bindButtons();
  bindUrlFetch();
  renderPool();
  renderAllSlots();
}

function preloadFrames() {
  for (const ratio of Object.keys(SLOT_COORDS)) {
    const path = SLOT_COORDS[ratio].framePath;
    if (!path) continue;
    const img = new Image();
    img.src = path;
    frameImages[ratio] = img;
  }
}

// ----- Paste -----
function bindPaste() {
  const zone = document.getElementById('pasteZone');
  zone.addEventListener('click', () => zone.focus());
  // Global paste so user doesn't have to focus exactly
  document.addEventListener('paste', handlePaste);

  // Drag-and-drop files onto paste zone
  ['dragenter', 'dragover'].forEach(ev => {
    zone.addEventListener(ev, e => {
      e.preventDefault();
      zone.classList.add('is-drop-active');
    });
  });
  ['dragleave', 'drop'].forEach(ev => {
    zone.addEventListener(ev, e => {
      e.preventDefault();
      zone.classList.remove('is-drop-active');
    });
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
      if (file) {
        addFile(file);
        added++;
      }
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
    empty.textContent = 'Chưa có ảnh nào. Dán ảnh ở ô phía trên.';
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
    div.title = inUse.has(item.id) ? 'Ảnh này đang được dùng' : 'Kéo vào ô để dùng';

    const remove = document.createElement('button');
    remove.className = 'thumb-remove';
    remove.type = 'button';
    remove.textContent = '×';
    remove.title = 'Xoá ảnh khỏi pool';
    remove.addEventListener('click', e => {
      e.stopPropagation();
      removeFromPool(item.id);
    });
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
  // Clear from any slot using it
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
        // Swap two slots (within the same composite)
        if (payload.ratio === ratio) {
          const src = assignments[ratio][payload.slot];
          const dst = assignments[ratio][slotName];
          assignments[ratio][slotName] = src;
          assignments[ratio][payload.slot] = dst;
        } else {
          // Cross-ratio: copy the image (don't move it — other ratio may still want it)
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
        // pool item was removed — clear
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

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw photos cover-fit into each slot
  for (const [slotName, rect] of Object.entries(spec.slots)) {
    const id = assignments[ratio][slotName];
    if (id == null) continue;
    const item = pool.find(p => p.id === id);
    if (!item || !item.img.complete) continue;
    drawCoverFit(ctx, item.img, rect.x, rect.y, rect.w, rect.h);
  }

  // Overlay frame
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
    // image is wider — crop sides
    sh = ih;
    sw = ih * slotRatio;
    sx = (iw - sw) / 2;
    sy = 0;
  } else {
    // image is taller — crop top/bottom
    sw = iw;
    sh = iw / slotRatio;
    sx = 0;
    sy = (ih - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function downloadCanvas(canvas, filename) {
  canvas.toBlob(blob => {
    if (!blob) { alert('Lỗi xuất ảnh.'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}

const RATIO_FILENAMES = {
  'vuong': 'Shopee_Vuong',
  '3x4': 'Shopee_3x4',
  'vuong-plain': 'Vuong_KhongKhung',
};

function downloadRatio(ratio) {
  const a = assignments[ratio];
  if (a.large == null && a.smallTop == null && a.smallBot == null) {
    alert('Chưa có ảnh nào trong khung này. Kéo ảnh vào ô trước.');
    return;
  }
  const canvas = renderRatio(ratio);
  const ts = timestamp();
  const prefix = RATIO_FILENAMES[ratio] || ratio;
  downloadCanvas(canvas, `${prefix}_${ts}.png`);
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
  document.getElementById('downloadAll').addEventListener('click', () => {
    downloadRatio('vuong');
    setTimeout(() => downloadRatio('3x4'), 250);
  });
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

// ----- URL fetcher: get product images from a Lysilk/Pancake page via Jina Reader proxy -----
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
      setStatus(`✓ Đã thêm ${ok} ảnh size S vào pool${fail ? ` (lỗi ${fail})` : ''}. Kéo vào 3 ô của mỗi khung.`, 'is-success');
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
  // Fetch raw HTML via Jina Reader proxy (X-Return-Format: html keeps <script> content intact,
  // which is needed to parse the embedded `product.dispatch('viewProduct', {...})` JSON).
  const proxyUrl = 'https://r.jina.ai/' + productUrl;
  const res = await fetch(proxyUrl, { headers: { 'X-Return-Format': 'html' } });
  if (!res.ok) throw new Error(`Proxy trả về ${res.status}`);
  const html = await res.text();

  // Locate the JSON blob inside product.dispatch('viewProduct', {...})
  const marker = html.search(/product\.dispatch\(\s*['"]viewProduct['"]\s*,\s*\{/);
  if (marker === -1) {
    throw new Error('Không tìm thấy dữ liệu sản phẩm trong trang. Trang có đúng dạng Lysilk/Pancake không?');
  }
  const braceStart = html.indexOf('{', marker);
  const jsonEnd = findMatchingBrace(html, braceStart);
  if (jsonEnd === -1) throw new Error('Không parse được JSON sản phẩm.');
  let product;
  try {
    product = JSON.parse(html.slice(braceStart, jsonEnd + 1));
  } catch (e) {
    throw new Error('JSON sản phẩm lỗi: ' + e.message);
  }

  const variations = Array.isArray(product.variations) ? product.variations : [];
  if (variations.length === 0) {
    throw new Error('Sản phẩm không có phân loại nào.');
  }

  // Filter to variations that have a "Size" field with value "S" (case-insensitive)
  const sizeS = variations.filter(v => {
    const fields = Array.isArray(v.fields) ? v.fields : [];
    return fields.some(f =>
      f && typeof f.name === 'string' && /size/i.test(f.name) &&
      typeof f.value === 'string' && f.value.trim().toUpperCase() === 'S'
    );
  });
  if (sizeS.length === 0) {
    throw new Error('Không có phân loại nào với size S. Sản phẩm này có size khác.');
  }

  // Collect images; dedupe by content hash in URL path
  const seen = new Set();
  const result = [];
  for (const v of sizeS) {
    const imgs = Array.isArray(v.images) ? v.images : [];
    for (const u of imgs) {
      const hash = u.match(/\/([a-f0-9]{32,})/);
      const key = hash ? hash[1] : u;
      if (seen.has(key)) continue;
      seen.add(key);
      // Convert raw web-media URL to a resized variant the CDN serves with CORS.
      // Pattern: /web-media/AB/CD/.../HASH-... → /1/s1500x2250/fwebp80/AB/CD/.../HASH-...
      const resized = u.replace(/\/web-media(?:-\d+)?\//, '/1/s1500x2250/fwebp80/');
      result.push(resized);
    }
  }
  return result;
}

function findMatchingBrace(s, start) {
  // Returns index of matching '}' for the '{' at s[start]; respects strings and escapes.
  if (s[start] !== '{') return -1;
  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

async function addImageFromUrl(imgUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        // Re-encode to a data URL so it lives independently of network and can be exported via canvas
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
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Không tải được ảnh từ CDN'));
    img.src = imgUrl;
  });
}

init();
