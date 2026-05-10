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

const scenarioDefs = [
  { key: "A", label: "A. Repay 2nd mortgage + buy NL property", color: "#1f77b4", enabled: true },
  { key: "B", label: "B. Sell 2nd property + buy NL property", color: "#ff7f0e", enabled: true },
  { key: "C", label: "C. Keep 2nd property + no NL property", color: "#2ca02c", enabled: true },
  { key: "D", label: "D. Sell 2nd property + ETF only", color: "#9467bd", enabled: true },
];

const BOX3_2025_SINGLE_ALLOWANCE = 57684;
const BOX3_2025_PARTNER_ALLOWANCE = 115368;
const BOX3_2025_SINGLE_DEBT_THRESHOLD = 3800;
const BOX3_2025_PARTNER_DEBT_THRESHOLD = 7600;

const EUROZONE_HISTORICAL_INFLATION = {
  1997: 0.015, 1998: 0.008, 1999: 0.017, 2000: 0.026, 2001: 0.021, 2002: 0.023,
  2003: 0.020, 2004: 0.024, 2005: 0.023, 2006: 0.019, 2007: 0.031, 2008: 0.017,
  2009: 0.009, 2010: 0.022, 2011: 0.027, 2012: 0.022, 2013: 0.008, 2014: -0.002,
  2015: 0.002, 2016: 0.011, 2017: 0.013, 2018: 0.015, 2019: 0.013, 2020: -0.003,
  2021: 0.050, 2022: 0.093, 2023: 0.029, 2024: 0.024, 2025: 0.020
};

const STORED_COMPARE_KEY = "scenarioCalculatorStoredComparisonV1";

let activeDetailScenario = "A";
let chartZoom = 1;
let chartSelectedPoint = null;
let summaryCurrency = "EUR";
let fxRates = { EUR: 1, USD: null, RUB: null };
let fxMeta = { USD: "", RUB: "" };

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

function dateUTC(dateString) {
  return new Date(dateString + "T00:00:00Z");
}

function ymToDate(year, month) {
  return new Date(Date.UTC(year, month - 1, 1));
}

function dateYear(dateString) {
  return dateUTC(dateString).getUTCFullYear();
}

function dateMonth(dateString) {
  return dateUTC(dateString).getUTCMonth() + 1;
}

function daysBetween(startDateString, endDateString) {
  return Math.round((dateUTC(endDateString) - dateUTC(startDateString)) / (24 * 3600 * 1000));
}

function monthlyDateByDay(anchorDateString, offset, paymentDay) {
  const anchor = dateUTC(anchorDateString);
  const d = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + offset, 1));
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(paymentDay, lastDay));
  return d.toISOString().slice(0, 10);
}

function formatYearMonth(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function tableRows(selector) {
  return Array.from(document.querySelectorAll(`${selector} tbody tr`)).map(row =>
    Array.from(row.querySelectorAll("input,select")).map(el => el.value)
  );
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
  values.forEach(v => {
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
  const button = document.createElement("button");
  button.type = "button";
  button.className = "secondary";
  button.textContent = "Remove";
  button.addEventListener("click", () => {
    row.remove();
    calculate();
  });
  td.appendChild(button);
  row.appendChild(td);
}

function addRateRow({ effectiveFrom = "2025-08-25", euribor = 2.08 } = {}) {
  const row = document.querySelector("#rateTable tbody").insertRow();
  addInputCell(row, "date", effectiveFrom);
  addInputCell(row, "number", euribor, { step: "0.01" });
  addRemoveButton(row);
}

function addEtfContributionRow({ amount = 0, frequency = "Yearly", month = 1, startYear = 2025, endYear = 2045 } = {}) {
  const row = document.querySelector("#etfContributionTable tbody").insertRow();
  addInputCell(row, "number", amount, { min: "0", step: "100" });
  addSelectCell(row, frequency, ["Yearly", "Monthly"]);
  addInputCell(row, "number", month, { min: "1", max: "12", step: "1" });
  addInputCell(row, "number", startYear, { min: "2000", max: "2100" });
  addInputCell(row, "number", endYear, { min: "2000", max: "2100" });
  addRemoveButton(row);
}

function addLumpContributionRow({ amount = 0, year = 2026, month = 1, destination = "ETF", description = "" } = {}) {
  const row = document.querySelector("#lumpContributionTable tbody").insertRow();
  addInputCell(row, "number", amount, { min: "0", step: "100" });
  addInputCell(row, "number", year, { min: "2000", max: "2100" });
  addInputCell(row, "number", month, { min: "1", max: "12" });
  addSelectCell(row, destination, ["ETF", "2nd repayment"]);
  addInputCell(row, "text", description);
  addRemoveButton(row);
}


function addSecondPropertyTaxBracketRow({ lower = 150000, upper = 300000, rate = 0.5 } = {}) {
  const row = document.querySelector("#secondPropertyTaxTable tbody").insertRow();
  addInputCell(row, "number", lower, { min: "0", step: "1000" });
  addInputCell(row, "number", upper === null ? "" : upper, { min: "0", step: "1000", placeholder: "No cap" });
  addInputCell(row, "number", rate, { min: "0", step: "0.01" });
  addRemoveButton(row);
}

function syncProjectionYears() {
  const start = Math.round(inputNumber("projectionStartYear"));
  const retirement = Math.max(start, Math.round(inputNumber("retirementYear") || start));
  const years = Math.max(1, retirement - start + 1);
  const el = document.getElementById("projectionYears");
  if (el) el.value = years;
  return { start, retirement, years };
}

function readModel() {
  const { start, retirement, years } = syncProjectionYears();

  return {
    projectionStartYear: start,
    retirementYear: retirement,
    projectionYears: years,
    projectionEndYear: retirement,

    etfStartingValue: inputNumber("etfStartingValue"),
    externalCashReserve: inputNumber("externalCashReserve"),
    etfGrossReturn: inputPct("etfGrossReturn"),
    personalInflation: inputPct("personalInflation"),

    hasFiscalPartner: document.getElementById("hasFiscalPartner")?.checked === true,
    box3Allowance: inputNumber("box3Allowance"),
    debtThreshold: inputNumber("debtThreshold"),
    box3SavingsBalance: inputNumber("box3SavingsBalance"),
    box3SavingsReturn: inputPct("box3SavingsReturn"),
    otherAssetsReturn: inputPct("otherAssetsReturn"),
    debtReturn: inputPct("debtReturn"),
    box3TreatyReliefEnabled: (document.getElementById("box3TreatyReliefEnabled")?.value || "yes") === "yes",
    box3DebtAllocationMode: document.getElementById("box3DebtAllocationMode")?.value || "proportional",
    box3TaxRate: inputPct("box3TaxRate"),

    ltPropertyValue: inputNumber("ltPropertyValue"),
    ltDownpayment: inputNumber("ltDownpayment"),
    ltLoanAmount: inputNumber("ltLoanAmount"),
    ltStartDate: document.getElementById("ltStartDate")?.value || "2025-08-25",
    ltFirstPayment: document.getElementById("ltFirstPayment")?.value || "2025-09-08",
    ltPrincipalStart: document.getElementById("ltPrincipalStart")?.value || "2025-11-06",
    ltPaymentDay: Math.max(1, Math.min(31, Math.round(inputNumber("ltPaymentDay") || 6))),
    ltMonths: Math.max(1, Math.round(inputNumber("ltMonths") || 240)),
    ltMargin: inputPct("ltMargin"),
    ltAppreciation: inputPct("ltAppreciation"),
    secondPropertyTaxEnabled: (document.getElementById("secondPropertyTaxEnabled")?.value || "yes") === "yes",
    secondPropertyTaxableValue: inputNumber("secondPropertyTaxableValue"),
    secondPropertyTaxableGrowth: inputPct("secondPropertyTaxableGrowth"),
    secondPropertyTaxOwners: Math.max(1, Math.round(inputNumber("secondPropertyTaxOwners") || 1)),
    secondPropertyTaxBrackets: tableRows("#secondPropertyTaxTable").map(([lower, upper, rate]) => ({
      lower: n(lower),
      upper: upper === "" ? null : n(upper),
      rate: n(rate) / 100,
    })).sort((a, b) => a.lower - b.lower),

    amsPrice: inputNumber("amsPrice"),
    amsLoan: inputNumber("amsLoan"),
    amsRate: inputPct("amsRate"),
    amsMonths: Math.max(1, Math.round(inputNumber("amsMonths") || 360)),
    amsAppreciation: inputPct("amsAppreciation"),
    amsCosts: inputNumber("amsCosts"),
    amsNetMortgagePayment: inputNumber("amsNetMortgagePayment"),
    ownershipCosts: inputNumber("ownershipCosts"),
    rentAvoided: inputNumber("rentAvoided"),

    rateSchedule: tableRows("#rateTable")
      .map(([effectiveFrom, euribor]) => ({ effectiveFrom, euribor: n(euribor) / 100 }))
      .filter(r => r.effectiveFrom)
      .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)),

    etfContributions: tableRows("#etfContributionTable").map(([amount, frequency, month, startYear, endYear]) => ({
      amount: n(amount),
      frequency,
      month: Math.round(n(month, 1)),
      startYear: Math.round(n(startYear, start)),
      endYear: Math.round(n(endYear, start)),
    })),

    lumpContributions: tableRows("#lumpContributionTable").map(([amount, year, month, destination, description]) => ({
      amount: n(amount),
      year: Math.round(n(year, start)),
      month: Math.round(n(month, 1)),
      destination,
      description,
    })),

    scenarios: {
      A: {
        useEtf: document.getElementById("aUseEtf")?.value === "yes",
        extraCash: inputNumber("aExtraCash"),
        earliestPurchaseYear: Math.round(inputNumber("aEarliestPurchaseYear")),
        maxWaitYear: Math.round(inputNumber("aMaxWaitYear")),
      },
      B: {
        saleYear: Math.round(inputNumber("bSaleYear")),
        saleMonth: Math.round(inputNumber("bSaleMonth") || 1),
        purchaseYear: Math.round(inputNumber("bPurchaseYear")),
        saleCostsPct: inputPct("bSaleCostsPct"),
        motherReserve: inputNumber("bMotherReserve"),
        allocate: document.getElementById("bAllocate")?.value || "ETF",
      },
      C: {},
      D: {
        saleYear: Math.round(inputNumber("dSaleYear")),
        saleMonth: Math.round(inputNumber("dSaleMonth") || 1),
        saleCostsPct: inputPct("dSaleCostsPct"),
        motherReserve: inputNumber("dMotherReserve"),
      },
    },
  };
}

function activeEuribor(model, dateString) {
  let active = model.rateSchedule[0]?.euribor ?? 0;
  for (const row of model.rateSchedule) {
    if (row.effectiveFrom <= dateString) active = row.euribor;
  }
  return active;
}

function annuityPayment(principal, monthlyRate, months) {
  if (principal <= 0 || months <= 0) return 0;
  if (Math.abs(monthlyRate) < 1e-12) return principal / months;
  return principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months));
}

