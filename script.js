const STORAGE_STUDIO = 'cleiStudio.studio';
const STORAGE_PIECES = 'cleiStudio.pieces';
const STORAGE_DISTINCT_ID = 'cleiStudio.distinctId';

// Stable per-browser id used to identify a maker once they complete setup.
// The app has no login, so we mint and persist our own id rather than fabricate
// one per visit.
function studioDistinctId() {
  let id = null;
  try { id = localStorage.getItem(STORAGE_DISTINCT_ID); } catch (e) { /* ignore */ }
  if (!id) {
    id = 'studio-' + (self.crypto?.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2));
    try { localStorage.setItem(STORAGE_DISTINCT_ID, id); } catch (e) { /* ignore */ }
  }
  return id;
}

const state = {
  studio: {
    monthlyCosts: null,
    desiredIncome: null,
    productiveHours: null,
    piecesPerMonth: null,
    hourlyRate: null,
    studioCostPerPiece: null
  },
  piece: blankPiece(),
  savedPieces: []
};

function blankPiece() {
  return {
    name: null,
    image: null,
    productionMethod: null,
    businessRole: null,
    materials: { clay: 0, glaze: 0, packaging: 0, other: 0 },
    firings: 0,
    productionTimeMinutes: null,
    batch: { isBatched: false, batchSize: null, timeSavings: null },
    salesChannel: null
  };
}

const $ = (id) => document.getElementById(id);
const money = (n) => `$${n.toFixed(2)}`;

function loadPersisted() {
  try {
    const studio = JSON.parse(localStorage.getItem(STORAGE_STUDIO));
    if (studio) Object.assign(state.studio, studio);
  } catch (e) { /* corrupt or missing, ignore */ }
  try {
    const pieces = JSON.parse(localStorage.getItem(STORAGE_PIECES));
    if (Array.isArray(pieces)) state.savedPieces = pieces;
  } catch (e) { /* corrupt or missing, ignore */ }
}

function persistStudio() {
  try { localStorage.setItem(STORAGE_STUDIO, JSON.stringify(state.studio)); }
  catch (e) { console.warn('Could not save studio info', e); }
}

function persistPieces() {
  try { localStorage.setItem(STORAGE_PIECES, JSON.stringify(state.savedPieces)); }
  catch (e) { console.warn('Could not save pieces folder', e); }
}

// Navigation
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  $('breadcrumbs').hidden = (id === 'screen-welcome');
  updateBreadcrumbs(id);
  if (id === 'screen-studio') populateStudioForm();
  if (id === 'screen-piece') populatePieceForm();
  closeSideMenu();
  window.scrollTo(0, 0);
}

function updateBreadcrumbs(currentId) {
  document.querySelectorAll('.crumb').forEach(btn => {
    const target = btn.dataset.crumb;
    const reachable = target === 'screen-studio'
      || (target === 'screen-piece' && state.studio.hourlyRate !== null)
      || (target === 'screen-results' && state.piece.name !== null);
    btn.disabled = !reachable;
    btn.classList.toggle('active', target === currentId);
  });
}

document.querySelectorAll('[data-next]').forEach(btn => {
  btn.addEventListener('click', () => showScreen(btn.dataset.next));
});

document.querySelectorAll('.crumb').forEach(btn => {
  btn.addEventListener('click', () => { if (!btn.disabled) showScreen(btn.dataset.crumb); });
});

$('title-home').addEventListener('click', () => showScreen('screen-welcome'));

// Side menu
function openSideMenu() {
  $('side-menu').classList.add('open');
  $('side-menu-overlay').classList.add('open');
  document.body.classList.add('no-scroll');
  renderSideStudioSummary();
  renderSavedPieces();
}
function closeSideMenu() {
  $('side-menu').classList.remove('open');
  $('side-menu-overlay').classList.remove('open');
  document.body.classList.remove('no-scroll');
}
$('menu-toggle').addEventListener('click', openSideMenu);
$('side-menu-close').addEventListener('click', closeSideMenu);
$('side-menu-overlay').addEventListener('click', closeSideMenu);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSideMenu(); });

