const fmtEUR = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const fmtEUR2 = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fmtPct = new Intl.NumberFormat("en-IE", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const chartSeries = [
  { key: "startBalance", label: "Start balance", color: "#1f77b4", enabled: true },
  { key: "contributions", label: "Contributions", color: "#2ca02c", enabled: true },
  { key: "grossGrowth", label: "Gross growth", color: "#ff7f0e", enabled: true },
  { key: "taxPaid", label: "Tax paid", color: "#d62728", enabled: true },
  { key: "endOfYearNetValue", label: "EOY net worth", color: "#9467bd", enabled: true },
];

function n(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function inputNumber(id) {
  const el = document.getElementById(id);
  return el ? n(el.value) : 0;
}

function inputPct(id) {
  return inputNumber(id) / 100;
}

function ymToDate(year, month) {
  return new Date(Date.UTC(year, month - 1, 1));
}

function dateStringToUtc(dateString) {
  return new Date(dateString + "T00:00:00Z");
}

function addMonthsToDateString(dateString, months) {
  const d = dateStringToUtc(dateString);
  const originalDay = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() !== originalDay) d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

function monthlyDateByPaymentDay(anchorDateString, monthOffset, paymentDay) {
  const anchor = dateStringToUtc(anchorDateString);
  const target = new Date(Date.UTC(
    anchor.getUTCFullYear(),
    anchor.getUTCMonth() + monthOffset,
    1
  ));

  const lastDayOfMonth = new Date(Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth() + 1,
    0
  )).getUTCDate();

  target.setUTCDate(Math.min(paymentDay, lastDayOfMonth));
  return target.toISOString().slice(0, 10);
}

function daysBetween(startDateString, endDateString) {
  const start = dateStringToUtc(startDateString);
  const end = dateStringToUtc(endDateString);
  return Math.round((end - start) / (24 * 3600 * 1000));
}

function addInputCell(row, type, value, attrs = {}) {
  const td = document.createElement("td");
  const input = document.createElement("input");
  input.type = type;
  input.value = value;
  Object.entries(attrs).forEach(([k, v]) => input.setAttribute(k, v));
  input.addEventListener("input", calculate);
  td.appendChild(input);
  row.appendChild(td);
  return input;
}

function addSelectCell(row, value, values) {
  const td = document.createElement("td");
  const select = document.createElement("select");

  values.forEach((v) => {
    const option = document.createElement("option");
    option.value = v;
    option.textContent = v;
    if (v === value) option.selected = true;
    select.appendChild(option);
  });

  select.addEventListener("change", calculate);
  td.appendChild(select);
  row.appendChild(td);
  return select;
}

function addRemoveButton(row) {
  const td = document.createElement("td");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "secondary";
  btn.textContent = "Remove";
  btn.addEventListener("click", () => {
    row.remove();
    calculate();
  });
  td.appendChild(btn);
  row.appendChild(td);
}

function addRateRow({ effectiveFrom = "2025-08-25", euribor = 2.08 } = {}) {
  const row = document.querySelector("#rateTable tbody").insertRow();
  addInputCell(row, "date", effectiveFrom);
  addInputCell(row, "number", euribor, { step: "0.01" });
  addRemoveButton(row);
}

function addEtfContributionRow({ amount = 0, frequency = "Yearly", month = 1, startYear = 2025, endYear = 2044 } = {}) {
  const row = document.querySelector("#etfContributionTable tbody").insertRow();
  addInputCell(row, "number", amount, { min: "0", step: "100" });
  addSelectCell(row, frequency, ["Yearly", "Monthly"]);
  addInputCell(row, "number", month, { min: "1", max: "12", step: "1" });
  addInputCell(row, "number", startYear, { min: "2000", max: "2100", step: "1" });
  addInputCell(row, "number", endYear, { min: "2000", max: "2100", step: "1" });
  addRemoveButton(row);
}

function addLumpSumRow({ amount = 0, year = 2025, month = 1, description = "" } = {}) {
  const row = document.querySelector("#lumpSumTable tbody").insertRow();
  addInputCell(row, "number", amount, { min: "0", step: "100" });
  addInputCell(row, "number", year, { min: "2000", max: "2100", step: "1" });
  addInputCell(row, "number", month, { min: "1", max: "12", step: "1" });
  addInputCell(row, "text", description);
  addRemoveButton(row);
}

function tableRows(selector) {
  return Array.from(document.querySelectorAll(`${selector} tbody tr`)).map((row) =>
    Array.from(row.querySelectorAll("input,select")).map((el) => el.value)
  );
}

function readModel() {
  const projectionStartYear = Math.round(inputNumber("projectionStartYear"));
  const projectionYears = Math.max(1, Math.round(inputNumber("projectionYears")));

  const mortgageStartDate = document.getElementById("mortgageStartDate")?.value || "2025-08-25";
  const firstPaymentDate = document.getElementById("firstPaymentDate")?.value || "2025-09-08";
  const repaymentStartDate = document.getElementById("repaymentStartDate")?.value || "2025-11-06";
  const paymentDayInput = document.getElementById("paymentDay");

  return {
    projectionStartYear,
    projectionYears,
    projectionEndYear: projectionStartYear + projectionYears - 1,

    etfStartingValue: inputNumber("etfStartingValue"),
    etfGrossReturn: inputPct("etfGrossReturn"),

    box3Allowance: inputNumber("box3Allowance"),
    allowanceGrowth: inputPct("allowanceGrowth"),
    debtThreshold: inputNumber("debtThreshold"),
    otherAssetsReturn: inputPct("otherAssetsReturn"),
    debtReturn: inputPct("debtReturn"),
    box3TaxRate: inputPct("box3TaxRate"),

    propertyValue: inputNumber("propertyValue"),
    downpayment: inputNumber("downpayment"),
    loanAmount: inputNumber("loanAmount"),
    mortgageStartDate,
    firstPaymentDate,
    repaymentStartDate,
    paymentDay: paymentDayInput ? Math.max(1, Math.min(31, Math.round(inputNumber("paymentDay")))) : 6,
    durationMonths: Math.max(1, Math.round(inputNumber("durationMonths"))),
    bankMargin: inputPct("bankMargin"),

    rateSchedule: tableRows("#rateTable")
      .map(([effectiveFrom, euribor]) => ({
        effectiveFrom,
        euribor: n(euribor) / 100,
      }))
      .filter((r) => r.effectiveFrom)
      .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)),

    etfContributions: tableRows("#etfContributionTable").map(([amount, frequency, month, startYear, endYear]) => ({
      amount: n(amount),
      frequency,
      month: Math.round(n(month, 1)),
      startYear: Math.round(n(startYear, projectionStartYear)),
      endYear: Math.round(n(endYear, projectionStartYear)),
    })),

    lumpSums: tableRows("#lumpSumTable").map(([amount, year, month, description]) => ({
      amount: n(amount),
      year: Math.round(n(year, projectionStartYear)),
      month: Math.round(n(month, 1)),
      description,
    })),
  };
}