function buildLtSchedule(model) {
  const dates = [];
  for (let i = 0; i < model.ltMonths; i += 1) {
    dates.push(i === 0 ? model.ltFirstPayment : monthlyDateByDay(model.ltFirstPayment, i, model.ltPaymentDay));
  }

  const principalStartIndexRaw = dates.findIndex(d => d >= model.ltPrincipalStart);
  const principalStartIndex = principalStartIndexRaw >= 0 ? principalStartIndexRaw : 0;
  const principalMonthsTotal = Math.max(1, dates.length - principalStartIndex);

  const lumpMap = new Map();
  (model.lumpContributions || [])
    .filter(x => x.destination === "2nd repayment")
    .forEach(x => {
      if (x.amount > 0) {
        const key = formatYearMonth(x.year, x.month);
        lumpMap.set(key, (lumpMap.get(key) || 0) + x.amount);
      }
    });

  let balance = model.ltLoanAmount;
  let payment = 0;
  let resetKey = null;
  const rows = [];

  for (let i = 0; i < dates.length; i += 1) {
    const dateString = dates[i];
    const prevDate = i === 0 ? model.ltStartDate : dates[i - 1];
    const balanceStart = balance;
    const annualRate = activeEuribor(model, dateString) + model.ltMargin;
    const monthlyRate = annualRate / 12;
    const isPrincipalPeriod = i >= principalStartIndex;
    const principalPeriodIndex = Math.max(0, i - principalStartIndex);
    const remainingPrincipalMonths = Math.max(1, principalMonthsTotal - principalPeriodIndex);
    const key = `${Math.floor(principalPeriodIndex / 6)}-${annualRate.toFixed(8)}-${balanceStart.toFixed(2)}`;

    if (isPrincipalPeriod && key !== resetKey) {
      resetKey = key;
      payment = annuityPayment(balanceStart, monthlyRate, remainingPrincipalMonths);
    }

    const interest = isPrincipalPeriod
      ? balanceStart * monthlyRate
      : balanceStart * annualRate * Math.max(0, daysBetween(prevDate, dateString)) / 365;

    let principal = isPrincipalPeriod ? Math.max(0, Math.min(balanceStart, payment - interest)) : 0;

    const ym = formatYearMonth(dateYear(dateString), dateMonth(dateString));
    const lump = Math.max(0, Math.min(balanceStart - principal, lumpMap.get(ym) || 0));
    principal += lump;
    balance = Math.max(0, balanceStart - principal);

    rows.push({
      dateString,
      year: dateYear(dateString),
      month: dateMonth(dateString),
      balanceStart,
      balanceEnd: balance,
      principal,
      interest,
      payment: principal + interest,
      lumpRepayment: lump,
    });
  }

  return rows;
}

function buildAmsSchedule(model, purchaseYear, loan) {
  let balance = loan;
  const monthlyRate = model.amsRate / 12;
  const payment = annuityPayment(loan, monthlyRate, model.amsMonths);
  const rows = [];

  for (let i = 0; i < model.amsMonths; i += 1) {
    const d = ymToDate(purchaseYear, 1 + i);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const balanceStart = balance;
    const interest = balanceStart * monthlyRate;
    const principal = Math.max(0, Math.min(balanceStart, payment - interest));
    balance = Math.max(0, balanceStart - principal);

    rows.push({ year, month, balanceStart, balanceEnd: balance, principal, interest, payment: principal + interest });
  }

  return rows;
}

function debtJan1(schedule, year, initialDebt) {
  const prior = schedule.filter(r => r.year < year).at(-1);
  return prior ? prior.balanceEnd : initialDebt;
}

function debtEoy(schedule, year, initialDebt) {
  const prior = schedule.filter(r => r.year <= year).at(-1);
  return prior ? prior.balanceEnd : initialDebt;
}

function debtAtYearMonth(schedule, year, month, initialDebt) {
  const prior = schedule.filter(r => r.year < year || (r.year === year && r.month <= month)).at(-1);
  return prior ? prior.balanceEnd : initialDebt;
}

function ltValueAtMonth(model, year, month, sold) {
  if (sold) return 0;
  const t = (year - model.projectionStartYear) + ((month - 1) / 12);
  return model.ltPropertyValue * Math.pow(1 + model.ltAppreciation, Math.max(0, t));
}

function ltValueEoy(model, year, sold) {
  return ltValueAtMonth(model, year, 12, sold);
}



function secondPropertyTaxableValueForYear(model, year) {
  const base = Math.max(0, model.secondPropertyTaxableValue || 0);
  if (base <= 0) return 0;

  const years = Math.max(0, year - model.projectionStartYear);
  return base * Math.pow(1 + (model.secondPropertyTaxableGrowth || 0), years);
}

