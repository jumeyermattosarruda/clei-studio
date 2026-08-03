const state = {
  studio: {
    monthlyCosts: null,
    desiredIncome: null,
    productiveHours: null,
    piecesPerMonth: null,
    hourlyRate: null,
    studioCostPerPiece: null
  },
  piece: {
    name: null,
    productionMethod: null,
    businessRole: null,
    materials: { clay: 0, glaze: 0, packaging: 0, other: 0 },
    firings: 0,
    productionTimeMinutes: null,
    batch: { isBatched: false, batchSize: null, timeSavings: null },
    salesChannel: null
  }
};

const $ = (id) => document.getElementById(id);
const money = (n) => `$${n.toFixed(2)}`;

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  window.scrollTo(0, 0);
}

document.querySelectorAll('[data-next]').forEach(btn => {
  btn.addEventListener('click', () => showScreen(btn.dataset.next));
});

document.querySelectorAll('.tip-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.nextElementSibling.classList.toggle('open');
  });
});

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

// Screen 2: Studio Setup
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

  $('snap-hourly').textContent = money(state.studio.hourlyRate);
  $('snap-studiocost').textContent = money(state.studio.studioCostPerPiece);
  $('form-studio').hidden = true;
  $('studio-snapshot').hidden = false;
});

// Screen 3: Piece Details
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
  state.piece = {
    name: null,
    productionMethod: null,
    businessRole: null,
    materials: { clay: 0, glaze: 0, packaging: 0, other: 0 },
    firings: 0,
    productionTimeMinutes: null,
    batch: { isBatched: false, batchSize: null, timeSavings: null },
    salesChannel: null
  };
  $('form-piece').reset();
  document.querySelectorAll('#form-piece .chip').forEach(c => c.classList.remove('selected'));
  $('batch-details').hidden = true;
  $('piece-error').hidden = true;
  showScreen('screen-piece');
});

$('btn-restart').addEventListener('click', () => {
  location.reload();
});