function activeEuribor(model, dateString) {
  let active = model.rateSchedule[0]?.euribor ?? 0;

  for (const row of model.rateSchedule) {
    if (row.effectiveFrom <= dateString) active = row.euribor;
  }

  return active;
}

function activeAnnualMortgageRate(model, dateString) {
  return activeEuribor(model, dateString) + model.bankMargin;
}

function annuityPayment(principal, monthlyRate, remainingMonths) {
  if (principal <= 0 || remainingMonths <= 0) return 0;
  if (Math.abs(monthlyRate) < 1e-12) return principal / remainingMonths;
  return principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -remainingMonths));
}

function buildPaymentDates(model) {
  const dates = [];

  for (let i = 0; i < model.durationMonths; i += 1) {
    if (i === 0) {
      dates.push(model.firstPaymentDate);
    } else {
      /*
        Contract-aligned schedule:
        - first payment is exceptional: 2025-09-08
        - subsequent regular payments use contractual payment day = 6
        This matches the Luminor table: 2025-10-06, 2025-11-06, 2025-12-06, ...
      */
      dates.push(monthlyDateByPaymentDay(model.firstPaymentDate, i, model.paymentDay));
    }
  }

  return dates;
}

function buildMortgageSchedule(model) {
  const paymentDates = buildPaymentDates(model);
  const repaymentStartIndex = paymentDates.findIndex((d) => d >= model.repaymentStartDate);
  const principalStartIndex = repaymentStartIndex >= 0 ? repaymentStartIndex : 0;

  let balance = model.loanAmount;
  let currentPayment = 0;
  let currentRateResetKey = null;
  const records = [];

  for (let i = 0; i < paymentDates.length; i += 1) {
    const paymentDate = paymentDates[i];
    const prevDate = i === 0 ? model.mortgageStartDate : paymentDates[i - 1];

    const balanceStart = balance;
    const annualRate = activeAnnualMortgageRate(model, paymentDate);
    const monthlyRate = annualRate / 12;

    const isPrincipalPeriod = i >= principalStartIndex;
    const principalPeriodIndex = Math.max(0, i - principalStartIndex);
    const remainingPrincipalMonths = Math.max(1, model.durationMonths - principalPeriodIndex);

    const rateResetKey = `${Math.floor(principalPeriodIndex / 6)}-${annualRate.toFixed(8)}`;

    if (isPrincipalPeriod && rateResetKey !== currentRateResetKey) {
      currentRateResetKey = rateResetKey;
      currentPayment = annuityPayment(balanceStart, monthlyRate, remainingPrincipalMonths);
    }

    const days = Math.max(0, daysBetween(prevDate, paymentDate));

    let interest;
    if (!isPrincipalPeriod) {
      /*
        Irregular first periods use actual days:
        interest = opening debt × annual rate × days / 365.
      */
      interest = balanceStart * annualRate * days / 365;
    } else {
      /*
        Regular annuity rows use the contract table method:
        monthly interest = opening debt × annual rate / 12.
        With 3.65% and 144,750 debt, first annuity interest is about 440.28,
        giving principal about 415.27 at total payment about 855.55.
      */
      interest = balanceStart * monthlyRate;
    }

    let principal = 0;
    let payment = interest;

    if (isPrincipalPeriod) {
      payment = currentPayment;
      principal = Math.max(0, Math.min(balanceStart, payment - interest));
      payment = principal + interest;
    }

    balance = Math.max(0, balanceStart - principal);

    const d = dateStringToUtc(paymentDate);
    records.push({
      index: i + 1,
      dateString: paymentDate,
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      annualRate,
      days,
      balanceStart,
      principal,
      interest,
      payment,
      balanceEnd: balance,
      accumulatedCapital: model.downpayment + Math.max(0, model.loanAmount - balance),
    });
  }

  return records;
}