function calculateSecondPropertyTax(model, taxableValue) {
  if (!model.secondPropertyTaxEnabled || taxableValue <= 0) return 0;

  const owners = Math.max(1, model.secondPropertyTaxOwners || 1);
  const allocatedValue = taxableValue / owners;
  let taxPerOwner = 0;

  for (const bracket of model.secondPropertyTaxBrackets || []) {
    const lower = Math.max(0, bracket.lower || 0);
    const upper = bracket.upper === null || bracket.upper === undefined ? Infinity : bracket.upper;
    const taxableSlice = Math.max(0, Math.min(allocatedValue, upper) - lower);
    taxPerOwner += taxableSlice * (bracket.rate || 0);
  }

  return taxPerOwner * owners;
}

function amsValueEoy(model, purchaseYear, year, owned) {
  if (!owned || year < purchaseYear) return 0;
  return model.amsPrice * Math.pow(1 + model.amsAppreciation, year - purchaseYear + 1);
}

function etfContribution(model, year, month) {
  return model.etfContributions.reduce((sum, c) => {
    if (c.amount <= 0 || year < c.startYear || year > c.endYear) return sum;
    if (c.frequency === "Monthly") return sum + c.amount;
    if (c.frequency === "Yearly" && c.month === month) return sum + c.amount;
    return sum;
  }, 0);
}

function etfLump(model, year, month) {
  return (model.lumpContributions || [])
    .filter(x => x.destination === "ETF" && x.year === year && x.month === month)
    .reduce((sum, x) => sum + x.amount, 0);
}

function effectiveAllowance(model) {
  return model.hasFiscalPartner ? BOX3_2025_PARTNER_ALLOWANCE : model.box3Allowance;
}

function effectiveDebtThreshold(model) {
  return model.hasFiscalPartner ? BOX3_2025_PARTNER_DEBT_THRESHOLD : model.debtThreshold;
}

function calculateBox3Detailed(model, etf, secondDebt, secondTaxValue, sold) {
  const savings = Math.max(0, model.box3SavingsBalance || 0);
  const investments = Math.max(0, etf || 0);
  const foreignRealEstate = sold ? 0 : Math.max(0, secondTaxValue || 0);

  const grossDebt = model.box3DebtAllocationMode === "no_debt" ? 0 : Math.max(0, secondDebt || 0);
  const deductibleDebt = Math.max(0, grossDebt - effectiveDebtThreshold(model));

  const totalAssets = savings + investments + foreignRealEstate;
  const rendementsgrondslag = Math.max(0, totalAssets - deductibleDebt);
  const taxableBase = Math.max(0, rendementsgrondslag - effectiveAllowance(model));
  const taxableShare = rendementsgrondslag > 0 ? Math.round((taxableBase / rendementsgrondslag) * 10000) / 10000 : 0;

  let exemptDebtAllocation = 0;
  if (model.box3DebtAllocationMode === "proportional" && totalAssets > 0 && foreignRealEstate > 0) {
    exemptDebtAllocation = deductibleDebt * (foreignRealEstate / totalAssets);
  }

  const dutchDebtAllocation = Math.max(0, deductibleDebt - exemptDebtAllocation);
  const dutchTaxableBaseAfterDebt = Math.max(0, savings + investments - dutchDebtAllocation);

  const totalForfaitReturnBeforeShare =
    savings * (model.box3SavingsReturn || 0) +
    (investments + foreignRealEstate) * (model.otherAssetsReturn || 0) -
    deductibleDebt * (model.debtReturn || 0);

  const box3IncomeBeforeRelief = Math.max(0, totalForfaitReturnBeforeShare * taxableShare);
  const taxBeforeRelief = box3IncomeBeforeRelief * (model.box3TaxRate || 0);

  const foreignReturnBeforeShare =
    foreignRealEstate * (model.otherAssetsReturn || 0) -
    exemptDebtAllocation * (model.debtReturn || 0);

  const foreignIncomeAfterShare = Math.max(0, foreignReturnBeforeShare * taxableShare);

  let treatyRelief = 0;
  if (model.box3TreatyReliefEnabled && box3IncomeBeforeRelief > 0 && foreignIncomeAfterShare > 0) {
    treatyRelief = taxBeforeRelief * Math.min(1, foreignIncomeAfterShare / box3IncomeBeforeRelief);
  }

  const finalTax = Math.max(0, taxBeforeRelief - treatyRelief);

  return {
    savings,
    investments,
    foreignRealEstate,
    totalAssets,
    grossDebt,
    deductibleDebt,
    exemptDebtAllocation,
    dutchDebtAllocation,
    dutchTaxableBaseAfterDebt,
    rendementsgrondslag,
    taxableBase,
    taxableShare,
    totalForfaitReturnBeforeShare,
    box3IncomeBeforeRelief,
    foreignReturnBeforeShare,
    foreignIncomeAfterShare,
    taxBeforeRelief,
    treatyRelief,
    finalTax,
  };
}

function box3Tax(model, etf, secondDebt, secondTaxValue, sold) {
  return calculateBox3Detailed(model, etf, secondDebt, secondTaxValue, sold).finalTax;
}

function spendFromEtf(state, amount, label = "cash outflow") {
  if (amount <= 0) return;

  let remaining = amount;

  const fromEtf = Math.min(state.etf || 0, remaining);
  state.etf -= fromEtf;
  remaining -= fromEtf;

  if (remaining > 0 && state.cashReserve > 0) {
    const fromCash = Math.min(state.cashReserve, remaining);
    state.cashReserve -= fromCash;
    remaining -= fromCash;
  }

  if (remaining > 0.005) {
    state.shortfall += remaining;
    state.events.push(`${label} shortfall ${fmtEUR2.format(remaining)}`);
  }
}

function repayDebtFromAvailableLiquidity(state, debt, useEtf, label = "2nd mortgage repayment") {
  let remaining = debt;

  if (useEtf) {
    const fromEtf = Math.min(state.etf || 0, remaining);
    state.etf -= fromEtf;
    remaining -= fromEtf;
  }

  if (remaining > 0 && state.cashReserve > 0) {
    const fromCash = Math.min(state.cashReserve, remaining);
    state.cashReserve -= fromCash;
    remaining -= fromCash;
  }

  if (remaining > 0.005) {
    state.shortfall += remaining;
    state.events.push(`${label} shortfall ${fmtEUR2.format(remaining)}`);
  }

  return Math.max(0, debt - remaining);
}

function canRepayDebtWithAvailableLiquidity(etf, cashReserve, debt, useEtf) {
  const available = (useEtf ? etf : 0) + Math.max(0, cashReserve || 0);
  return available + 0.005 >= debt;
}

function calculateInflationFactor(startYear, targetYear, futureRate) {
  let factor = 1;
  if (targetYear === startYear) return factor;

  const step = targetYear > startYear ? 1 : -1;
  for (let y = startYear + step; step > 0 ? y <= targetYear : y >= targetYear; y += step) {
    const rate = EUROZONE_HISTORICAL_INFLATION[y] ?? futureRate;
    if (step > 0) factor *= 1 + rate;
    else factor /= 1 + rate;
  }
  return factor;
}

function simulateForDynamicYear(model, candidateYear) {
  const ltSchedule = buildLtSchedule(model);
  const monthlyEtfReturn = Math.pow(1 + model.etfGrossReturn, 1 / 12) - 1;
  const sc = model.scenarios.A;

  let etf = model.etfStartingValue;
  let cashReserve = Math.max(0, (model.externalCashReserve || 0) + (sc.extraCash || 0));

  for (let year = model.projectionStartYear; year <= candidateYear; year += 1) {
    const ltDebtJan1 = debtJan1(ltSchedule, year, model.ltLoanAmount);
    const tax = box3Tax(model, etf, ltDebtJan1, model.ltPropertyValue, false);

    const taxFromEtf = Math.min(etf, tax);
    etf -= taxFromEtf;
    const taxRemainder = tax - taxFromEtf;
    if (taxRemainder > 0) {
      cashReserve = Math.max(0, cashReserve - taxRemainder);
    }

    if (year === candidateYear) {
      return canRepayDebtWithAvailableLiquidity(etf, cashReserve, ltDebtJan1, sc.useEtf);
    }

    for (let month = 1; month <= 12; month += 1) {
      etf += etfContribution(model, year, month) + etfLump(model, year, month);
      etf += etf * monthlyEtfReturn;
    }
  }

  return false;
}

