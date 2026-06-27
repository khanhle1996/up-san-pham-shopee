'use strict';

// ============================================================
// Tab "Chạy ADS Lysilk" — Lysilk 2 account 3219708974940795
// Flow: dán link → quét ảnh → tick + chọn layout L4/L3
//       → preview canvas → điền content → submit backend
// Backend đặt sau Cloudflare Tunnel, URL lưu localStorage.
// ============================================================

const CA_LAYOUTS = {
  L4: {
    label: '1 lớn + 3 nhỏ',
    needed: 4,
    canvas: { w: 1080, h: 1080 },
    slots: [
      { name: 'large', x:   0, y:   0, w: 716, h: 1080 },
      { name: 's1',    x: 724, y:   0, w: 356, h:  354 },
      { name: 's2',    x: 724, y: 362, w: 356, h:  354 },
      { name: 's3',    x: 724, y: 724, w: 356, h:  356 },
    ],
  },
  L3: {
    label: '1 lớn + 2 nhỏ',
    needed: 3,
    canvas: { w: 1080, h: 1080 },
    slots: [
      { name: 'large', x:   0, y:   0, w: 716, h: 1080 },
      { name: 's1',    x: 724, y:   0, w: 356, h:  536 },
      { name: 's2',    x: 724, y: 544, w: 356, h:  536 },
    ],
  },
};

const CA_STATE = {
  images: [],          // [{ url, w, h, source, picked: bool, img: HTMLImageElement }]
  layout: 'L4',
  backendUrl: '',      // user sets via input → localStorage 'ca_backend_url'
  productUrl: '',
  slug: '',
};

const CA_DEFAULT_BRIEF = {
  headline: 'Lụa tơ tằm — Mềm như nước',
  primary_text: 'Bộ pyjama lụa Lysilk. Free-ship toàn quốc. Đặt ngay!',
  cta: 'SHOP_NOW',
  daily_budget_vnd: 200000,
  age_min: 22,
  age_max: 45,
  genders: [2],
  interest_query: 'thời trang nữ',
  interest_fallback: "Women's fashion",
};

function caInit() {
  CA_STATE.backendUrl = localStorage.getItem('ca_backend_url') || '';
  const beInput = document.getElementById('caBackendUrl');
  if (beInput) beInput.value = CA_STATE.backendUrl;

  document.getElementById('caScanBtn')?.addEventListener('click', caHandleScan);
  document.getElementById('caUrlInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') caHandleScan();
  });

  document.querySelectorAll('input[name="caLayout"]').forEach(r => {
    r.addEventListener('change', e => {
      CA_STATE.layout = e.target.value;
      caRenderPreview();
      caUpdateSubmitState();
    });
  });

  document.getElementById('caBackendUrl')?.addEventListener('change', e => {
    CA_STATE.backendUrl = e.target.value.trim().replace(/\/+$/, '');
    localStorage.setItem('ca_backend_url', CA_STATE.backendUrl);
    caHealthCheck();
  });

  document.getElementById('caDryRunBtn')?.addEventListener('click', () => caSubmit(true));
  document.getElementById('caLaunchBtn')?.addEventListener('click', () => caSubmit(false));

  // Default brief
  for (const [k, v] of Object.entries(CA_DEFAULT_BRIEF)) {
    const el = document.getElementById('caBrief_' + k);
    if (!el) continue;
    if (Array.isArray(v)) el.value = v.join(',');
    else el.value = v;
  }

  caHealthCheck();
}

function caStatus(msg, kind = '') {
  const el = document.getElementById('caStatus');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('is-error', 'is-success', 'is-warn');
  if (kind) el.classList.add(`is-${kind}`);
}

async function caHealthCheck() {
  const el = document.getElementById('caHealth');
  if (!el) return;
  if (!CA_STATE.backendUrl) {
    el.textContent = '⚠️ Chưa cấu hình URL backend (Win10 + Cloudflare Tunnel)';
    el.className = 'ca-health is-warn';
    return;
  }
  el.textContent = '⏳ Đang check backend...';
  el.className = 'ca-health';
  try {
    const res = await fetch(CA_STATE.backendUrl + '/api/health');
    if (res.ok) {
      const j = await res.json();
      el.textContent = `✓ Backend OK · account ${j.ad_account_id || '?'} · token live`;
      el.className = 'ca-health is-success';
    } else {
      el.textContent = `⚠️ Backend trả ${res.status}. Login Cloudflare Access?`;
      el.className = 'ca-health is-warn';
    }
  } catch (e) {
    el.textContent = `❌ Không gọi được backend: ${e.message}`;
    el.className = 'ca-health is-error';
  }
}