$('side-edit-studio').addEventListener('click', () => {
  closeSideMenu();
  showScreen('screen-studio');
});

function renderSideStudioSummary() {
  const el = $('side-studio-summary');
  const s = state.studio;
  if (s.hourlyRate === null) {
    el.innerHTML = '<p class="empty-note">Not set up yet.</p>';
    return;
  }
  el.innerHTML = `
    <div class="summary-row"><span>Monthly Studio Costs</span><strong>${money(s.monthlyCosts)}</strong></div>
    <div class="summary-row"><span>Desired Monthly Income</span><strong>${money(s.desiredIncome)}</strong></div>
    <div class="summary-row"><span>Productive Hours</span><strong>${s.productiveHours}</strong></div>
    <div class="summary-row"><span>Pieces / Month</span><strong>${s.piecesPerMonth}</strong></div>
    <div class="summary-row"><span>Hourly Rate</span><strong>${money(s.hourlyRate)}</strong></div>
    <div class="summary-row"><span>Studio Cost / Piece</span><strong>${money(s.studioCostPerPiece)}</strong></div>
  `;
}

function renderSavedPieces() {
  const list = $('pieces-list');
  const empty = $('pieces-empty');
  list.innerHTML = '';
  empty.hidden = state.savedPieces.length > 0;
  state.savedPieces.forEach(p => {
    const li = document.createElement('li');
    li.className = 'piece-item';
    li.innerHTML = `
      <button type="button" class="piece-item-open" data-id="${p.id}">
        ${p.image ? `<img class="piece-item-thumb" src="${p.image}" alt="">` : '<div class="piece-item-thumb"></div>'}
        <div class="piece-item-info">
          <span class="piece-item-name">${p.name}</span>
          <span class="piece-item-price">Studio ⭐ ${money(p.studioPrice)}</span>
        </div>
      </button>
      <button type="button" class="piece-item-delete" aria-label="Delete ${p.name}" data-id="${p.id}">✕</button>
    `;
    list.appendChild(li);
  });
}

$('pieces-list').addEventListener('click', (e) => {
  const del = e.target.closest('.piece-item-delete');
  if (del) {
    const id = Number(del.dataset.id);
    state.savedPieces = state.savedPieces.filter(p => p.id !== id);
    persistPieces();
    renderSavedPieces();
    return;
  }

  const open = e.target.closest('.piece-item-open');
  if (!open) return;
  const saved = state.savedPieces.find(p => p.id === Number(open.dataset.id));
  if (!saved || !saved.details) return;
  state.piece = JSON.parse(JSON.stringify(saved.details));
  showScreen('screen-piece');
});

// Chips
document.querySelectorAll('.chip-group').forEach(group => {
  group.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    group.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');
    if (group.dataset.field === 'isBatched') {
      const isYes = chip.dataset.value === 'yes';
      $('batch-details').hidden = !isYes;
      if (!isYes) {
        $('batch-details').querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      }
    }
  });
});

function chipValue(field) {
  const group = document.querySelector(`.chip-group[data-field="${field}"]`);
  const selected = group.querySelector('.chip.selected');
  if (!selected) return null;
  return selected.dataset.value ?? selected.textContent;
}

function selectChip(field, value) {
  const group = document.querySelector(`.chip-group[data-field="${field}"]`);
  group.querySelectorAll('.chip').forEach(c => {
    const v = c.dataset.value ?? c.textContent;
    c.classList.toggle('selected', value !== null && v === value);
  });
}

// Screen 2: Studio Setup
// Once the studio snapshot is showing, demote the save button to secondary
// so "Continue to Piece Details" reads as the primary action on the page.
function setStudioSaveState(completed) {
  const btn = $('btn-save-studio');
  btn.classList.toggle('btn-primary', !completed);
  btn.classList.toggle('btn-secondary', completed);
}

