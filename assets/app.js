// Bảng giá động IST — phác thảo
// Yêu cầu: chạy qua local server (vì fetch JSON), VD: python3 -m http.server

const state = {
  service: null,        // service definition object
  selections: {},       // { fieldName: value }
};
let DATA = null;

const $ = (sel, root = document) => root.querySelector(sel);

// ---------- Utils ----------
const fmt = new Intl.NumberFormat('vi-VN');
const money = (n) => fmt.format(Math.round(n)) + 'đ';

// Parse "1000-1599" / "1000+" / "5" / "10" → numeric (lower bound)
function parseQty(v) {
  if (v == null) return 0;
  const s = String(v).replace(/\s|\u00A0/g, '');
  const m = s.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}
// Sort key for so_luong & so_trang
function numericSortKey(v) { return parseQty(v); }
// Sort key for kich_thuoc — cố gắng parse mm/cm/Ø/A
function sizeSortKey(v) {
  if (!v) return [99, 0];
  const s = String(v);
  // A5 < A4 < A3 ; ưu tiên A4 đứng < A4 ngang
  if (/^A\d/.test(s)) {
    const n = parseInt(s.slice(1), 10);
    return [0, -n, s];
  }
  // Ø3cm
  const dia = s.match(/Ø(\d+(?:\.\d+)?)/);
  if (dia) return [1, parseFloat(dia[1])];
  // 3×4cm / 90×54mm
  const cross = s.match(/(\d+(?:\.\d+)?)[×x](\d+(?:\.\d+)?)/);
  if (cross) return [2, parseFloat(cross[1]) * parseFloat(cross[2])];
  return [9, s];
}

function uniqueSorted(arr, sortKey) {
  const u = [...new Set(arr)];
  u.sort((a, b) => {
    const ka = sortKey(a), kb = sortKey(b);
    if (Array.isArray(ka)) {
      for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
        const x = ka[i] ?? 0, y = kb[i] ?? 0;
        if (x < y) return -1;
        if (x > y) return 1;
      }
      return 0;
    }
    return ka - kb;
  });
  return u;
}

const SORTERS = {
  so_luong: numericSortKey,
  so_trang: numericSortKey,
  kich_thuoc: sizeSortKey,
};

// ---------- Lookup ----------
// Tìm tier object trong service.qty_tiers theo label
function findTier(svc, label) {
  return svc?.qty_tiers?.find(t => t.label === label) || null;
}

function rowMatches(row, serviceLabel, selections, svc) {
  if (row.dich_vu !== serviceLabel) return false;
  for (const [k, v] of Object.entries(selections)) {
    if (v == null || v === '') continue;
    // so_luong: nếu service có qty_tiers, value là label tier → match bằng bracket numeric
    if (k === 'so_luong' && svc?.qty_tiers) {
      const tier = findTier(svc, v);
      if (!tier) return false;
      if (!qtyInBracket(tier.value, row.so_luong)) return false;
      continue;
    }
    let cmp = v;
    // Name card: 86×53mm chung giá với 90×54mm
    if (k === 'kich_thuoc' && svc?.merge_kich_thuoc?.[v]) {
      cmp = svc.merge_kich_thuoc[v];
    }
    if (row[k] !== cmp) return false;
  }
  return true;
}

// Có row nào khớp upstream selections + tier candidate này không?
function tierHasMatch(tierLabel) {
  const svc = state.service;
  const probe = { ...state.selections, so_luong: tierLabel };
  return DATA.rows.some(r => rowMatches(r, svc.label, probe, svc));
}

function lookupBest(serviceLabel, selections) {
  const svc = state.service;
  const matches = DATA.rows.filter(r => rowMatches(r, serviceLabel, selections, svc));
  if (!matches.length) return null;
  // Lấy đơn giá quy về /đơn vị thấp nhất (Tờ rơi nhiều nguồn KTS/Offset/Offset ghép)
  const qty = effectiveQty(svc, selections.so_luong) || 1;
  const unitOf = (r) => r.don_vi_gia === 'VNĐ/tổng' ? r.don_gia / qty : r.don_gia;
  return matches.reduce((best, r) => unitOf(r) < unitOf(best) ? r : best);
}

// Lấy số lượng numeric từ selection (xử lý cả tier và bracket string)
function effectiveQty(svc, soLuongVal) {
  if (!soLuongVal) return 0;
  if (svc?.qty_tiers) {
    const t = findTier(svc, soLuongVal);
    return t ? t.value : 0;
  }
  return parseQty(soLuongVal);
}