// ============================================================
// STEP 1 — Scrape Lysilk qua Jina Reader (browser, bypass CORS)
// ============================================================

async function caHandleScan() {
  const input = document.getElementById('caUrlInput');
  const btn = document.getElementById('caScanBtn');
  const url = input.value.trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    caStatus('Dán link sản phẩm Lysilk (http/https) trước.', 'error');
    return;
  }
  CA_STATE.productUrl = url;
  CA_STATE.slug = caSlugFromUrl(url);
  CA_STATE.images = [];
  caRenderImageGrid();
  caRenderPreview();
  document.getElementById('caBrief_landing_url').value = url;

  btn.disabled = true;
  caStatus('Đang tải trang sản phẩm qua Jina Reader proxy...');
  try {
    const urls = await caExtractAllImages(url);
    if (!urls.length) {
      caStatus('Không tìm thấy ảnh sản phẩm nào trong trang.', 'error');
      return;
    }
    caStatus(`Tìm thấy ${urls.length} ảnh. Đang tải về browser...`);
    let ok = 0, fail = 0;
    for (let i = 0; i < urls.length; i++) {
      try {
        const item = await caLoadImage(urls[i]);
        CA_STATE.images.push(item);
        ok++;
        caRenderImageGrid();
        caStatus(`Đang tải ${i + 1}/${urls.length} (OK ${ok})...`);
      } catch (e) {
        console.warn('Load fail', urls[i], e);
        fail++;
      }
    }
    caStatus(`✓ ${ok} ảnh sẵn sàng${fail ? ` (lỗi ${fail})` : ''}. Tick chọn ảnh + chọn layout.`, 'success');
  } catch (e) {
    console.error(e);
    caStatus('Lỗi: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function caExtractAllImages(productUrl) {
  // Reuse Jina Reader pattern from app.js but DO NOT filter by Size S.
  // Lấy ảnh từ tất cả variations + ảnh chính của product.
  const proxyUrl = 'https://r.jina.ai/' + productUrl;
  const res = await fetch(proxyUrl, { headers: { 'X-Return-Format': 'html' } });
  if (!res.ok) throw new Error(`Proxy trả ${res.status}`);
  const html = await res.text();

  const marker = html.search(/product\.dispatch\(\s*['"]viewProduct['"]\s*,\s*\{/);
  if (marker === -1) {
    throw new Error('Không thấy dữ liệu sản phẩm. Trang Lysilk/Pancake?');
  }
  const braceStart = html.indexOf('{', marker);
  const jsonEnd = caFindMatchingBrace(html, braceStart);
  if (jsonEnd === -1) throw new Error('Không parse được JSON sản phẩm.');
  let product;
  try {
    product = JSON.parse(html.slice(braceStart, jsonEnd + 1));
  } catch (e) {
    throw new Error('JSON sản phẩm lỗi: ' + e.message);
  }

  const seen = new Set();
  const result = [];

  // Ảnh chính của product
  const mainImages = Array.isArray(product.images) ? product.images : [];
  for (const u of mainImages) caAddImageDedup(u, seen, result, 'main');

  // Ảnh từ variations
  const variations = Array.isArray(product.variations) ? product.variations : [];
  for (const v of variations) {
    const imgs = Array.isArray(v.images) ? v.images : [];
    for (const u of imgs) caAddImageDedup(u, seen, result, 'variation');
  }

  return result;
}

function caAddImageDedup(u, seen, result, source) {
  if (typeof u !== 'string' || !u) return;
  const m = u.match(/\/([a-f0-9]{32,})/);
  const key = m ? m[1] : u;
  if (seen.has(key)) return;
  seen.add(key);
  // Resize via Pancake CDN: cho ad ưu tiên ảnh chất lượng cao hơn Shopee
  const resized = u.replace(/\/web-media(?:-\d+)?\//, '/1/s2000x2000/fwebp90/');
  result.push({ url: resized, source });
}

function caFindMatchingBrace(s, start) {
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

async function caLoadImage(meta) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      resolve({
        url: meta.url,
        source: meta.source,
        w: img.naturalWidth,
        h: img.naturalHeight,
        img,
        picked: false,
      });
    };
    img.onerror = () => reject(new Error('CDN từ chối'));
    img.src = meta.url;
  });
}

function caSlugFromUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const idx = parts.lastIndexOf('products');
    return (idx >= 0 && parts[idx + 1]) ? parts[idx + 1] : parts.join('-') || 'product';
  } catch { return 'product'; }
}