function simulateScenarioAWithFixedYear(model, fixedYear) {
  const testModel = {
    ...model,
    scenarios: {
      ...model.scenarios,
      A: {
        ...model.scenarios.A,
        purchaseYear: fixedYear,
        repayYear: fixedYear,
      },
    },
    __scenarioAFixedYear: fixedYear,
    __scenarioASearchMode: true,
  };

  return simulateScenario(testModel, "A");
}

function estimateScenarioAPurchaseYear(model) {
  const sc = model.scenarios.A;

  for (let year = model.projectionStartYear; year <= model.projectionEndYear; year += 1) {
    if (year < sc.earliestPurchaseYear || year > sc.maxWaitYear) continue;

    /*
      Step 1: cheap pre-check.
      The year must at least be able to repay the 2nd mortgage after Jan 1 taxes.
    */
    if (!simulateForDynamicYear(model, year)) continue;

    /*
      Step 2: strict feasibility check.
      Run the actual Scenario A mechanics with this candidate year:
      - Jan 1 taxes
      - 2nd mortgage repayment
      - NL property purchase costs
      - monthly housing cashflow
      - 2nd property local tax
      - ETF contributions/growth
      The chosen year must produce no liquidity shortfall.
    */
    const test = simulateScenarioAWithFixedYear(model, year);
    if (test.liquidityShortfall <= 0.005) return year;
  }

  return null;
}

function simulateScenario(model, key) {
  const ltSchedule = buildLtSchedule(model);
  const monthlyEtfReturn = Math.pow(1 + model.etfGrossReturn, 1 / 12);
  const sc = model.scenarios[key];

  if (key === "A") {
    if (model.__scenarioAFixedYear !== undefined && model.__scenarioAFixedYear !== null) {
      sc.purchaseYear = model.__scenarioAFixedYear;
      sc.repayYear = model.__scenarioAFixedYear;
    } else {
      const dyn = estimateScenarioAPurchaseYear(model);
      sc.purchaseYear = dyn;
      sc.repayYear = dyn;
    }
  }

  const state = { etf: model.etfStartingValue, cashReserve: Math.max(0, (model.externalCashReserve || 0) + (model.scenarios?.A?.extraCash || 0)), shortfall: 0, events: [] };
  let ltSold = false;
  let ltRepaid = false;
  let nlOwned = false;
  let nlSchedule = [];
  let nlLoan = model.amsLoan;
  let reservedDownpayment = 0;
  let totalTax = 0;
  let totalTreatyRelief = 0;
  let totalSecondPropertyTax = 0;
  const rows = [];

  for (let year = model.projectionStartYear; year <= model.projectionEndYear; year += 1) {
    state.events = [];

    const ltDebtJan1 = ltSold || ltRepaid ? 0 : debtJan1(ltSchedule, year, model.ltLoanAmount);
    const box3 = calculateBox3Detailed(model, state.etf, ltDebtJan1, model.ltPropertyValue, ltSold || ltRepaid);
    const tax = box3.finalTax;
    totalTax += tax;
    totalTreatyRelief += box3.treatyRelief;
    spendFromEtf(state, tax, "Box 3 tax");

    if (key === "A" && sc.repayYear === null && year === model.projectionEndYear && !ltRepaid) {
      const debt = debtJan1(ltSchedule, year, model.ltLoanAmount);
      state.shortfall += debt;
      state.events.push("2nd mortgage repayment target not reached");
    }

    if (key === "A" && sc.repayYear !== null && year === sc.repayYear && !ltRepaid && !ltSold) {
      const debt = ltDebtJan1;
      const paid = repayDebtFromAvailableLiquidity(state, debt, sc.useEtf, "2nd mortgage repayment");
      ltRepaid = true;
      state.events.push(`2nd mortgage repaid ${fmtEUR2.format(paid)} of ${fmtEUR2.format(debt)}`);
      state.events.push(`NL property purchase year ${sc.purchaseYear}`);
    }

    if ((key === "B" || key === "D") && year === sc.saleYear && !ltSold) {
      const saleMonth = Math.max(1, Math.min(12, sc.saleMonth || 1));
      const saleValue = ltValueAtMonth(model, year, saleMonth, false);
      const debt = debtAtYearMonth(ltSchedule, year, saleMonth, model.ltLoanAmount);
      const cost = saleValue * sc.saleCostsPct;
      const proceeds = Math.max(0, saleValue - debt - cost - sc.motherReserve);
      ltSold = true;

      if (key === "B" && sc.allocate === "Amsterdam downpayment") {
        reservedDownpayment += proceeds;
        state.events.push(`2nd property sold; reserved for NL downpayment ${fmtEUR2.format(proceeds)}`);
      } else {
        state.etf += proceeds;
        state.events.push(`2nd property sold; proceeds to ETF ${fmtEUR2.format(proceeds)}`);
      }
    }

    if ((key === "A" || key === "B") && year === sc.purchaseYear && !nlOwned) {
      nlOwned = true;
      const downpayment = Math.min(reservedDownpayment, model.amsLoan);
      nlLoan = Math.max(0, model.amsLoan - downpayment);
      reservedDownpayment = Math.max(0, reservedDownpayment - downpayment);
      nlSchedule = buildAmsSchedule(model, year, nlLoan);
      spendFromEtf(state, model.amsCosts, "NL property purchase costs");
      if (reservedDownpayment > 0) {
        state.etf += reservedDownpayment;
        reservedDownpayment = 0;
      }
      state.events.push(`NL property purchased; mortgage ${fmtEUR2.format(nlLoan)}`);
    }

    let contributions = 0;
    let growth = 0;

    for (let month = 1; month <= 12; month += 1) {
      const add = etfContribution(model, year, month) + etfLump(model, year, month);
      if (add > 0) {
        state.etf += add;
        contributions += add;
      }

      if (nlOwned) {
        const housingCashflow = model.rentAvoided - model.amsNetMortgagePayment - model.ownershipCosts;
        if (housingCashflow >= 0) {
          state.etf += housingCashflow;
        } else {
          spendFromEtf(state, -housingCashflow, "monthly housing cashflow");
        }
      }

      const before = state.etf;
      state.etf *= monthlyEtfReturn;
      growth += state.etf - before;
    }

    const ltDebt = ltSold || ltRepaid ? 0 : debtEoy(ltSchedule, year, model.ltLoanAmount);
    const ltMarket = ltValueEoy(model, year, false);
    const ltValueVisible = ltSold ? 0 : ltMarket;
    const secondPropertyTaxableValue = ltSold ? 0 : secondPropertyTaxableValueForYear(model, year);
    const secondPropertyTax = ltSold ? 0 : calculateSecondPropertyTax(model, secondPropertyTaxableValue);
    totalSecondPropertyTax += secondPropertyTax;
    spendFromEtf(state, secondPropertyTax, "2nd property local tax");
    const ltEquity = ltSold ? 0 : Math.max(0, ltMarket - ltDebt);

    const nlDebt = nlOwned ? debtEoy(nlSchedule, year, nlLoan) : 0;
    const nlValue = amsValueEoy(model, sc.purchaseYear || year, year, nlOwned);
    const nlEquity = Math.max(0, nlValue - nlDebt);

    const totalNetWorth = state.etf + ltEquity + nlEquity + reservedDownpayment;
    const factor = calculateInflationFactor(model.projectionStartYear, year, model.personalInflation);
    const realNetWorth = totalNetWorth / factor;

    rows.push({
      year,
      etf: state.etf,
      ltMarketValue: ltValueVisible,
      ltDebt,
      ltEquity,
      amsValue: nlValue,
      amsDebt: nlDebt,
      amsEquity: nlEquity,
      totalNetWorth,
      realNetWorth,
      box3Tax: tax,
      box3TaxBeforeRelief: box3.taxBeforeRelief,
      box3TreatyRelief: box3.treatyRelief,
      box3ExemptDebtAllocation: box3.exemptDebtAllocation,
      box3DutchDebtAllocation: box3.dutchDebtAllocation,
      secondPropertyTax,
      secondPropertyTaxableValue,
      events: state.events.join("; "),
    });
  }

  const last = rows.at(-1);
  let comment;
  if (key === "A") comment = state.shortfall > 0 ? "No feasible dynamic year / liquidity shortfall" : `Dynamic repayment/purchase year: ${sc.purchaseYear}`;
  else if (key === "B") comment = "Conditional on second-property sale / family feasibility";
  else if (key === "C") comment = "Baseline; may not satisfy Dutch borrowing capacity";
  else comment = "Sell second property, invest proceeds into ETF, no NL property";

  return {
    key,
    label: scenarioDefs.find(s => s.key === key).label,
    rows,
    final: last,
    totalBox3Tax: totalTax,
    totalTreatyRelief,
    totalSecondPropertyTax,
    liquidityShortfall: state.shortfall,
    feasible: state.shortfall <= 0,
    comment,
  };
}