// Cho catalogue: lookup phụ phí đóng kim
function lookupAddon(qty) {
  const matches = DATA.rows.filter(r =>
    r.dich_vu === 'Phụ phí catalogue' &&
    r.kich_thuoc === 'Đóng kim cuốn'
  );
  // Tìm bậc số lượng phù hợp
  const target = parseQty(qty);
  let pick = null;
  for (const r of matches) {
    if (qtyInBracket(target, r.so_luong)) { pick = r; break; }
  }
  return pick;
}
function qtyInBracket(n, bracket) {
  if (!bracket) return false;
  const s = String(bracket).replace(/\s/g, '');
  // "501+"
  let m = s.match(/^(\d+)\+$/);
  if (m) return n >= parseInt(m[1], 10);
  // "11-20"
  m = s.match(/^(\d+)-(\d+)$/);
  if (m) return n >= +m[1] && n <= +m[2];
  // "5"
  m = s.match(/^(\d+)$/);
  if (m) return n === +m[1];
  return false;
}

// ---------- Options ----------
// Service nào bật `cascade: true` (vd tem_nhan) → field con lọc theo upstream đã chọn.
// Các service khác → universe (mọi giá trị có trong dữ liệu của service).
function getOptionsFor(field) {
  const svc = state.service;
  // so_luong với qty_tiers cố định
  if (field === 'so_luong' && svc.qty_tiers) {
    return svc.qty_tiers.map(t => t.label);
  }
  let rows = DATA.rows.filter(r => r.dich_vu === svc.label);
  if (svc.cascade) {
    const fields = svc.fields;
    const idx = fields.indexOf(field);
    // Cascade: BẮT BUỘC mọi field upstream phải được chọn trước.
    // Nếu thiếu bất kỳ field cha nào → trả về rỗng (UI hiện placeholder "Chọn yếu tố trước").
    for (let i = 0; i < idx; i++) {
      const f = fields[i];
      const v = state.selections[f];
      if (v == null || v === '') return [];
      let cmp = v;
      if (f === 'kich_thuoc' && svc.merge_kich_thuoc?.[v]) cmp = svc.merge_kich_thuoc[v];
      rows = rows.filter(r => r[f] === cmp);
    }
  }
  let vals = rows.map(r => r[field]).filter(v => v != null && v !== '');
  // Inject thêm option ảo (VD name card 86×53mm)
  const extra = svc.extra_options?.[field] || [];
  vals = vals.concat(extra);
  return uniqueSorted(vals, SORTERS[field] || ((x) => String(x)));
}

// ---------- Render ----------
function renderWidget() {
  const root = $('#bg-widget');
  root.removeAttribute('aria-busy');
  const svc = state.service;

  const fieldsHTML = svc ? svc.fields.map((f) => {
    const opts = getOptionsFor(f);
    const sel = state.selections[f];
    let contentHTML;
    if (f === 'so_luong') {
      // Dropdown cho số lượng. Cascade: upstream chưa đủ → disable dropdown.
      // Tier không có data: KHÔNG đánh dấu trong dropdown — chỉ hiển thị
      // thông báo "Liên hệ báo giá" ở khu vực Tổng cộng khi user chọn vào.
      const upstreamReady = svc.cascade
        ? svc.fields.slice(0, svc.fields.indexOf(f)).every(uf => state.selections[uf])
        : true;
      const optionEls = opts.map(v => {
        return `<option value="${escapeAttr(v)}" ${sel === v ? 'selected' : ''}>${escapeHtml(v)}</option>`;
      }).join('');
      const placeholder = upstreamReady
        ? `— Chọn ${escapeHtml((svc.field_labels[f] || f).toLowerCase())} —`
        : '— Vui lòng chọn yếu tố phía trên trước —';
      contentHTML = `<select class="qty-select" data-field="${f}" ${upstreamReady ? '' : 'disabled'}>
        <option value="" ${sel ? '' : 'selected'} disabled>${placeholder}</option>
        ${optionEls}
      </select>`;
    } else {
      const optHTML = opts.map(v => {
        const id = `opt-${f}-${String(v).replace(/\W+/g, '_')}`;
        return `<label class="opt"><input type="radio" name="${f}" id="${id}" value="${escapeAttr(v)}" ${sel === v ? 'checked' : ''} data-field="${f}" /> ${escapeHtml(v)}</label>`;
      }).join('');
      const emptyMsg = svc.cascade
        ? '<span class="muted">Vui lòng chọn yếu tố phía trên trước</span>'
        : '<span class="muted">—</span>';
      contentHTML = optHTML || emptyMsg;
    }
    return `
      <div class="bg-row">
        <div class="label">${escapeHtml(svc.field_labels[f] || f)}</div>
        <div class="content">${contentHTML}</div>
      </div>`;
  }).join('') : '';

  const totalHTML = renderTotal();

  root.innerHTML = `
    <div class="bg-row bg-header">
      <div class="label">Sản phẩm in</div>
      <div class="content" style="flex-direction:column;align-items:stretch;gap:6px;">
        <select id="svc-select">
          ${DATA.services.map(s => `<option value="${s.id}" ${svc?.id === s.id ? 'selected' : ''}>${escapeHtml(s.label.toUpperCase())}</option>`).join('')}
        </select>
        ${svc?.spec_note ? `<div class="spec-note">${escapeHtml(svc.spec_note)}</div>` : ''}
      </div>
    </div>
    ${fieldsHTML}
    <div class="bg-total">
      <div class="label"><strong>Tổng cộng</strong><span class="sub">Số lượng × đơn giá</span></div>
      <div class="total-value ${totalHTML.muted ? 'muted' : ''}">${totalHTML.html}</div>
    </div>
    <div class="cta-wrap">
      <button class="cta-btn" id="cta-btn">Đặt in — Nhận báo giá</button>
    </div>
    <div class="bg-footnote">${escapeHtml(svc?.footer_note || '')}</div>
  `;

  // Bind
  $('#svc-select').addEventListener('change', (e) => {
    setService(e.target.value);
  });
  const onFieldChange = (field, newVal) => {
    state.selections[field] = newVal;
    // Cascade clear: mọi field SAU field vừa đổi đều reset về chưa chọn.
    const fields = state.service.fields;
    const idx = fields.indexOf(field);
    for (let i = idx + 1; i < fields.length; i++) {
      delete state.selections[fields[i]];
    }
    renderWidget();
  };
  root.querySelectorAll('input[type="radio"][data-field]').forEach(inp => {
    inp.addEventListener('change', () => onFieldChange(inp.dataset.field, inp.value));
  });
  root.querySelectorAll('select[data-field]').forEach(sel => {
    sel.addEventListener('change', () => onFieldChange(sel.dataset.field, sel.value));
  });
  $('#cta-btn').addEventListener('click', openModal);
}