// ============================================================
// STEP 2 — Grid ảnh + layout + preview canvas
// ============================================================

function caRenderImageGrid() {
  const grid = document.getElementById('caImageGrid');
  const counter = document.getElementById('caImageCount');
  if (!grid) return;
  grid.innerHTML = '';
  counter.textContent = `(${CA_STATE.images.length} ảnh)`;

  if (CA_STATE.images.length === 0) {
    grid.innerHTML = '<div class="ca-empty">Chưa quét. Dán link sản phẩm + bấm Quét.</div>';
    caUpdateSubmitState();
    return;
  }

  CA_STATE.images.forEach((item, idx) => {
    const tile = document.createElement('div');
    tile.className = 'ca-tile' + (item.picked ? ' is-picked' : '');
    tile.title = `${item.w}×${item.h} · ${item.source}`;
    tile.style.backgroundImage = `url("${item.url}")`;

    const badge = document.createElement('div');
    badge.className = 'ca-tile-badge';
    badge.textContent = caPickOrderFor(idx) || '';
    tile.appendChild(badge);

    tile.addEventListener('click', () => caTogglePick(idx));
    grid.appendChild(tile);
  });

  caUpdateSubmitState();
  caRenderPreview();
}

function caTogglePick(idx) {
  const item = CA_STATE.images[idx];
  const layout = CA_LAYOUTS[CA_STATE.layout];
  if (item.picked) {
    item.picked = false;
  } else {
    const pickedCount = CA_STATE.images.filter(x => x.picked).length;
    if (pickedCount >= layout.needed) {
      caStatus(`Layout ${CA_STATE.layout} chỉ cần ${layout.needed} ảnh. Bỏ tick 1 ảnh khác trước.`, 'warn');
      return;
    }
    item.picked = true;
  }
  caRenderImageGrid();
}

function caPickOrderFor(idx) {
  let order = 0;
  for (let i = 0; i <= idx; i++) if (CA_STATE.images[i].picked) order++;
  return CA_STATE.images[idx].picked ? order : 0;
}

function caGetPickedImages() {
  return CA_STATE.images.filter(x => x.picked);
}