function simulateAll() {
  const model = readModel();
  return {
    model,
    scenarios: {
      A: simulateScenario(model, "A"),
      B: simulateScenario(model, "B"),
      C: simulateScenario(model, "C"),
      D: simulateScenario(model, "D"),
    },
  };
}

function formatCurrency(value) {
  const rate = fxRates[summaryCurrency] || 1;
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: summaryCurrency,
    maximumFractionDigits: 0,
  }).format((value || 0) * rate);
}

function setFxStatus(message) {
  const el = document.getElementById("fxStatus");
  if (el) el.textContent = message;
}

async function loadFxRates() {
  setFxStatus("Loading FX...");
  try {
    const r = await fetch("https://api.frankfurter.app/latest?from=EUR&to=USD", { cache: "no-store" });
    if (r.ok) {
      const d = await r.json();
      if (d?.rates?.USD) {
        fxRates.USD = d.rates.USD;
        fxMeta.USD = `ECB ${d.date || ""}`.trim();
      }
    }
  } catch (e) {
    console.warn("USD FX failed", e);
  }

  try {
    if (!fxRates.USD) {
      const r = await fetch("https://open.er-api.com/v6/latest/EUR", { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        if (d?.rates?.USD) {
          fxRates.USD = d.rates.USD;
          fxMeta.USD = "fallback";
        }
      }
    }
  } catch (e) {
    console.warn("USD fallback failed", e);
  }

  try {
    const r = await fetch("https://www.cbr-xml-daily.ru/daily_json.js", { cache: "no-store" });
    if (r.ok) {
      const d = await r.json();
      if (d?.Valute?.EUR?.Value) {
        fxRates.RUB = d.Valute.EUR.Value;
        fxMeta.RUB = `CBR ${String(d.Date || "").slice(0, 10)}`.trim();
      }
    }
  } catch (e) {
    console.warn("RUB FX failed", e);
  }

  updateFxStatus();
  if (window.__lastResult) renderSummary(window.__lastResult);
}

function updateFxStatus() {
  if (summaryCurrency === "EUR") {
    setFxStatus("EUR base");
    return;
  }
  const rate = fxRates[summaryCurrency];
  if (!rate) {
    setFxStatus(`${summaryCurrency} rate unavailable`);
    return;
  }
  setFxStatus(`1 EUR = ${rate.toFixed(summaryCurrency === "RUB" ? 2 : 4)} ${summaryCurrency}${fxMeta[summaryCurrency] ? " · " + fxMeta[summaryCurrency] : ""}`);
}

function setupCurrencyToggle() {
  document.querySelectorAll("#summaryCurrencyToggle .segment").forEach(button => {
    button.addEventListener("click", () => {
      summaryCurrency = button.dataset.currency;
      document.querySelectorAll("#summaryCurrencyToggle .segment").forEach(b => b.classList.remove("active"));
      button.classList.add("active");
      updateFxStatus();
      if (window.__lastResult) {
        renderSummary(window.__lastResult);
        renderStoredComparison(window.__lastResult);
      }
    });
  });
}

function renderSummary(result) {
  const tbody = document.querySelector("#summaryTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  Object.values(result.scenarios).forEach(s => {
    const r = s.final;
    const tr = tbody.insertRow();
    const values = [
      s.label,
      s.feasible ? "Yes" : "No",
      formatCurrency(r.etf),
      formatCurrency(r.ltEquity),
      formatCurrency(r.amsEquity),
      formatCurrency(r.totalNetWorth),
      formatCurrency(r.realNetWorth),
      formatCurrency(s.totalBox3Tax),
      formatCurrency(s.totalTreatyRelief || 0),
      formatCurrency(s.totalSecondPropertyTax || 0),
      formatCurrency(s.liquidityShortfall),
      s.comment,
    ];

    values.forEach((v, i) => {
      const td = tr.insertCell();
      td.textContent = v;
      if (i === 0 || i === 11) td.style.textAlign = "left";
    });
  });

  const feasible = Object.values(result.scenarios).filter(s => s.feasible);
  const byNominal = [...feasible].sort((a, b) => b.final.totalNetWorth - a.final.totalNetWorth)[0];
  const byReal = [...feasible].sort((a, b) => b.final.realNetWorth - a.final.realNetWorth)[0];
  const byLiquidity = [...feasible].sort((a, b) => b.final.etf - a.final.etf)[0];

  document.getElementById("bestNominal").textContent = byNominal ? `${byNominal.label}: ${formatCurrency(byNominal.final.totalNetWorth)}` : "No feasible scenario";
  document.getElementById("bestReal").textContent = byReal ? `${byReal.label}: ${formatCurrency(byReal.final.realNetWorth)}` : "No feasible scenario";
  document.getElementById("bestLiquidity").textContent = byLiquidity ? `${byLiquidity.label}: ${formatCurrency(byLiquidity.final.etf)}` : "No feasible scenario";
}

function renderDetails(result) {
  const tbody = document.querySelector("#detailsTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const scenario = result.scenarios[activeDetailScenario];
  scenario.rows.forEach(r => {
    const tr = tbody.insertRow();
    const values = [
      r.year,
      fmtEUR.format(r.etf),
      fmtEUR.format(r.ltMarketValue),
      fmtEUR.format(r.ltDebt),
      fmtEUR.format(r.ltEquity),
      fmtEUR.format(r.amsValue),
      fmtEUR.format(r.amsDebt),
      fmtEUR.format(r.amsEquity),
      fmtEUR.format(r.totalNetWorth),
      fmtEUR.format(r.realNetWorth),
      fmtEUR.format(r.box3Tax),
      fmtEUR.format(r.box3TreatyRelief || 0),
      fmtEUR.format(r.box3ExemptDebtAllocation || 0),
      fmtEUR.format(r.box3DutchDebtAllocation || 0),
      fmtEUR.format(r.secondPropertyTaxableValue || 0),
      fmtEUR.format(r.secondPropertyTax || 0),
      r.events,
    ];

    values.forEach((v, i) => {
      const td = tr.insertCell();
      td.textContent = v;
      if (i === 0 || i === 16) td.style.textAlign = "left";
    });
  });
}

function renderChartControls() {
  const container = document.getElementById("chartControls");
  if (!container) return;
  container.innerHTML = "";

  scenarioDefs.forEach(s => {
    const label = document.createElement("label");
    label.className = "chart-control";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = s.enabled;
    checkbox.addEventListener("change", () => {
      s.enabled = checkbox.checked;
      if (window.__lastResult) renderChart(window.__lastResult);
    });
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = s.color;
    const text = document.createElement("span");
    text.textContent = s.label;
    label.append(checkbox, swatch, text);
    container.appendChild(label);
  });
}

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
  return el;
}