function mortgageSnapshotJan1(mortgageSchedule, year, model) {
  const jan1 = dateStringToUtc(`${year}-01-01`);

  const lastBeforeJan1 = mortgageSchedule
    .filter((r) => dateStringToUtc(r.dateString) < jan1)
    .sort((a, b) => a.dateString.localeCompare(b.dateString))
    .at(-1);

  if (lastBeforeJan1) {
    const principalRepaid = Math.max(0, model.loanAmount - lastBeforeJan1.balanceEnd);

    return {
      balanceStart: lastBeforeJan1.balanceEnd,
      accumulatedCapital: model.downpayment + principalRepaid,
    };
  }

  const start = dateStringToUtc(model.mortgageStartDate);
  if (jan1 < start) {
    return {
      balanceStart: model.loanAmount,
      accumulatedCapital: model.downpayment,
    };
  }

  return {
    balanceStart: model.loanAmount,
    accumulatedCapital: model.downpayment,
  };
}

function roundShareToDutchPercent2(share) {
  return Math.round(share * 10000) / 10000;
}

function calculateBox3(model, etfJan1, debtJan1, year) {
  const allowance = model.box3Allowance * Math.pow(1 + model.allowanceGrowth, year - model.projectionStartYear);
  const deductibleDebt = Math.max(0, debtJan1 - model.debtThreshold);

  const assets = etfJan1 + model.propertyValue;
  const rendementsgrondslag = Math.max(0, assets - deductibleDebt);
  const taxableBase = Math.max(0, rendementsgrondslag - allowance);
  const share = rendementsgrondslag > 0 ? roundShareToDutchPercent2(taxableBase / rendementsgrondslag) : 0;

  const assetReturn = assets * model.otherAssetsReturn;
  const debtReturnDeduction = deductibleDebt * model.debtReturn;
  const totalReturnBeforeShare = assetReturn - debtReturnDeduction;
  const box3Income = Math.max(0, totalReturnBeforeShare * share);
  const taxBeforeRelief = box3Income * model.box3TaxRate;

  const foreignReturnBeforeShare = model.propertyValue * model.otherAssetsReturn - debtReturnDeduction;
  const foreignIncome = Math.max(0, foreignReturnBeforeShare * share);
  const reliefFraction = box3Income > 0 ? Math.min(1, Math.max(0, foreignIncome / box3Income)) : 0;
  const treatyRelief = taxBeforeRelief * reliefFraction;
  const finalTax = Math.max(0, taxBeforeRelief - treatyRelief);

  return {
    allowance,
    deductibleDebt,
    assets,
    rendementsgrondslag,
    taxableBase,
    share,
    totalReturnBeforeShare,
    box3Income,
    taxBeforeRelief,
    foreignIncome,
    reliefFraction,
    treatyRelief,
    finalTax,
  };
}