function renderTotal() {
  const svc = state.service;
  if (!svc) return { html: '<span class="muted">—</span>', muted: true };
  const allChosen = svc.fields.every(f => state.selections[f]);
  if (!allChosen) return { html: 'Vui lòng chọn đầy đủ thông tin', muted: true };

  const row = lookupBest(svc.label, state.selections);
  if (!row) return { html: 'Liên hệ báo giá', muted: true };

  const qty = effectiveQty(svc, state.selections.so_luong) || 1;
  const unit = row.don_vi_sl || 'cái';
  const qtyLabel = state.selections.so_luong || '';

  let total, calcLine;

  if (svc.id === 'catalogue') {
    const addon = lookupAddon(state.selections.so_luong);
    const addonPrice = addon ? addon.don_gia : 0;
    total = (row.don_gia + addonPrice) * qty;
    calcLine = `${qtyLabel} ${unit} × (${money(row.don_gia)} + ${money(addonPrice)} đóng kim)`;
  } else if (row.don_vi_gia === 'VNĐ/tổng') {
    total = row.don_gia;
    calcLine = `${qtyLabel} ${unit} — giá trọn gói`;
  } else {
    total = row.don_gia * qty;
    calcLine = `${qtyLabel} ${unit} × ${money(row.don_gia)}/${unit}`;
  }

  return {
    html: `<span class="stack"><span class="amt">${money(total)}</span><span class="calc-line">${escapeHtml(calcLine)}</span></span>`,
    muted: false,
  };
}

function setService(id) {
  state.service = DATA.services.find(s => s.id === id) || DATA.services[0];
  state.selections = {};
  renderWidget();
}

// ---------- Modal ----------
function openModal() {
  const dlg = $('#cta-modal');
  const svc = state.service;
  // Pre-fill ghi chú
  const lines = [`Dịch vụ: ${svc.label}`];
  for (const f of svc.fields) {
    if (state.selections[f]) lines.push(`- ${svc.field_labels[f] || f}: ${state.selections[f]}`);
  }
  const totalEl = $('#bg-widget .total-value .amt');
  if (totalEl) lines.push(`Giá tham khảo: ${totalEl.textContent}`);
  $('#cta-form textarea[name="ghi_chu"]').value = lines.join('\n');
  dlg.showModal();
}
$('#cta-cancel').addEventListener('click', () => $('#cta-modal').close());
$('#cta-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  payload.dich_vu = state.service?.label;
  payload.lua_chon = { ...state.selections };
  console.log('[CTA submit]', payload);
  // TODO: thay bằng fetch('/api/lead', { method: 'POST', body: JSON.stringify(payload) })
  alert('Đã ghi nhận yêu cầu! In Siêu Tốc sẽ liên hệ trong ít phút.');
  $('#cta-modal').close();
});

// ---------- Helpers ----------
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

// ---------- Boot ----------
fetch('data/bang_gia.json')
  .then(r => r.json())
  .then(d => {
    DATA = d;
    setService(d.services[0].id);
  })
  .catch(err => {
    $('#bg-widget').textContent = 'Không tải được dữ liệu giá. Hãy chạy qua local server (python3 -m http.server).';
    console.error(err);
  });