function niceCeil(value) {
  if (value <= 0) return 1;
  const power = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / power;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * power;
}

function showChartTooltip(event, payload) {
  const tooltip = document.getElementById("chartTooltip");
  const wrap = document.querySelector(".chart-wrap");
  if (!tooltip || !wrap) return;

  tooltip.innerHTML = `<strong>${payload.label}</strong><div>Year: ${payload.year}</div><div>Total net worth: ${fmtEUR.format(payload.value)}</div>`;
  tooltip.classList.remove("hidden");

  const rect = wrap.getBoundingClientRect();
  const x = event.clientX - rect.left + 14;
  const y = event.clientY - rect.top + 14;
  tooltip.style.left = `${Math.min(x, rect.width - 220)}px`;
  tooltip.style.top = `${Math.min(y, rect.height - 90)}px`;
}

function hideChartTooltip() {
  if (chartSelectedPoint) return;
  document.getElementById("chartTooltip")?.classList.add("hidden");
}

function renderChart(result) {
  const svg = document.getElementById("chart");
  if (!svg) return;
  svg.innerHTML = "";

  const rect = svg.getBoundingClientRect();
  const width = Math.max(680, rect.width || 1000);
  const height = Math.max(340, rect.height || 420);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const margin = { top: 24, right: 28, bottom: 46, left: 92 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const enabled = scenarioDefs.filter(s => s.enabled);
  if (!enabled.length) return;

  const allRows = enabled.flatMap(def => result.scenarios[def.key].rows);
  const years = allRows.map(r => r.year);
  const values = allRows.map(r => r.totalNetWorth);
  const xMin = Math.min(...years);
  const xMax = Math.max(...years);

  const yMaxRaw = Math.max(...values);
  const yMaxFull = niceCeil(yMaxRaw);
  const zoom = Math.max(1, chartZoom || 1);
  const yMax = Math.max(1, yMaxFull / zoom);

  const xRange = Math.max(1, xMax - xMin);
  const xScale = year => margin.left + ((year - xMin) / xRange) * plotW;
  const yScale = value => margin.top + ((yMax - Math.min(value, yMax)) / yMax) * plotH;

  for (let i = 0; i <= 5; i += 1) {
    const value = yMax * i / 5;
    const y = yScale(value);
    svg.appendChild(svgEl("line", { x1: margin.left, y1: y, x2: width - margin.right, y2: y, class: "chart-grid" }));
    const label = svgEl("text", { x: margin.left - 10, y: y + 4, "text-anchor": "end", class: "chart-label" });
    label.textContent = fmtEUR.format(value);
    svg.appendChild(label);
  }

  svg.append(
    svgEl("line", { x1: margin.left, y1: margin.top, x2: margin.left, y2: height - margin.bottom, class: "chart-axis" }),
    svgEl("line", { x1: margin.left, y1: height - margin.bottom, x2: width - margin.right, y2: height - margin.bottom, class: "chart-axis" })
  );

  enabled.forEach(def => {
    const points = result.scenarios[def.key].rows.map(r => ({
      x: xScale(r.year),
      y: yScale(r.totalNetWorth),
      year: r.year,
      value: r.totalNetWorth,
      label: def.label,
      color: def.color,
    }));

    const path = points.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
    svg.appendChild(svgEl("path", { d: path, class: "chart-line", stroke: def.color }));

    points.forEach(p => {
      const c = svgEl("circle", { cx: p.x, cy: p.y, r: 3.5, fill: def.color, class: "chart-point" });
      c.addEventListener("mouseenter", event => showChartTooltip(event, p));
      c.addEventListener("mousemove", event => showChartTooltip(event, p));
      c.addEventListener("mouseleave", hideChartTooltip);
      c.addEventListener("click", event => {
        chartSelectedPoint = p;
        showChartTooltip(event, p);
      });
      const title = svgEl("title");
      title.textContent = `${def.label}, ${p.year}: ${fmtEUR.format(p.value)}`;
      c.appendChild(title);
      svg.appendChild(c);
    });
  });

  svg.addEventListener("click", event => {
    if (event.target === svg) {
      chartSelectedPoint = null;
      document.getElementById("chartTooltip")?.classList.add("hidden");
    }
  }, { once: true });
}


function renderInflationCalculator() {
  const amount = inputNumber("inflationAmount");
  const start = Math.round(inputNumber("inflationStartYear"));
  const target = Math.round(inputNumber("inflationTargetYear"));
  const future = inputPct("inflationFutureRate");
  const factor = calculateInflationFactor(start, target, future);
  const adjusted = amount * factor;
  const years = Math.abs(target - start);
  const avg = years ? Math.pow(factor, 1 / years) - 1 : 0;

  document.getElementById("inflationAdjustedAmount").textContent = fmtEUR.format(adjusted);
  document.getElementById("inflationFactor").textContent = `${factor.toFixed(3)}x`;
  document.getElementById("inflationAvgRate").textContent = `${(avg * 100).toFixed(2)}%`;
}

function getYearRow(scenarioResult, year) {
  if (!scenarioResult || !scenarioResult.rows) return null;
  return scenarioResult.rows.find(r => Number(r.year) === Number(year)) || scenarioResult.rows.at(-1) || null;
}

function calculatePensionFromResult(result) {
  const scenarioKey = document.getElementById("pensionScenario")?.value || "A";
  const scenario = result?.scenarios?.[scenarioKey];
  const row2053 = getYearRow(scenario, 2053);
  const model = result?.model || readModel();

  const basePensionAnnual = document.getElementById("pensionHigherBase")?.checked ? 34320 : 22584;
  const conservativeReturn = inputPct("pensionEtfReturn") || 0;
  const sellToggle = document.getElementById("pensionSellLt");

  let etfBase = row2053?.etf || 0;
  let ltSaleProceeds = 0;
  let note = "";

  const alreadySold = row2053 ? row2053.ltMarketValue <= 0 && row2053.ltDebt <= 0 : false;
  if (sellToggle) {
    sellToggle.disabled = alreadySold;
    if (alreadySold) sellToggle.checked = false;
  }

  if (!row2053) {
    note = "Projection does not reach 2053.";
  } else if (sellToggle?.checked && !alreadySold) {
    ltSaleProceeds = Math.max(0, (row2053.ltMarketValue || 0) - (row2053.ltDebt || 0));
    etfBase += ltSaleProceeds;
    note = `${scenarioKey}: remaining 2nd property is sold at EOY 2053 and equity is added to ETF.`;
  } else if (alreadySold) {
    note = `${scenarioKey}: 2nd property is already sold before / by 2053.`;
  } else {
    note = `${scenarioKey}: 2nd property is retained for pension calculation.`;
  }

  const grossEtfIncome = etfBase * conservativeReturn;
  const pensionTax = box3Tax(model, etfBase, 0, 0, true);
  const annualEtfIncome = Math.max(0, grossEtfIncome - pensionTax);
  const totalAnnualFuture = basePensionAnnual + annualEtfIncome;
  const monthlyFuture = totalAnnualFuture / 12;

  const inflationStartYear = Math.round(inputNumber("inflationStartYear")) || model.projectionStartYear;
  const inflationFutureRate = inputPct("inflationFutureRate") || model.personalInflation || 0.033;
  const inflationFactor = calculateInflationFactor(inflationStartYear, 2054, inflationFutureRate);
  const monthlyToday = monthlyFuture / inflationFactor;

  return {
    scenarioKey,
    etfBase,
    ltSaleProceeds,
    conservativeReturn,
    basePensionAnnual,
    pensionTax,
    annualEtfIncome,
    monthlyFuture,
    monthlyToday,
    inflationFactor,
    note,
  };
}

function renderPension(result) {
  if (!document.getElementById("pensionEtfBase")) return;
  const p = calculatePensionFromResult(result);
  document.getElementById("pensionEtfBase").textContent = fmtEUR.format(p.etfBase);
  document.getElementById("pensionEtfIncomeAnnual").textContent = fmtEUR.format(p.annualEtfIncome);
  document.getElementById("pensionMonthlyFuture").textContent = fmtEUR.format(p.monthlyFuture);
  document.getElementById("pensionMonthlyToday").textContent = fmtEUR.format(p.monthlyToday);
  document.getElementById("pensionLtSaleProceeds").textContent = fmtEUR.format(p.ltSaleProceeds);
  document.getElementById("pensionInflationFactor").textContent = `${p.inflationFactor.toFixed(3)}x`;
  document.getElementById("pensionNote").textContent =
    `${p.note} Pension base: ${fmtEUR.format(p.basePensionAnnual)}/year AOW + employer pension plus ${(p.conservativeReturn * 100).toFixed(1)}% ETF income after estimated Box 3 tax (${fmtEUR.format(p.pensionTax)}).`;
}

function getCurrentSummarySnapshot(result) {
  const rows = [];
  Object.values(result.scenarios || {}).forEach(s => {
    const r = s.final || {};
    const prefix = s.label || s.key;
    rows.push(
      { key: `${s.key}.finalEtf`, label: `${prefix} · Final ETF`, value: r.etf || 0, type: "higher" },
      { key: `${s.key}.ltEquity`, label: `${prefix} · 2nd property equity`, value: r.ltEquity || 0, type: "higher" },
      { key: `${s.key}.amsEquity`, label: `${prefix} · NL property equity`, value: r.amsEquity || 0, type: "higher" },
      { key: `${s.key}.totalNetWorth`, label: `${prefix} · Total net worth`, value: r.totalNetWorth || 0, type: "higher" },
      { key: `${s.key}.realNetWorth`, label: `${prefix} · Inflation-adjusted net worth`, value: r.realNetWorth || 0, type: "higher" },
      { key: `${s.key}.totalBox3Tax`, label: `${prefix} · Total Box 3 tax`, value: s.totalBox3Tax || 0, type: "lower" },
      { key: `${s.key}.totalTreatyRelief`, label: `${prefix} · Total treaty relief`, value: s.totalTreatyRelief || 0, type: "higher" },
      { key: `${s.key}.totalSecondPropertyTax`, label: `${prefix} · Total 2nd property tax`, value: s.totalSecondPropertyTax || 0, type: "lower" },
      { key: `${s.key}.liquidityShortfall`, label: `${prefix} · Liquidity shortfall`, value: s.liquidityShortfall || 0, type: "lower" }
    );
  });

  try {
    const pension = calculatePensionFromResult(result);
    rows.push(
      { key: "pension.etfBase", label: "Pension · ETF base at EOY 2053", value: pension.etfBase || 0, type: "higher" },
      { key: "pension.annualEtfIncome", label: "Pension · Annual ETF income net", value: pension.annualEtfIncome || 0, type: "higher" },
      { key: "pension.monthlyFuture", label: "Pension · Monthly income future EUR", value: pension.monthlyFuture || 0, type: "higher" },
      { key: "pension.monthlyToday", label: "Pension · Monthly income today's EUR", value: pension.monthlyToday || 0, type: "higher" },
      { key: "pension.inflationFactor", label: "Pension · Inflation factor to 2054", value: pension.inflationFactor || 0, type: "lower", format: "factor" }
    );
  } catch (_) {}

  const factorText = document.getElementById("inflationFactor")?.textContent || "";
  const inflationFactor = Number(factorText.replace("x", ""));
  if (Number.isFinite(inflationFactor) && inflationFactor > 0) {
    rows.push({ key: "inflation.factor", label: "Inflation calculator · Cumulative inflation factor", value: inflationFactor, type: "lower", format: "factor" });
  }

  return { createdAt: new Date().toISOString(), currency: summaryCurrency, rows };
}

function readStoredComparison() {
  try {
    const raw = localStorage.getItem(STORED_COMPARE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function storeCurrentComparison() {
  if (!window.__lastResult) return;
  localStorage.setItem(STORED_COMPARE_KEY, JSON.stringify(getCurrentSummarySnapshot(window.__lastResult)));
  renderStoredComparison(window.__lastResult);
}

function clearStoredComparison() {
  localStorage.removeItem(STORED_COMPARE_KEY);
  document.getElementById("storedComparisonBlock")?.classList.add("hidden");
}

function formatCompareValue(row, value) {
  if (row.format === "factor") return `${Number(value || 0).toFixed(3)}x`;
  return formatCurrency(value || 0);
}

function formatCompareDiff(row, diff) {
  const sign = diff > 0 ? "+" : "";
  if (row.format === "factor") return `${sign}${Number(diff || 0).toFixed(3)}x`;
  return `${sign}${formatCurrency(diff || 0)}`;
}

function classifyDiff(row, diff) {
  const epsilon = row.format === "factor" ? 0.0005 : 0.5;
  if (Math.abs(diff) < epsilon) return "diff-neutral";
  if (row.type === "lower") return diff < 0 ? "diff-good" : "diff-bad";
  return diff > 0 ? "diff-good" : "diff-bad";
}

function renderStoredComparison(result) {
  const stored = readStoredComparison();
  const block = document.getElementById("storedComparisonBlock");
  const tbody = document.querySelector("#storedComparisonTable tbody");
  const meta = document.getElementById("storedComparisonMeta");
  if (!block || !tbody) return;

  if (!stored || !stored.rows) {
    block.classList.add("hidden");
    tbody.innerHTML = "";
    return;
  }

  const current = getCurrentSummarySnapshot(result);
  const currentByKey = new Map(current.rows.map(r => [r.key, r]));
  tbody.innerHTML = "";

  stored.rows.forEach(storedRow => {
    const currentRow = currentByKey.get(storedRow.key);
    if (!currentRow) return;
    const storedValue = Number(storedRow.value || 0);
    const currentValue = Number(currentRow.value || 0);
    const diff = currentValue - storedValue;
    const rowMeta = { ...storedRow, ...currentRow };

    const tr = tbody.insertRow();
    [rowMeta.label, formatCompareValue(rowMeta, storedValue), formatCompareValue(rowMeta, currentValue), formatCompareDiff(rowMeta, diff)]
      .forEach((value, i) => {
        const td = tr.insertCell();
        td.textContent = value;
        if (i === 0) td.style.textAlign = "left";
        if (i === 3) td.className = classifyDiff(rowMeta, diff);
      });
  });

  block.classList.remove("hidden");
  if (meta) {
    const d = stored.createdAt ? new Date(stored.createdAt) : null;
    meta.textContent = d ? `Stored ${d.toLocaleString()}` : "Stored comparison";
  }
}

function setupStoredComparison() {
  document.getElementById("storeCompare")?.addEventListener("click", storeCurrentComparison);
  document.getElementById("clearStoredCompare")?.addEventListener("click", clearStoredComparison);
}


function renderDebtAllocationCalculator() {
  if (!document.getElementById("allocBox3Tax")) return;

  const model = readModel();
  const savings = inputNumber("allocSavings");
  const investments = inputNumber("allocInvestments");
  const foreign = inputNumber("allocForeignRealEstate");
  const debt = inputNumber("allocDebt");

  const calcModel = {
    ...model,
    box3SavingsBalance: savings,
  };

  const result = calculateBox3Detailed(calcModel, investments, debt, foreign, foreign <= 0);

  document.getElementById("allocExemptDebt").textContent = fmtEUR.format(result.exemptDebtAllocation);
  document.getElementById("allocDutchDebt").textContent = fmtEUR.format(result.dutchDebtAllocation);
  document.getElementById("allocBox3Tax").textContent = fmtEUR.format(result.finalTax);
  document.getElementById("allocTaxBeforeRelief").textContent = fmtEUR.format(result.taxBeforeRelief);
  document.getElementById("allocTreatyRelief").textContent = fmtEUR.format(result.treatyRelief);
  document.getElementById("allocDutchTaxableBase").textContent = fmtEUR.format(result.dutchTaxableBaseAfterDebt);
}

function render(result) {
  renderSummary(result);
  renderDetails(result);
  renderChart(result);
  renderInflationCalculator();
  renderPension(result);
  renderDebtAllocationCalculator();
  renderStoredComparison(result);
}

function calculate() {
  try {
    const result = simulateAll();
    window.__lastResult = result;
    render(result);
  } catch (error) {
    console.error(error);
    const tbody = document.querySelector("#summaryTable tbody");
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="12" style="text-align:left;color:#b42318">Calculation error: ${error.message}</td></tr>`;
    }
  }
}

function downloadCsv() {
  const result = window.__lastResult || simulateAll();
  const rows = [["Scenario", "Year", "ETF", "2nd property value", "2nd mortgage debt", "2nd property equity", "NL property value", "NL mortgage debt", "NL property equity", "Total net worth", "Real net worth", "Box 3 tax", "Box 3 treaty relief", "Box 3 exempt debt allocation", "Box 3 Dutch debt allocation", "2nd property taxable value", "2nd property tax", "Events"]];
  Object.values(result.scenarios).forEach(s => s.rows.forEach(r => rows.push([
    s.label, r.year, r.etf.toFixed(2), r.ltMarketValue.toFixed(2), r.ltDebt.toFixed(2), r.ltEquity.toFixed(2),
    r.amsValue.toFixed(2), r.amsDebt.toFixed(2), r.amsEquity.toFixed(2), r.totalNetWorth.toFixed(2), r.realNetWorth.toFixed(2), r.box3Tax.toFixed(2), (r.box3TreatyRelief || 0).toFixed(2), (r.box3ExemptDebtAllocation || 0).toFixed(2), (r.box3DutchDebtAllocation || 0).toFixed(2), (r.secondPropertyTaxableValue || 0).toFixed(2), (r.secondPropertyTax || 0).toFixed(2), r.events
  ])));
  const csv = rows.map(row => row.map(x => `"${String(x).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "scenario_comparison.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function applyFiscalPartnerDefaults() {
  const partner = document.getElementById("hasFiscalPartner");
  const allowance = document.getElementById("box3Allowance");
  const debt = document.getElementById("debtThreshold");
  if (!partner || !allowance || !debt) return;
  if (partner.checked) {
    allowance.value = BOX3_2025_PARTNER_ALLOWANCE;
    debt.value = BOX3_2025_PARTNER_DEBT_THRESHOLD;
  } else {
    allowance.value = BOX3_2025_SINGLE_ALLOWANCE;
    debt.value = BOX3_2025_SINGLE_DEBT_THRESHOLD;
  }
}

function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
  const toggle = document.getElementById("themeToggle");
  if (toggle) toggle.checked = theme === "dark";
  try { localStorage.setItem("calculatorTheme", theme); } catch (_) {}
}

function initTheme() {
  let stored = "light";
  try { stored = localStorage.getItem("calculatorTheme") || "light"; } catch (_) {}
  applyTheme(stored);
  const toggle = document.getElementById("themeToggle");
  if (toggle) toggle.addEventListener("change", () => applyTheme(toggle.checked ? "dark" : "light"));
}

function clearTableHighlights(table) {
  table.querySelectorAll(".col-hover,.cell-hover,.header-hover").forEach(el => el.classList.remove("col-hover", "cell-hover", "header-hover"));
}

function setupTableHeaderHover() {
  document.querySelectorAll("table").forEach(table => {
    table.addEventListener("mouseover", e => {
      const th = e.target.closest("th");
      if (!th || !table.contains(th)) return;
      clearTableHighlights(table);
      const idx = th.cellIndex;
      th.classList.add("header-hover");
      Array.from(table.rows).forEach(row => {
        const cell = row.cells[idx];
        if (cell) cell.classList.add("col-hover");
      });
    });
    table.addEventListener("mouseout", e => {
      if (!e.relatedTarget || !table.contains(e.relatedTarget)) clearTableHighlights(table);
    });
  });
}

function setupTabs() {
  document.querySelectorAll(".tab-button").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab-button").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      button.classList.add("active");
      document.getElementById(button.dataset.tab)?.classList.add("active");
    });
  });

  document.querySelectorAll(".detail-tab-button").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".detail-tab-button").forEach(b => b.classList.remove("active"));
      button.classList.add("active");
      activeDetailScenario = button.dataset.detail;
      if (window.__lastResult) renderDetails(window.__lastResult);
    });
  });
}