function etfContributionForMonth(model, year, month) {
  const recurring = model.etfContributions.reduce((sum, c) => {
    if (c.amount <= 0 || year < c.startYear || year > c.endYear) return sum;
    if (c.frequency === "Monthly") return sum + c.amount;
    if (c.frequency === "Yearly" && c.month === month) return sum + c.amount;
    return sum;
  }, 0);

  const lump = model.lumpSums.reduce((sum, c) => {
    if (c.amount > 0 && c.year === year && c.month === month) return sum + c.amount;
    return sum;
  }, 0);

  return recurring + lump;
}

function xirrAnnualized(cashFlows, guess = 0.07) {
  const dated = cashFlows.filter((cf) => Math.abs(cf.amount) > 0.000001);
  if (!dated.some((cf) => cf.amount < 0) || !dated.some((cf) => cf.amount > 0)) return null;

  const t0 = dated[0].date.getTime();
  const years = (date) => (date.getTime() - t0) / (365.25 * 24 * 3600 * 1000);

  let rate = guess;
  for (let iter = 0; iter < 100; iter += 1) {
    let f = 0;
    let df = 0;

    for (const cf of dated) {
      const t = years(cf.date);
      const denom = Math.pow(1 + rate, t);
      f += cf.amount / denom;
      df += -t * cf.amount / (denom * (1 + rate));
    }

    if (Math.abs(df) < 1e-12) break;

    const next = rate - f / df;
    if (!Number.isFinite(next) || next <= -0.9999) break;
    if (Math.abs(next - rate) < 1e-8) return next;

    rate = next;
  }

  return Number.isFinite(rate) ? rate : null;
}

function simulate(model) {
  const mortgageSchedule = buildMortgageSchedule(model);
  const monthlyEtfReturn = Math.pow(1 + model.etfGrossReturn, 1 / 12) - 1;

  let etf = model.etfStartingValue;
  const annual = [];
  const cashFlows = [
    { date: ymToDate(model.projectionStartYear, 1), amount: -model.etfStartingValue },
  ];

  for (let year = model.projectionStartYear; year <= model.projectionEndYear; year += 1) {
    const startBalance = etf;
    const etfJan1 = etf;
    const mortgageJan1 = mortgageSnapshotJan1(mortgageSchedule, year, model);
    const box3 = calculateBox3(model, etfJan1, mortgageJan1.balanceStart, year);

    let contributions = 0;
    let grossGrowth = 0;

    for (let month = 1; month <= 12; month += 1) {
      const contribution = etfContributionForMonth(model, year, month);

      if (contribution > 0) {
        contributions += contribution;
        etf += contribution;
        cashFlows.push({ date: ymToDate(year, month), amount: -contribution });
      }

      const monthGrowth = etf * monthlyEtfReturn;
      grossGrowth += monthGrowth;
      etf += monthGrowth;
    }

    if (box3.finalTax > 0) {
      etf = Math.max(0, etf - box3.finalTax);
      cashFlows.push({ date: ymToDate(year, 12), amount: -box3.finalTax });
    }

    annual.push({
      year,
      startBalance,
      contributions,
      grossGrowth,
      taxPaid: box3.finalTax,
      endOfYearNetValue: etf,
      etfJan1,
      mortgageDebtJan1: mortgageJan1.balanceStart,
      accumulatedCapitalJan1: mortgageJan1.accumulatedCapital,
      box3,
    });
  }

  const finalDate = ymToDate(model.projectionEndYear, 12);
  cashFlows.push({ date: finalDate, amount: etf });

  const totalInvested = model.etfStartingValue + annual.reduce((s, r) => s + r.contributions + r.taxPaid, 0);
  const simpleCagr = totalInvested > 0
    ? Math.pow(etf / totalInvested, 1 / model.projectionYears) - 1
    : null;

  const moneyWeighted = xirrAnnualized(cashFlows);

  return {
    annual,
    mortgageSchedule,
    finalEtf: etf,
    totalInvested,
    totalTax: annual.reduce((s, r) => s + r.taxPaid, 0),
    simpleCagr,
    moneyWeighted,
  };
}