function caRenderPreview() {
  const canvas = document.getElementById('caPreviewCanvas');
  if (!canvas) return;
  const layout = CA_LAYOUTS[CA_STATE.layout];
  canvas.width = layout.canvas.w;
  canvas.height = layout.canvas.h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const picked = caGetPickedImages();
  for (let i = 0; i < layout.slots.length; i++) {
    const slot = layout.slots[i];
    const item = picked[i];
    if (!item) {
      // empty placeholder
      ctx.fillStyle = '#f0f0f3';
      ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
      ctx.fillStyle = '#999';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Slot ${i + 1}`, slot.x + slot.w / 2, slot.y + slot.h / 2);
      continue;
    }
    caDrawCoverFit(ctx, item.img, slot.x, slot.y, slot.w, slot.h);
  }
}

function caDrawCoverFit(ctx, img, dx, dy, dw, dh) {
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

function caUpdateSubmitState() {
  const layout = CA_LAYOUTS[CA_STATE.layout];
  const picked = caGetPickedImages().length;
  const ok = picked === layout.needed && CA_STATE.backendUrl;
  const reasonEl = document.getElementById('caSubmitReason');
  ['caDryRunBtn', 'caLaunchBtn'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.disabled = !ok;
  });
  if (!CA_STATE.backendUrl) {
    reasonEl.textContent = '⚠️ Chưa nhập URL backend.';
  } else if (picked < layout.needed) {
    reasonEl.textContent = `Cần ${layout.needed} ảnh cho layout ${CA_STATE.layout}, đang chọn ${picked}.`;
  } else {
    reasonEl.textContent = `✓ Sẵn sàng. Layout ${CA_STATE.layout}, ${picked} ảnh.`;
  }
}

// ============================================================
// STEP 3 — Submit (dry-run or real)
// ============================================================

async function caSubmit(dry) {
  const layout = CA_LAYOUTS[CA_STATE.layout];
  const picked = caGetPickedImages();
  if (picked.length !== layout.needed) {
    caStatus(`Layout ${CA_STATE.layout} cần đúng ${layout.needed} ảnh.`, 'error');
    return;
  }
  if (!CA_STATE.backendUrl) {
    caStatus('Chưa nhập URL backend.', 'error');
    return;
  }

  const brief = caCollectBrief();
  if (!brief) return;

  // Render canvas → blob → base64
  caRenderPreview();
  const canvas = document.getElementById('caPreviewCanvas');
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  if (!blob) {
    caStatus('Lỗi xuất canvas PNG.', 'error');
    return;
  }
  const image_b64 = await caBlobToBase64(blob);

  const btn = document.getElementById(dry ? 'caDryRunBtn' : 'caLaunchBtn');
  btn.disabled = true;
  caStatus(dry ? '⏳ Đang dry-run...' : '🚀 Đang gửi lên Meta (PAUSED)...');

  const payload = {
    slug: CA_STATE.slug,
    product_url: CA_STATE.productUrl,
    layout: CA_STATE.layout,
    brief,
    image_b64,
    dry,
  };

  try {
    const res = await fetch(CA_STATE.backendUrl + '/api/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    caRenderResult(data, dry);
  } catch (e) {
    console.error(e);
    caStatus('❌ ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    caUpdateSubmitState();
  }
}

function caCollectBrief() {
  const brief = {
    headline:        document.getElementById('caBrief_headline').value.trim(),
    primary_text:    document.getElementById('caBrief_primary_text').value.trim(),
    landing_url:     document.getElementById('caBrief_landing_url').value.trim(),
    cta:             document.getElementById('caBrief_cta').value,
    daily_budget_vnd: parseInt(document.getElementById('caBrief_daily_budget_vnd').value, 10),
    age_min:         parseInt(document.getElementById('caBrief_age_min').value, 10),
    age_max:         parseInt(document.getElementById('caBrief_age_max').value, 10),
    genders:         document.getElementById('caBrief_genders').value
                       .split(',').map(s => parseInt(s.trim(), 10)).filter(Boolean),
    interest_query:    document.getElementById('caBrief_interest_query').value.trim(),
    interest_fallback: document.getElementById('caBrief_interest_fallback').value.trim(),
  };
  if (!brief.headline) { caStatus('Thiếu Headline.', 'error'); return null; }
  if (!brief.primary_text) { caStatus('Thiếu Primary text.', 'error'); return null; }
  if (!brief.landing_url) { caStatus('Thiếu Landing URL.', 'error'); return null; }
  if (!brief.daily_budget_vnd || brief.daily_budget_vnd < 50000) {
    caStatus('Budget tối thiểu 50.000 VND/ngày.', 'error'); return null;
  }
  return brief;
}

function caBlobToBase64(blob) {
  return new Promise(resolve => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(',')[1]); // strip "data:image/png;base64,"
    r.readAsDataURL(blob);
  });
}

function caRenderResult(data, dry) {
  const box = document.getElementById('caResult');
  box.classList.remove('hidden');
  if (dry) {
    caStatus('✓ Dry-run OK — chưa POST tới Meta.', 'success');
    box.innerHTML = `
      <h3>Dry-run preview</h3>
      <p>Payload sẽ gửi (chưa fire):</p>
      <pre>${caEscape(JSON.stringify(data.dry_payload || data, null, 2))}</pre>
    `;
  } else {
    caStatus('✓ Đã tạo trên Meta (PAUSED). Vào Ads Manager active tay.', 'success');
    box.innerHTML = `
      <h3>✅ Tạo thành công (PAUSED)</h3>
      <ul>
        <li><strong>Campaign:</strong> <code>${data.campaign_id || '?'}</code></li>
        <li><strong>Adset:</strong> <code>${data.adset_id || '?'}</code></li>
        <li><strong>Ad:</strong> <code>${data.ad_id || '?'}</code></li>
      </ul>
      <a class="ca-ads-link" href="${data.ads_manager_url || '#'}" target="_blank" rel="noopener">
        🔗 Mở Ads Manager để verify + active tay
      </a>
      <p class="ca-warn-active">
        ⚠️ Em KHÔNG tự active. Anh verify trong Ads Manager: budget ₫${(data.daily_budget_vnd || 200000).toLocaleString('vi-VN')},
        female 22-45, interest đúng, creative preview hiện đúng ảnh ghép. OK rồi mới bấm Active tay.
      </p>
    `;
  }
}

function caEscape(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// Init khi tab "chay-ads" được mở (gọi từ index.html tab switcher)
window.caInit = caInit;
