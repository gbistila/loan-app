// Utilities
const $ = (sel) => document.querySelector(sel);
const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function toNumber(el) {
  const v = parseFloat(el.value);
  return Number.isFinite(v) ? v : 0;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function getParams() {
  const u = new URL(location.href);
  return Object.fromEntries(u.searchParams.entries());
}

function setParams(params) {
  const u = new URL(location.href);
  Object.entries(params).forEach(([k, v]) => {
    if (v === '' || v == null) u.searchParams.delete(k);
    else u.searchParams.set(k, v);
  });
  history.replaceState({}, '', u.toString());
}

// Inputs
const amount = $('#amount');
const down = $('#down');
const apr = $('#apr');
const term = $('#term');
const fees = $('#fees');
const startDate = $('#startDate');

// Outputs
const monthly = $('#monthly');
const totalPaid = $('#totalPaid');
const totalInterest = $('#totalInterest');
const payoffDate = $('#payoffDate');
const tbody = $('#schedule tbody');

// Buttons
const themeToggle = $('#themeToggle');
const copyLink = $('#copyLink');
const resetBtn = $('#reset');
const printBtn = $('#print');

// Theme
themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light');
});

// Presets
document.querySelectorAll('[data-preset]').forEach(btn => {
  btn.addEventListener('click', () => {
    amount.value = btn.dataset.amount || amount.value;
    term.value = btn.dataset.term || term.value;
    apr.value = btn.dataset.apr || apr.value;
    down.value = '0';
    fees.value = '0';
    calculate();
  });
});

// Copy link with current state
copyLink.addEventListener('click', async () => {
  const params = {
    amount: amount.value,
    down: down.value,
    apr: apr.value,
    term: term.value,
    fees: fees.value,
    start: startDate.value
  };
  setParams(params);
  try {
    await navigator.clipboard.writeText(location.href);
    copyLink.textContent = 'Link copied ✓';
    setTimeout(() => (copyLink.textContent = 'Copy shareable link'), 1500);
  } catch {
    alert('Copy failed. Long-press the address bar to share.');
  }
});

// Reset
resetBtn.addEventListener('click', () => {
  amount.value = 8000;
  down.value = 0;
  apr.value = 6.5;
  term.value = 12;
  fees.value = 0;
  startDate.value = '';
  calculate();
});

// Print
printBtn.addEventListener('click', (e) => {
  e.preventDefault();
  window.print();
});

// Load params on start
(function initFromURL() {
  const p = getParams();
  if (p.amount) amount.value = p.amount;
  if (p.down) down.value = p.down;
  if (p.apr) apr.value = p.apr;
  if (p.term) term.value = p.term;
  if (p.fees) fees.value = p.fees;
  if (p.start) startDate.value = p.start;
})();

// Recalculate on input
[amount, down, apr, term, fees, startDate].forEach(el =>
  el.addEventListener('input', calculate)
);

function calculate() {
  const A = toNumber(amount);
  const D = toNumber(down);
  const F = toNumber(fees);
  const N = Math.max(1, Math.floor(toNumber(term)));
  const APR = Math.max(0, toNumber(apr));
  const r = APR / 12 / 100;

  const principal = Math.max(0, round2(A - D + F));
  if (principal <= 0) {
    monthly.textContent = fmt.format(0);
    totalPaid.textContent = fmt.format(0);
    totalInterest.textContent = fmt.format(0);
    payoffDate.textContent = '—';
    tbody.innerHTML = '';
    return;
  }

  // Payment formula (PMT). If r == 0, equal payments.
  let payment = r === 0
    ? round2(principal / N)
    : round2((principal * r) / (1 - Math.pow(1 + r, -N)));

  // Build schedule
  tbody.innerHTML = '';
  let balance = principal;
  let interestTotal = 0;
  const start = startDate.value ? new Date(startDate.value) : new Date();

  for (let i = 1; i <= N; i++) {
    const interest = round2(balance * r);
    let principalPaid = round2(payment - interest);

    // Last payment adjustment to kill residuals from rounding
    if (i === N) {
      principalPaid = round2(balance);
      payment = round2(principalPaid + interest);
    } else {
      principalPaid = Math.min(principalPaid, round2(balance));
    }

    balance = round2(balance - principalPaid);
    interestTotal = round2(interestTotal + interest);

    const due = new Date(start);
    due.setMonth(due.getMonth() + (i - 1));
    const dueStr = due.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i}</td>
      <td>${fmt.format(payment)}</td>
      <td>${fmt.format(interest)}</td>
      <td>${fmt.format(principalPaid)}</td>
      <td>${fmt.format(balance)}</td>
      <td>${dueStr}</td>
    `;
    tbody.appendChild(tr);
  }

  const total = Array.from(tbody.querySelectorAll('tr')).reduce((sum, tr) => {
    const cell = tr.children[1].textContent.replace(/[^0-9.\-]/g, '');
    return sum + parseFloat(cell);
  }, 0);

  monthly.textContent = fmt.format(payment);
  totalPaid.textContent = fmt.format(round2(total));
  totalInterest.textContent = fmt.format(interestTotal);

  const payoff = startDate.value ? new Date(startDate.value) : new Date();
  payoff.setMonth(payoff.getMonth() + (N - 1));
  payoffDate.textContent = payoff.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
}

// Initial compute
calculate();