function populateStudioForm() {
  const s = state.studio;
  $('monthlyCosts').value = s.monthlyCosts ?? '';
  $('desiredIncome').value = s.desiredIncome ?? '';
  $('productiveHours').value = s.productiveHours ?? '';
  $('piecesPerMonth').value = s.piecesPerMonth ?? '';
  $('studio-error').hidden = true;
  const completed = s.hourlyRate !== null;
  if (completed) {
    $('snap-hourly').textContent = money(s.hourlyRate);
    $('snap-studiocost').textContent = money(s.studioCostPerPiece);
  }
  $('studio-snapshot').hidden = !completed;
  setStudioSaveState(completed);
}

$('form-studio').addEventListener('submit', (e) => {
  e.preventDefault();
  const monthlyCosts = parseFloat($('monthlyCosts').value);
  const desiredIncome = parseFloat($('desiredIncome').value);
  const productiveHours = parseFloat($('productiveHours').value);
  const piecesPerMonth = parseFloat($('piecesPerMonth').value);

  if ([monthlyCosts, desiredIncome, productiveHours, piecesPerMonth].some(v => isNaN(v) || v <= 0)) {
    $('studio-error').hidden = false;
    $('studio-error').textContent = 'Please fill in every field with a number greater than 0.';
    return;
  }
  $('studio-error').hidden = true;

  state.studio.monthlyCosts = monthlyCosts;
  state.studio.desiredIncome = desiredIncome;
  state.studio.productiveHours = productiveHours;
  state.studio.piecesPerMonth = piecesPerMonth;
  state.studio.hourlyRate = desiredIncome / productiveHours;
  state.studio.studioCostPerPiece = monthlyCosts / piecesPerMonth;
  persistStudio();

  $('snap-hourly').textContent = money(state.studio.hourlyRate);
  $('snap-studiocost').textContent = money(state.studio.studioCostPerPiece);
  $('studio-snapshot').hidden = false;
  setStudioSaveState(true);
  updateBreadcrumbs('screen-studio');

  // Completing studio setup is the moment we know something durable about this
  // maker, so promote them to an identified person and attach their economics.
  // With person_profiles: 'identified_only', visitors who never finish setup
  // stay anonymous.
  posthog.identify(studioDistinctId(), {
    monthly_studio_costs: monthlyCosts,
    desired_monthly_income: desiredIncome,
    productive_hours_per_month: productiveHours,
    pieces_per_month: piecesPerMonth,
    hourly_rate: state.studio.hourlyRate,
    studio_cost_per_piece: state.studio.studioCostPerPiece,
  });

  posthog.capture('studio_setup_completed', {
    hourly_rate: state.studio.hourlyRate,
    studio_cost_per_piece: state.studio.studioCostPerPiece,
    pieces_per_month: piecesPerMonth,
  });
});

// Screen 3: Piece Details
function resetPieceForm() {
  $('form-piece').reset();
  document.querySelectorAll('#form-piece .chip').forEach(c => c.classList.remove('selected'));
  $('batch-details').hidden = true;
  $('piece-error').hidden = true;
  $('pieceImagePreview').hidden = true;
  $('pieceImagePreview').removeAttribute('src');
}

function fillPieceForm() {
  const p = state.piece;
  $('pieceName').value = p.name || '';
  selectChip('productionMethod', p.productionMethod);
  selectChip('businessRole', p.businessRole);
  $('matClay').value = p.materials.clay;
  $('matGlaze').value = p.materials.glaze;
  $('matPackaging').value = p.materials.packaging;
  $('matOther').value = p.materials.other;
  $('firings').value = p.firings;
  selectChip('productionTimeMinutes', p.productionTimeMinutes !== null ? String(p.productionTimeMinutes) : null);
  selectChip('isBatched', p.batch.isBatched ? 'yes' : 'no');
  $('batch-details').hidden = !p.batch.isBatched;
  selectChip('batchSize', p.batch.isBatched ? String(p.batch.batchSize) : null);
  selectChip('timeSavings', p.batch.isBatched ? p.batch.timeSavings : null);
  selectChip('salesChannel', p.salesChannel);
  if (p.image) {
    $('pieceImagePreview').src = p.image;
    $('pieceImagePreview').hidden = false;
  } else {
    $('pieceImagePreview').hidden = true;
  }
}