function niceCeil(value) {
  if (value <= 0) return 1;
  const power = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / power;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * power;
}

function niceFloor(value) {
  if (value >= 0) return 0;
  return -niceCeil(Math.abs(value));
}

function renderChartControls() {
  const container = document.getElementById("chartControls");
  if (!container) return;

  container.innerHTML = "";

  chartSeries.forEach((series) => {
    const label = document.createElement("label");
    label.className = "chart-control";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = series.enabled;
    checkbox.addEventListener("change", () => {
      series.enabled = checkbox.checked;
      if (window.__lastResult) renderChart(window.__lastResult.annual);
    });

    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = series.color;

    const text = document.createElement("span");
    text.textContent = series.label;

    label.appendChild(checkbox);
    label.appendChild(swatch);
    label.appendChild(text);
    container.appendChild(label);
  });
}

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
  return el;
}

function linePath(points) {
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
}

function renderChart(rows) {
  const svg = document.getElementById("summaryChart");
  if (!svg) return;

  svg.innerHTML = "";

  const rect = svg.getBoundingClientRect();
  const width = Math.max(680, rect.width || 1000);
  const height = Math.max(340, rect.height || 420);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const margin = { top: 24, right: 28, bottom: 46, left: 86 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const enabled = chartSeries.filter((s) => s.enabled);
  if (!rows.length || !enabled.length) {
    const text = svgEl("text", { x: width / 2, y: height / 2, "text-anchor": "middle", class: "chart-label" });
    text.textContent = "Enable at least one series";
    svg.appendChild(text);
    return;
  }

  const values = [];
  enabled.forEach((s) => rows.forEach((r) => values.push(r[s.key])));

  const minRaw = Math.min(...values);
  const maxRaw = Math.max(...values);
  const yMin = niceFloor(minRaw);
  const yMax = niceCeil(maxRaw === minRaw ? maxRaw + 1 : maxRaw);
  const yRange = yMax - yMin || 1;

  const years = rows.map((r) => r.year);
  const xMin = Math.min(...years);
  const xMax = Math.max(...years);
  const xRange = Math.max(1, xMax - xMin);

  const xScale = (year) => margin.left + ((year - xMin) / xRange) * plotW;
  const yScale = (value) => margin.top + ((yMax - value) / yRange) * plotH;

  const ticks = 5;
  for (let i = 0; i <= ticks; i += 1) {
    const value = yMin + (yRange * i) / ticks;
    const y = yScale(value);
    svg.appendChild(svgEl("line", { x1: margin.left, y1: y, x2: width - margin.right, y2: y, class: "chart-grid" }));

    const label = svgEl("text", { x: margin.left - 10, y: y + 4, "text-anchor": "end", class: "chart-label" });
    label.textContent = fmtEUR.format(value);
    svg.appendChild(label);
  }

  rows.forEach((row, idx) => {
    const shouldLabel = rows.length <= 15 || idx === 0 || idx === rows.length - 1 || idx % Math.ceil(rows.length / 10) === 0;
    if (!shouldLabel) return;

    const x = xScale(row.year);
    const label = svgEl("text", { x, y: height - 16, "text-anchor": "middle", class: "chart-label" });
    label.textContent = row.year;
    svg.appendChild(label);
  });

  svg.appendChild(svgEl("line", { x1: margin.left, y1: margin.top, x2: margin.left, y2: height - margin.bottom, class: "chart-axis" }));
  svg.appendChild(svgEl("line", { x1: margin.left, y1: height - margin.bottom, x2: width - margin.right, y2: height - margin.bottom, class: "chart-axis" }));

  enabled.forEach((series) => {
    const points = rows.map((r) => ({
      x: xScale(r.year),
      y: yScale(r[series.key]),
      value: r[series.key],
      year: r.year,
    }));

    svg.appendChild(svgEl("path", {
      d: linePath(points),
      class: "chart-line",
      stroke: series.color,
    }));

    points.forEach((p) => {
      const circle = svgEl("circle", {
        cx: p.x,
        cy: p.y,
        r: 3.5,
        fill: series.color,
        class: "chart-point",
      });

      const title = svgEl("title");
      title.textContent = `${series.label}, ${p.year}: ${fmtEUR.format(p.value)}`;
      circle.appendChild(title);
      svg.appendChild(circle);
    });
  });
}

function renderMortgageTable(schedule) {
  const tbody = document.querySelector("#mortgageTable tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  schedule.forEach((r) => {
    const tr = tbody.insertRow();

    [
      r.index,
      r.dateString,
      fmtPct.format(r.annualRate),
      r.days,
      fmtEUR2.format(r.balanceStart),
      fmtEUR2.format(r.principal),
      fmtEUR2.format(r.interest),
      fmtEUR2.format(r.payment),
      fmtEUR2.format(r.balanceEnd),
    ].forEach((value, i) => {
      const td = tr.insertCell();
      td.textContent = value;
      if (i <= 1) td.style.textAlign = "left";
    });
  });
}