function init() {
  initTheme();

  addRateRow({ effectiveFrom: "2025-08-25", euribor: 2.08 });
  addRateRow({ effectiveFrom: "2026-01-01", euribor: 2.12 });
  addEtfContributionRow({ amount: 10000, frequency: "Yearly", month: 1, startYear: 2026, endYear: 2028 });
  addEtfContributionRow({ amount: 16500, frequency: "Yearly", month: 1, startYear: 2029, endYear: 2045 });
  addLumpContributionRow({ amount: 0, year: 2026, month: 1, destination: "2nd repayment", description: "optional" });
  addSecondPropertyTaxBracketRow({ lower: 150000, upper: 300000, rate: 0.5 });
  addSecondPropertyTaxBracketRow({ lower: 300000, upper: 500000, rate: 1 });
  addSecondPropertyTaxBracketRow({ lower: 500000, upper: null, rate: 2 });

  document.querySelectorAll("input,select").forEach(el => {
    el.addEventListener("input", calculate);
    el.addEventListener("change", calculate);
  });

  document.getElementById("hasFiscalPartner")?.addEventListener("change", () => {
    applyFiscalPartnerDefaults();
    calculate();
  });

  document.getElementById("personalInflation")?.addEventListener("input", calculate);
  document.getElementById("addRateRow")?.addEventListener("click", () => { addRateRow(); calculate(); });
  document.getElementById("addEtfContribution")?.addEventListener("click", () => { addEtfContributionRow(); calculate(); });
  document.getElementById("addLumpContribution")?.addEventListener("click", () => { addLumpContributionRow(); calculate(); });
  document.getElementById("downloadCsv")?.addEventListener("click", downloadCsv);
  document.getElementById("addSecondPropertyTaxBracket")?.addEventListener("click", () => { addSecondPropertyTaxBracketRow(); calculate(); });
  document.getElementById("chartZoomIn")?.addEventListener("click", () => { chartZoom = Math.min(8, chartZoom * 1.4); if (window.__lastResult) renderChart(window.__lastResult); });
  document.getElementById("chartZoomOut")?.addEventListener("click", () => { chartZoom = Math.max(1, chartZoom / 1.4); if (window.__lastResult) renderChart(window.__lastResult); });
  document.getElementById("chartZoomReset")?.addEventListener("click", () => { chartZoom = 1; chartSelectedPoint = null; document.getElementById("chartTooltip")?.classList.add("hidden"); if (window.__lastResult) renderChart(window.__lastResult); });
  window.addEventListener("resize", () => { if (window.__lastResult) renderChart(window.__lastResult); });

  setupTabs();
  renderChartControls();
  setupTableHeaderHover();
  setupCurrencyToggle();
  setupStoredComparison();
  applyFiscalPartnerDefaults();
  calculate();
  loadFxRates();
}

init();