function populatePieceForm() {
  if (state.piece.name) fillPieceForm(); else resetPieceForm();
}

function resizeImageFile(file, maxDim = 480) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

$('pieceImage').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) {
    state.piece.image = null;
    $('pieceImagePreview').hidden = true;
    return;
  }
  const dataUrl = await resizeImageFile(file);
  state.piece.image = dataUrl;
  $('pieceImagePreview').src = dataUrl;
  $('pieceImagePreview').hidden = false;
});

$('form-piece').addEventListener('submit', (e) => {
  e.preventDefault();

  const name = $('pieceName').value.trim();
  const productionMethod = chipValue('productionMethod');
  const businessRole = chipValue('businessRole');
  const productionTimeMinutes = chipValue('productionTimeMinutes');
  const salesChannel = chipValue('salesChannel');
  const isBatchedValue = chipValue('isBatched');
  const batchSize = chipValue('batchSize');
  const timeSavings = chipValue('timeSavings');

  const missing = !name || !productionMethod || !businessRole || !productionTimeMinutes ||
    !salesChannel || !isBatchedValue || (isBatchedValue === 'yes' && (!batchSize || !timeSavings));

  if (missing) {
    $('piece-error').hidden = false;
    $('piece-error').textContent = 'Please fill in every field before continuing.';
    return;
  }
  $('piece-error').hidden = true;

  state.piece.name = name;
  state.piece.productionMethod = productionMethod;
  state.piece.businessRole = businessRole;
  state.piece.materials.clay = parseFloat($('matClay').value) || 0;
  state.piece.materials.glaze = parseFloat($('matGlaze').value) || 0;
  state.piece.materials.packaging = parseFloat($('matPackaging').value) || 0;
  state.piece.materials.other = parseFloat($('matOther').value) || 0;
  state.piece.firings = parseFloat($('firings').value) || 0;
  state.piece.productionTimeMinutes = parseFloat(productionTimeMinutes);
  state.piece.batch.isBatched = isBatchedValue === 'yes';
  state.piece.batch.batchSize = state.piece.batch.isBatched ? parseFloat(batchSize) : null;
  state.piece.batch.timeSavings = state.piece.batch.isBatched ? timeSavings : null;
  state.piece.salesChannel = salesChannel;

  posthog.capture('piece_registered', {
    production_method: productionMethod,
    business_role: businessRole,
    sales_channel: salesChannel,
    production_time_minutes: state.piece.productionTimeMinutes,
    is_batched: state.piece.batch.isBatched,
  });

  calculateAndRender();
  showScreen('screen-results');
});

const TIME_SAVINGS_PCT = { 'Not really': 0, 'A little': 0.05, 'Quite a bit': 0.12, 'A lot': 0.20 };
const BATCH_SIZE_PCT = { 5: 0.02, 10: 0.05, 20: 0.08, 50: 0.10 };
const ROLE_MULTIPLIER = { 'Entry Product': 1.5, 'Core Collection': 1.8, 'Signature Piece': 2.2, 'Collector Piece': 2.6 };
const CHANNEL_MODIFIER = { 'Markets/Fairs': 0.9, 'Online': 1.0, 'Direct': 1.05, 'Gallery': 1.25 };