function render(result) {
  document.getElementById("finalEtf").textContent = fmtEUR.format(result.finalEtf);
  const lastAnnualRow = result.annual[result.annual.length - 1];
  const finalNetWorth = lastAnnualRow ? lastAnnualRow.endOfYearNetValue : result.finalEtf;
  const finalNetWorthEl = document.getElementById("finalNetWorth");
  if (finalNetWorthEl) finalNetWorthEl.textContent = fmtEUR.format(finalNetWorth);
  document.getElementById("totalTax").textContent = fmtEUR.format(result.totalTax);
  document.getElementById("simpleCagr").textContent = result.simpleCagr === null ? "n/a" : fmtPct.format(result.simpleCagr);
  document.getElementById("moneyWeighted").textContent = result.moneyWeighted === null ? "n/a" : fmtPct.format(result.moneyWeighted);

  const tbody = document.querySelector("#summaryTable tbody");
  tbody.innerHTML = "";

  result.annual.forEach((r) => {
    const tr = tbody.insertRow();
    const values = [
      r.year,
      fmtEUR.format(r.startBalance),
      fmtEUR.format(r.contributions),
      fmtEUR.format(r.grossGrowth),
      fmtEUR.format(r.taxPaid),
      fmtEUR.format(r.endOfYearNetValue),
      fmtEUR.format(r.mortgageDebtJan1),
      fmtEUR.format(r.accumulatedCapitalJan1),
      fmtEUR.format(r.box3.taxBeforeRelief),
      fmtEUR.format(r.box3.treatyRelief),
    ];

    values.forEach((value, i) => {
      const td = tr.insertCell();
      td.textContent = value;
      if (i === 0) td.style.textAlign = "left";
    });
  });

  renderChart(result.annual);
  renderMortgageTable(result.mortgageSchedule);
}

function calculate() {
  const model = readModel();
  const result = simulate(model);
  window.__lastResult = result;
  render(result);
}

function rowsToCsv(rows) {
  return rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
}