function calculateAndRender() {
  const { hourlyRate, studioCostPerPiece } = state.studio;
  const { materials, firings, productionTimeMinutes, batch, businessRole, salesChannel } = state.piece;

  const materialCost = materials.clay + materials.glaze + materials.packaging + materials.other;

  let effectiveMinutes = productionTimeMinutes;
  if (batch.isBatched) {
    const reduction = Math.min((TIME_SAVINGS_PCT[batch.timeSavings] || 0) + (BATCH_SIZE_PCT[batch.batchSize] || 0), 0.25);
    effectiveMinutes = productionTimeMinutes * (1 - reduction);
  }
  const laborCost = hourlyRate * (effectiveMinutes / 60);

  const trueCost = materialCost + firings + laborCost + studioCostPerPiece;

  const minimum = trueCost * 1.0;
  const studioPrice = trueCost * (ROLE_MULTIPLIER[businessRole] * CHANNEL_MODIFIER[salesChannel]);
  const collector = studioPrice * 1.3;

  $('price-min').textContent = money(minimum);
  $('price-studio').textContent = money(studioPrice);
  $('price-collector').textContent = money(collector);

  $('bd-clay').textContent = money(materials.clay);
  $('bd-glaze').textContent = money(materials.glaze);
  $('bd-packaging').textContent = money(materials.packaging);
  $('bd-other').textContent = money(materials.other);
  $('bd-firings').textContent = money(firings);
  $('bd-labor').textContent = money(laborCost);
  $('bd-studio').textContent = money(studioCostPerPiece);
  $('bd-total').textContent = money(trueCost);

  renderInsights({ laborCost, trueCost, studioCostPerPiece, productionTimeMinutes, businessRole, batch });

  state.savedPieces.unshift({
    id: Date.now(),
    name: state.piece.name,
    image: state.piece.image,
    minimum, studioPrice, collector,
    details: JSON.parse(JSON.stringify(state.piece))
  });
  persistPieces();

  posthog.capture('pricing_results_viewed', {
    business_role: businessRole,
    sales_channel: salesChannel,
    true_cost: trueCost,
    minimum_price: minimum,
    studio_price: studioPrice,
    collector_price: collector,
  });
}

function renderInsights({ laborCost, trueCost, studioCostPerPiece, productionTimeMinutes, businessRole, batch }) {
  const candidates = [];

  if (laborCost / trueCost > 0.4 || productionTimeMinutes >= 90) {
    candidates.push({
      title: 'Your time matters.',
      body: "Labor is a big part of this price — and that's a good thing. Your skill and time deserve to be paid for."
    });
  }
  if (studioCostPerPiece / trueCost > 0.2) {
    candidates.push({
      title: 'Your studio is part of every piece.',
      body: "Rent, utilities, tools — every piece you make helps carry these costs, even the ones that don't sell."
    });
  }
  if (businessRole === 'Signature Piece' || businessRole === 'Collector Piece') {
    candidates.push({
      title: "Handmade isn't priced by materials alone.",
      body: 'Signature and collector pieces carry your reputation and craft, not just the cost of clay and glaze.'
    });
  }
  if (batch.isBatched && (batch.timeSavings === 'Quite a bit' || batch.timeSavings === 'A lot')) {
    candidates.push({
      title: 'This piece benefits from batching.',
      body: "Producing this piece in a batch is saving you real time — and that's reflected in a lower labor cost per piece."
    });
  }

  const insights = $('insights');
  insights.innerHTML = '';
  candidates.slice(0, 3).forEach(c => {
    const div = document.createElement('div');
    div.className = 'insight-card';
    div.innerHTML = `<h3>${c.title}</h3><p>${c.body}</p>`;
    insights.appendChild(div);
  });
}

// Screen 4 actions
$('btn-another').addEventListener('click', () => {
  posthog.capture('price_another_piece_clicked', {
    pieces_priced_so_far: state.savedPieces.length,
  });
  state.piece = blankPiece();
  showScreen('screen-piece');
});

$('btn-restart').addEventListener('click', () => {
  localStorage.removeItem(STORAGE_STUDIO);
  location.reload();
});

// Init
loadPersisted();
updateBreadcrumbs('screen-welcome');