function triggerCsvDownload(filename, rows) {
  const blob = new Blob([rowsToCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

function downloadCsv() {
  const result = window.__lastResult || simulate(readModel());
  const rows = [
    [
      "Year",
      "Start balance",
      "Contributions",
      "Gross growth",
      "Tax paid",
      "EOY net worth",
      "Mortgage debt Jan 1",
      "Accumulated property capital Jan 1",
      "Box 3 tax before relief",
      "LT treaty relief",
    ],
    ...result.annual.map((r) => [
      r.year,
      r.startBalance.toFixed(2),
      r.contributions.toFixed(2),
      r.grossGrowth.toFixed(2),
      r.taxPaid.toFixed(2),
      r.endOfYearNetValue.toFixed(2),
      r.mortgageDebtJan1.toFixed(2),
      r.accumulatedCapitalJan1.toFixed(2),
      r.box3.taxBeforeRelief.toFixed(2),
      r.box3.treatyRelief.toFixed(2),
    ]),
  ];

  triggerCsvDownload("summary_projection.csv", rows);
}

function downloadMortgageCsv() {
  const result = window.__lastResult || simulate(readModel());
  const rows = [
    ["#", "Payment date", "Rate", "Days", "Start debt", "Principal", "Interest", "Total payment", "End debt"],
    ...result.mortgageSchedule.map((r) => [
      r.index,
      r.dateString,
      (r.annualRate * 100).toFixed(4) + "%",
      r.days,
      r.balanceStart.toFixed(2),
      r.principal.toFixed(2),
      r.interest.toFixed(2),
      r.payment.toFixed(2),
      r.balanceEnd.toFixed(2),
    ]),
  ];

  triggerCsvDownload("mortgage_forecast.csv", rows);
}

function runSelfTests() {
  const model = {
    projectionStartYear: 2025,
    projectionYears: 1,
    projectionEndYear: 2025,
    etfStartingValue: 55000,
    etfGrossReturn: 0.10,
    box3Allowance: 57684,
    allowanceGrowth: 0,
    debtThreshold: 3800,
    otherAssetsReturn: 0.0588,
    debtReturn: 0.027,
    box3TaxRate: 0.36,
    propertyValue: 204000,
    downpayment: 59250,
    loanAmount: 144750,
    mortgageStartDate: "2025-08-25",
    firstPaymentDate: "2025-09-08",
    repaymentStartDate: "2025-11-06",
    paymentDay: 6,
    durationMonths: 240,
    bankMargin: 0.0157,
    rateSchedule: [{ effectiveFrom: "2025-08-25", euribor: 0.0208 }],
    etfContributions: [],
    lumpSums: [],
  };

  const schedule = buildMortgageSchedule(model);

  console.assert(schedule[0].dateString === "2025-09-08", "First payment date should match contract table");
  console.assert(schedule[1].dateString === "2025-10-06", "Second payment date should match contract table");
  console.assert(schedule[2].dateString === "2025-11-06", "Third payment date should match contract table");
  console.assert(schedule[3].dateString === "2025-12-06", "Fourth payment date should match contract table");

  console.assert(Math.abs(schedule[0].principal) < 0.01, "First payment should be interest-only");
  console.assert(Math.abs(schedule[1].principal) < 0.01, "Second payment should be interest-only");
  console.assert(schedule[2].principal > 0, "Third payment should start principal repayment");

  console.assert(Math.abs(schedule[2].principal - 415.27) < 2, "First annuity principal should be close to contract table");
  console.assert(Math.abs(schedule[3].principal - 416.53) < 2, "Second annuity principal should be close to contract table");
  console.assert(Math.abs(schedule[2].payment - 855.55) < 2, "First annuity payment should be close to contract table");

  const jan2026 = mortgageSnapshotJan1(schedule, 2026, model);
  console.assert(
    Math.abs(jan2026.accumulatedCapital - 60081.80) < 2,
    "Jan 1 2026 accumulated capital should include Nov and Dec 2025 principal repayments"
  );

  const tax = calculateBox3(model, 55000, 142000, 2025);
  console.assert(tax.finalTax >= 0, "Final NL tax should never be negative");
}

document.querySelectorAll("input").forEach((el) => el.addEventListener("input", calculate));

document.getElementById("addRateRow")?.addEventListener("click", () => {
  addRateRow({ effectiveFrom: document.getElementById("mortgageStartDate")?.value || "2025-08-25", euribor: 2.08 });
  calculate();
});

document.getElementById("addEtfContribution")?.addEventListener("click", () => {
  const start = Math.round(inputNumber("projectionStartYear"));
  addEtfContributionRow({
    amount: 0,
    frequency: "Yearly",
    month: 1,
    startYear: start,
    endYear: start + Math.round(inputNumber("projectionYears")) - 1,
  });
  calculate();
});

document.getElementById("addLumpSum")?.addEventListener("click", () => {
  addLumpSumRow({ year: Math.round(inputNumber("projectionStartYear")), month: 1 });
  calculate();
});

document.getElementById("downloadCsv")?.addEventListener("click", downloadCsv);
document.getElementById("downloadMortgageCsv")?.addEventListener("click", downloadMortgageCsv);

document.getElementById("resetChartSeries")?.addEventListener("click", () => {
  chartSeries.forEach((s) => {
    s.enabled = true;
  });
  renderChartControls();
  if (window.__lastResult) renderChart(window.__lastResult.annual);
});

window.addEventListener("resize", () => {
  if (window.__lastResult) renderChart(window.__lastResult.annual);
});

addRateRow({ effectiveFrom: "2025-08-25", euribor: 2.08 });
addEtfContributionRow({ amount: 10000, frequency: "Yearly", month: 1, startYear: 2025, endYear: 2027 });
addEtfContributionRow({ amount: 16500, frequency: "Yearly", month: 1, startYear: 2028, endYear: 2044 });
addLumpSumRow({ amount: 0, year: 2025, month: 6, description: "Optional" });

renderChartControls();
runSelfTests();
calculate();
