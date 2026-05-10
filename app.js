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




function addNlFinancingLoadRow({ year = 2025, financingLoadPct = 24.6 } = {}) {
  const row = document.querySelector("#nlFinancingLoadTable tbody").insertRow();
  addInputCell(row, "number", year, { min: "2000", max: "2100" });
  addInputCell(row, "number", financingLoadPct, { min: "0", max: "100", step: "0.1" });
  addRemoveButton(row);
}

function addNlBox1RateRow({ year = 2026, bracket1UpTo = 38883, rate1 = 35.75, bracket2UpTo = 78426, rate2 = 37.56, topRate = 49.5, deductionCap = 37.56 } = {}) {
  const row = document.querySelector("#nlBox1RateTable tbody").insertRow();
  addInputCell(row, "number", year, { min: "2000", max: "2100" });
  addInputCell(row, "number", bracket1UpTo, { min: "0", step: "100" });
  addInputCell(row, "number", rate1, { min: "0", step: "0.01" });
  addInputCell(row, "number", bracket2UpTo, { min: "0", step: "100" });
  addInputCell(row, "number", rate2, { min: "0", step: "0.01" });
  addInputCell(row, "number", topRate, { min: "0", step: "0.01" });
  addInputCell(row, "number", deductionCap, { min: "0", step: "0.01" });
  addRemoveButton(row);
}

function addNlEwfRow({ year = 2026, wozValue = 650000, normalRate = 0.35, highThreshold = 1350000, highRate = 2.35 } = {}) {
  const row = document.querySelector("#nlEwfTable tbody").insertRow();
  addInputCell(row, "number", year, { min: "2000", max: "2100" });
  addInputCell(row, "number", wozValue, { min: "0", step: "1000" });
  addInputCell(row, "number", normalRate, { min: "0", step: "0.01" });
  addInputCell(row, "number", highThreshold, { min: "0", step: "1000" });
  addInputCell(row, "number", highRate, { min: "0", step: "0.01" });
  addRemoveButton(row);
}

function addSalaryBonusRow({ amount = 118000, frequency = "Yearly", month = 1, startYear = 2025, increaseOverride = "", description = "gross salary+bonus" } = {}) {
  const row = document.querySelector("#salaryBonusTable tbody").insertRow();
  addInputCell(row, "number", amount, { min: "0", step: "100" });
  addSelectCell(row, frequency, ["Yearly", "Monthly"]);
  addInputCell(row, "number", month, { min: "1", max: "12", step: "1" });
  addInputCell(row, "number", startYear, { min: "2000", max: "2100" });
  addInputCell(row, "number", increaseOverride, { step: "0.1", placeholder: "default" });
  addInputCell(row, "text", description);
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
    box3ForeignRealEstateBasis: document.getElementById("box3ForeignRealEstateBasis")?.value || "equity",
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
    amsLoan: inputNumber("amsLoan") || inputNumber("amsPrice"),
    amsRate: inputPct("amsRate"),
    amsMonths: Math.max(1, Math.round(inputNumber("amsMonths") || 360)),
    nlDefaultFinancingLoadPct: inputPct("nlDefaultFinancingLoadPct"),
    nlOtherAnnualObligations: inputNumber("nlOtherAnnualObligations"),
    nlUseOfferedRateAsTestRate: (document.getElementById("nlUseOfferedRateAsTestRate")?.value || "yes") === "yes",
    nlFinancingLoadRows: tableRows("#nlFinancingLoadTable").map(([year, financingLoadPct]) => ({
      year: Math.round(n(year, start)),
      financingLoadPct: n(financingLoadPct) / 100,
    })).sort((a, b) => a.year - b.year),
    nlBox1RateRows: tableRows("#nlBox1RateTable").map(([year, bracket1UpTo, rate1, bracket2UpTo, rate2, topRate, deductionCap]) => ({
      year: Math.round(n(year, start)),
      bracket1UpTo: n(bracket1UpTo),
      rate1: n(rate1) / 100,
      bracket2UpTo: n(bracket2UpTo),
      rate2: n(rate2) / 100,
      topRate: n(topRate) / 100,
      deductionCapRate: n(deductionCap) / 100,
    })).sort((a, b) => a.year - b.year),
    nlEwfRows: tableRows("#nlEwfTable").map(([year, wozValue, normalRate, highThreshold, highRate]) => ({
      year: Math.round(n(year, start)),
      wozValue: n(wozValue),
      normalRate: n(normalRate) / 100,
      highThreshold: n(highThreshold),
      highRate: n(highRate) / 100,
    })).sort((a, b) => a.year - b.year),
    salaryBonusRows: tableRows("#salaryBonusTable").map(([amount, frequency, month, startYear, increaseOverride, description]) => ({
      amount: n(amount),
      frequency,
      month: Math.round(n(month, 1)),
      startYear: Math.round(n(startYear, start)),
      increaseOverride: increaseOverride === "" ? null : n(increaseOverride) / 100,
      description,
    })).sort((a, b) => a.startYear - b.startYear),
    amsAppreciation: inputPct("amsAppreciation"),
    amsCosts: inputNumber("amsCosts"),
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
        executionYear: Math.round(inputNumber("bExecutionYear") || inputNumber("bSaleYear") || inputNumber("bPurchaseYear")),
        saleYear: Math.round(inputNumber("bExecutionYear") || inputNumber("bSaleYear")),
        saleMonth: Math.round(inputNumber("bSaleMonth") || 1),
        purchaseYear: Math.round(inputNumber("bExecutionYear") || inputNumber("bPurchaseYear")),
        saleCostsPct: inputPct("bSaleCostsPct"),
        motherReserve: inputNumber("bMotherReserve"),
        allocate: document.getElementById("bAllocate")?.value || "ETF",
      },
      C: {},
      D: {
        executionYear: Math.round(inputNumber("dExecutionYear") || inputNumber("dSaleYear")),
        saleYear: Math.round(inputNumber("dExecutionYear") || inputNumber("dSaleYear")),
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


function activeNlFinancingLoadPct(model, year) {
  const defaultPct = model.nlDefaultFinancingLoadPct || 0.246;
  const rows = (model.nlFinancingLoadRows || []).filter(r => r.year <= year);
  return rows.length ? rows.at(-1).financingLoadPct : defaultPct;
}

function nlMortgageTestRate(model) {
  /*
    Dutch LTI rules use the offered debit rate for fixed-rate periods of 10 years
    or longer; for shorter fixed-rate periods, the AFM test rate is used. The
    model uses 5% as the test-rate fallback input.
  */
  return model.nlUseOfferedRateAsTestRate ? (model.amsRate || 0) : 0.05;
}

function maxLoanFromAnnualPayment(annualPayment, annualRate, months) {
  const payment = Math.max(0, annualPayment || 0) / 12;
  const monthlyRate = (annualRate || 0) / 12;
  const nMonths = Math.max(1, months || 360);

  if (payment <= 0) return 0;
  if (Math.abs(monthlyRate) < 1e-12) return payment * nMonths;

  return payment * (1 - Math.pow(1 + monthlyRate, -nMonths)) / monthlyRate;
}


function calculateNlIncomeBasedMortgageCapacityForYear(model, purchaseYear) {
  const income = annualSalaryBonusIncome(model, purchaseYear);
  const financingLoadPct = activeNlFinancingLoadPct(model, purchaseYear);
  const annualCapacityBeforeObligations = income * financingLoadPct;
  const annualCapacity = Math.max(0, annualCapacityBeforeObligations - (model.nlOtherAnnualObligations || 0));
  const testRate = nlMortgageTestRate(model);
  const incomeBasedMax = maxLoanFromAnnualPayment(annualCapacity, testRate, model.amsMonths);

  return {
    income,
    financingLoadPct,
    annualCapacityBeforeObligations,
    annualCapacity,
    testRate,
    incomeBasedMax,
  };
}

function calculateNlAcquisitionCapacityForYear(model, purchaseYear) {
  /*
    For scenario acquisition, there is no fixed pre-appreciating purchase target.
    The property bought is whatever can be financed in that year. Therefore
    acquisition price = mortgage amount = income-based borrowing capacity.
  */
  const capacity = calculateNlIncomeBasedMortgageCapacityForYear(model, purchaseYear);
  return {
    ...capacity,
    ltvMax: capacity.incomeBasedMax,
    maxMortgage: capacity.incomeBasedMax,
    acquisitionPrice: capacity.incomeBasedMax,
    externalDownpaymentRequired: 0,
  };
}

function calculateMaxNlMortgageForYear(model, purchaseYear, propertyPrice) {
  const capacity = calculateNlIncomeBasedMortgageCapacityForYear(model, purchaseYear);
  const ltvMax = Math.max(0, propertyPrice || 0);
  const maxMortgage = Math.min(capacity.incomeBasedMax, ltvMax);

  return {
    ...capacity,
    ltvMax,
    maxMortgage,
    externalDownpaymentRequired: Math.max(0, (propertyPrice || 0) - maxMortgage),
  };
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


function activeNlBox1RateRow(model, year) {
  const rows = (model.nlBox1RateRows || []).filter(r => r.year <= year);
  const row = rows.length ? rows.at(-1) : null;

  if (row) {
    return {
      brackets: [
        { upTo: row.bracket1UpTo, rate: row.rate1 },
        { upTo: row.bracket2UpTo, rate: row.rate2 },
        { upTo: Infinity, rate: row.topRate },
      ],
      topThreshold: row.bracket2UpTo,
      topRate: row.topRate,
      deductionCapRate: row.deductionCapRate,
    };
  }

  return {
    brackets: [
      { upTo: 38883, rate: 0.3575 },
      { upTo: 78426, rate: 0.3756 },
      { upTo: Infinity, rate: 0.495 },
    ],
    topThreshold: 78426,
    topRate: 0.495,
    deductionCapRate: 0.3756,
  };
}

function activeNlEwfRow(model, year) {
  const rows = (model.nlEwfRows || []).filter(r => r.year <= year);
  const row = rows.length ? rows.at(-1) : null;

  if (row) return row;

  return {
    year,
    wozValue: model.amsPrice || 0,
    normalRate: 0.0035,
    highThreshold: 1350000,
    highRate: 0.0235,
  };
}

function calculateBox1Tax(income, rates) {
  let remaining = Math.max(0, income || 0);
  let lower = 0;
  let tax = 0;

  for (const bracket of rates.brackets) {
    const upper = bracket.upTo;
    const slice = Math.max(0, Math.min(remaining, upper - lower));
    tax += slice * bracket.rate;
    remaining -= slice;
    lower = upper;
    if (remaining <= 0) break;
  }

  return tax;
}

function annualSalaryBonusIncome(model, year) {
  const rows = (model.salaryBonusRows || [])
    .filter(row => row.amount > 0 && row.startYear <= year)
    .sort((a, b) => a.startYear - b.startYear);

  if (!rows.length) return 0;

  const row = rows.at(-1);
  const defaultGrowth = Math.max(0, (model.personalInflation || 0) - 0.011);
  const growth = row.increaseOverride === null || row.increaseOverride === undefined ? defaultGrowth : row.increaseOverride;
  const years = Math.max(0, year - row.startYear);
  const indexedAmount = row.amount * Math.pow(1 + growth, years);

  if (row.frequency === "Monthly") return indexedAmount * 12;
  return indexedAmount;
}

function nlWozValueForYear(model, year) {
  return Math.max(0, activeNlEwfRow(model, year).wozValue || 0);
}

function calculateEigenwoningforfait(model, year) {
  const row = activeNlEwfRow(model, year);
  const woz = Math.max(0, row.wozValue || 0);
  const threshold = row.highThreshold || Infinity;
  const normalBase = Math.min(woz, threshold);
  const highBase = Math.max(0, woz - threshold);
  return normalBase * (row.normalRate || 0) + highBase * (row.highRate || 0);
}

function calculateMortgageInterestBenefit(model, year, annualInterest) {
  /*
    Box 1 own-home logic:
    taxable income before own-home deduction = gross income + eigenwoningforfait
    taxable income after deduction = gross income + eigenwoningforfait - deductible mortgage interest
    tax benefit = Box 1 tax difference, with high-income mortgage-interest deduction cap applied.
  */
  const grossIncome = annualSalaryBonusIncome(model, year);
  const ewf = calculateEigenwoningforfait(model, year);
  const deduction = Math.max(0, annualInterest || 0);
  const rates = activeNlBox1RateRow(model, year);

  if (deduction <= 0) {
    const box1TaxBeforeDeduction = calculateBox1Tax(grossIncome + ewf, rates);
    return { grossIncome, ewf, deduction, taxBenefit: 0, box1TaxBeforeDeduction, box1TaxAfterDeduction: box1TaxBeforeDeduction, warning: "" };
  }

  let warning = "";
  if (grossIncome <= 0) {
    warning = "Warning: no gross salary/bonus income is configured for mortgage interest deduction; tax benefit is calculated as 0.";
    const box1TaxBeforeDeduction = calculateBox1Tax(ewf, rates);
    return { grossIncome, ewf, deduction, taxBenefit: 0, box1TaxBeforeDeduction, box1TaxAfterDeduction: box1TaxBeforeDeduction, warning };
  }

  const incomeBeforeDeduction = grossIncome + ewf;
  const incomeAfterDeduction = Math.max(0, incomeBeforeDeduction - deduction);

  const box1TaxBeforeDeduction = calculateBox1Tax(incomeBeforeDeduction, rates);
  const box1TaxAfterDeductionBeforeCap = calculateBox1Tax(incomeAfterDeduction, rates);
  const rawBenefit = box1TaxBeforeDeduction - box1TaxAfterDeductionBeforeCap;

  const topBracketDeduction = Math.min(deduction, Math.max(0, incomeBeforeDeduction - rates.topThreshold));
  const highIncomeAdjustment = Math.max(0, topBracketDeduction * Math.max(0, rates.topRate - rates.deductionCapRate));
  const taxBenefit = Math.max(0, rawBenefit - highIncomeAdjustment);
  const box1TaxAfterDeduction = box1TaxBeforeDeduction - taxBenefit;

  return { grossIncome, ewf, deduction, taxBenefit, box1TaxBeforeDeduction, box1TaxAfterDeduction, highIncomeAdjustment, warning };
}

function calculateNlMortgageYear(model, schedule, year) {
  const rows = (schedule || []).filter(r => r.year === year);
  if (!rows.length) {
    return {
      months: 0, annualPayment: 0, annualInterest: 0, annualPrincipal: 0,
      grossMonthlyPayment: 0, taxBenefitAnnual: 0, taxBenefitMonthly: 0, netMonthlyPayment: 0,
      grossIncome: annualSalaryBonusIncome(model, year),
      eigenwoningforfait: calculateEigenwoningforfait(model, year),
      box1TaxBeforeDeduction: 0,
      box1TaxAfterDeduction: 0,
      warning: ""
    };
  }

  const annualPayment = rows.reduce((sum, r) => sum + (r.payment || 0), 0);
  const annualInterest = rows.reduce((sum, r) => sum + (r.interest || 0), 0);
  const annualPrincipal = rows.reduce((sum, r) => sum + (r.principal || 0), 0);
  const months = rows.length;
  const benefit = calculateMortgageInterestBenefit(model, year, annualInterest);
  const taxBenefitAnnual = benefit.taxBenefit || 0;

  return {
    months,
    annualPayment,
    annualInterest,
    annualPrincipal,
    grossMonthlyPayment: annualPayment / months,
    taxBenefitAnnual,
    taxBenefitMonthly: taxBenefitAnnual / months,
    netMonthlyPayment: Math.max(0, (annualPayment - taxBenefitAnnual) / months),
    grossIncome: benefit.grossIncome,
    eigenwoningforfait: benefit.ewf,
    box1TaxBeforeDeduction: benefit.box1TaxBeforeDeduction || 0,
    box1TaxAfterDeduction: benefit.box1TaxAfterDeduction || 0,
    highIncomeAdjustment: benefit.highIncomeAdjustment || 0,
    warning: benefit.warning || "",
  };
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


function nlPurchasePriceForYear(model, purchaseYear) {
  if (!purchaseYear || purchaseYear < model.projectionStartYear) return model.amsPrice || 0;

  const years = Math.max(0, purchaseYear - model.projectionStartYear);
  /*
    The entered NL purchase price is in today's money. Forecast uses NL property
    appreciation only. Personal inflation is not compounded into the property price,
    because property appreciation is treated as a nominal property-price forecast.
  */
  return (model.amsPrice || 0) * Math.pow(1 + (model.amsAppreciation || 0), years);
}

function nlPropertyValueEoyFromPurchasePrice(model, purchasePrice, purchaseYear, year, owned) {
  if (!owned || year < purchaseYear) return 0;
  return purchasePrice * Math.pow(1 + (model.amsAppreciation || 0), year - purchaseYear + 1);
}


function amsValueEoy(model, purchaseYear, year, owned) {
  const purchasePrice = nlPurchasePriceForYear(model, purchaseYear);
  return nlPropertyValueEoyFromPurchasePrice(model, purchasePrice, purchaseYear, year, owned);
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

function calculateBox3Detailed(model, dutchInvestments, box3Debt, foreignRealEstateValue, sold) {
  const savings = Math.max(0, model.box3SavingsBalance || 0);
  const investments = Math.max(0, dutchInvestments || 0);
  const foreignRealEstate = sold ? 0 : Math.max(0, foreignRealEstateValue || 0);

  const grossDebt = model.box3DebtAllocationMode === "no_debt" ? 0 : Math.max(0, box3Debt || 0);
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


function box3ForeignRealEstateValueAtJan1(model, year, debtJan1, soldOrRepaid) {
  if (soldOrRepaid) return 0;

  const grossValueJan1 = ltValueAtMonth(model, year, 1, false);
  if (model.box3ForeignRealEstateBasis === "gross_value") {
    return grossValueJan1;
  }

  return Math.max(0, grossValueJan1 - Math.max(0, debtJan1 || 0));
}

function box3Tax(model, dutchInvestments, box3Debt, foreignRealEstateValue, sold) {
  return calculateBox3Detailed(model, dutchInvestments, box3Debt, foreignRealEstateValue, sold).finalTax;
}



function recordExternalNlFundingNeed(state, amount, label = "NL property external funding need") {
  if (amount <= 0) return;
  state.externalNlFundingNeed = (state.externalNlFundingNeed || 0) + amount;
  state.events.push(`${label} ${fmtEUR2.format(amount)}`);
}

function recordHousingCashflowShortfall(state, amount, label = "monthly housing cashflow") {
  if (amount <= 0) return;

  let remaining = amount;

  if (state.cashReserve > 0) {
    const fromCash = Math.min(state.cashReserve, remaining);
    state.cashReserve -= fromCash;
    remaining -= fromCash;
  }

  if (remaining > 0.005) {
    state.shortfall += remaining;
    state.events.push(`${label} shortfall ${fmtEUR2.format(remaining)}`);
  }
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
    const foreignRealEstateJan1 = box3ForeignRealEstateValueAtJan1(model, year, ltDebtJan1, false);
    const tax = box3Tax(model, etf, ltDebtJan1, foreignRealEstateJan1, false);

    const taxFromEtf = Math.min(etf, tax);
    etf -= taxFromEtf;
    const taxRemainder = tax - taxFromEtf;
    if (taxRemainder > 0) {
      cashReserve = Math.max(0, cashReserve - taxRemainder);
    }

    if (year === candidateYear) {
      /*
        Scenario A dynamic year is an execution test, not a full retirement affordability test.

        Required in the execution year:
        1. repay remaining 2nd mortgage;
        2. pay NL purchase costs.

        NL purchase price itself is financed by the new NL mortgage, so it is not a cash
        liquidity requirement here. Later mortgage affordability is evaluated separately
        through liquidity shortfall and pension disposable income.
      */
      let etfAvailable = etf;
      let cashAvailable = cashReserve;

      let debtRemaining = ltDebtJan1;
      if (sc.useEtf) {
        const fromEtf = Math.min(etfAvailable, debtRemaining);
        etfAvailable -= fromEtf;
        debtRemaining -= fromEtf;
      }

      const fromCashForDebt = Math.min(cashAvailable, debtRemaining);
      cashAvailable -= fromCashForDebt;
      debtRemaining -= fromCashForDebt;

      if (debtRemaining > 0.005) return false;

      let costsRemaining = Math.max(0, model.amsCosts || 0);
      const fromEtfForCosts = Math.min(etfAvailable, costsRemaining);
      etfAvailable -= fromEtfForCosts;
      costsRemaining -= fromEtfForCosts;

      const fromCashForCosts = Math.min(cashAvailable, costsRemaining);
      cashAvailable -= fromCashForCosts;
      costsRemaining -= fromCashForCosts;

      return costsRemaining <= 0.005;
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
      Choose the earliest executable year:
      - after Jan 1 Box 3 tax,
      - enough ETF/external cash to repay the 2nd mortgage,
      - enough liquidity to pay NL purchase costs.

      Do not reject the year because of long-run mortgage affordability or retirement
      disposable income. Those remain visible as shortfall / pension outputs.
    */
    if (simulateForDynamicYear(model, year)) return year;
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

  const state = { etf: model.etfStartingValue, cashReserve: Math.max(0, (model.externalCashReserve || 0) + (model.scenarios?.A?.extraCash || 0)), shortfall: 0, externalNlFundingNeed: 0, events: [] };
  let ltSold = false;
  let ltRepaid = false;
  let nlOwned = false;
  let nlSchedule = [];
  let nlPurchasePriceUsed = 0;
  let nlLoan = model.amsLoan;
  let reservedDownpayment = 0;
  let totalTax = 0;
  let totalTreatyRelief = 0;
  let totalSecondPropertyTax = 0;
  const rows = [];

  for (let year = model.projectionStartYear; year <= model.projectionEndYear; year += 1) {
    state.events = [];

    const ltDebtJan1 = ltSold || ltRepaid ? 0 : debtJan1(ltSchedule, year, model.ltLoanAmount);
    const foreignRealEstateJan1 = box3ForeignRealEstateValueAtJan1(model, year, ltDebtJan1, ltSold || ltRepaid);
    const box3 = calculateBox3Detailed(model, state.etf, ltDebtJan1, foreignRealEstateJan1, ltSold || ltRepaid);
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

      state.etf += proceeds;
      state.events.push(`2nd property sold; proceeds to ETF ${fmtEUR2.format(proceeds)}`);
    }

    if ((key === "A" || key === "B") && year === sc.purchaseYear && !nlOwned) {
      nlOwned = true;
      const nlMortgageCapacity = calculateNlAcquisitionCapacityForYear(model, year);
      nlPurchasePriceUsed = nlMortgageCapacity.acquisitionPrice;

      /*
        Acquisition is capacity-based:
        purchase price = max mortgage amount = calculated borrowing capacity.
        There is no pre-purchase appreciation of a fixed target property price.
        Purchase costs remain external.
      */
      nlLoan = nlMortgageCapacity.maxMortgage;
      nlSchedule = buildAmsSchedule(model, year, nlLoan);

      recordExternalNlFundingNeed(state, Math.max(0, model.amsCosts || 0), "NL property purchase costs");
      state.events.push(`NL property acquired by borrowing capacity at ${fmtEUR2.format(nlPurchasePriceUsed)}; mortgage ${fmtEUR2.format(nlLoan)}`);
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
        const nlMortgageInfo = calculateNlMortgageYear(model, nlSchedule, year);
        const netMortgagePayment = nlMortgageInfo.netMonthlyPayment || 0;
        const housingCashflow = model.rentAvoided - netMortgagePayment - model.ownershipCosts;
        if (housingCashflow >= 0) {
          /*
            Surplus monthly housing cashflow can be invested.
          */
          state.etf += housingCashflow;
        } else {
          /*
            Do not liquidate the rebuilt ETF portfolio to pay the NL mortgage.
            Negative housing cashflow is an affordability/liquidity shortfall.
            Scheduled ETF contributions remain invested and continue compounding.
          */
          recordHousingCashflowShortfall(state, -housingCashflow, "monthly housing cashflow");
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
    const nlValue = nlPropertyValueEoyFromPurchasePrice(model, nlPurchasePriceUsed, sc.purchaseYear || year, year, nlOwned);
    const nlEquity = Math.max(0, nlValue - nlDebt);
    const nlMortgageInfo = nlOwned ? calculateNlMortgageYear(model, nlSchedule, year) : { grossMonthlyPayment: 0, taxBenefitMonthly: 0, netMonthlyPayment: 0, annualInterest: 0, eigenwoningforfait: 0, grossIncome: 0, warning: "" };

    const totalNetWorth = state.etf + ltEquity + nlEquity + reservedDownpayment;
    const factor = calculateInflationFactor(model.projectionStartYear, year, model.personalInflation);
    const realNetWorth = totalNetWorth / factor;

    rows.push({
      year,
      etf: state.etf,
      ltMarketValue: ltValueVisible,
      ltDebt,
      ltEquity,
      nlPurchasePriceUsed,
      nlMaxMortgageAmount: nlOwned ? calculateNlAcquisitionCapacityForYear(model, sc.purchaseYear || year).maxMortgage : 0,
      nlExternalDownpaymentRequired: nlOwned ? Math.max(0, nlPurchasePriceForYear(model, sc.purchaseYear || year) - calculateNlAcquisitionCapacityForYear(model, sc.purchaseYear || year).maxMortgage) : 0,
      nlExternalFundingNeed: state.externalNlFundingNeed || 0,
      amsValue: nlValue,
      amsDebt: nlDebt,
      amsEquity: nlEquity,
      nlGrossMortgageMonthly: nlMortgageInfo.grossMonthlyPayment || 0,
      nlMortgageTaxBenefitMonthly: nlMortgageInfo.taxBenefitMonthly || 0,
      nlNetMortgageMonthly: nlMortgageInfo.netMonthlyPayment || 0,
      nlMortgageInterestAnnual: nlMortgageInfo.annualInterest || 0,
      nlEigenwoningforfait: nlMortgageInfo.eigenwoningforfait || 0,
      nlMortgageTaxWarning: nlMortgageInfo.warning || "",
      totalNetWorth,
      realNetWorth,
      box3Tax: tax,
      box3TaxBeforeRelief: box3.taxBeforeRelief,
      box3TreatyRelief: box3.treatyRelief,
      box3ForeignRealEstate: box3.foreignRealEstate,
      box3ExemptDebtAllocation: box3.exemptDebtAllocation,
      box3DutchDebtAllocation: box3.dutchDebtAllocation,
      secondPropertyTax,
      secondPropertyTaxableValue,
      events: state.events.join("; "),
    });
  }

  const last = rows.at(-1);
  let comment;
  const feasibilityTolerance = 1000;
  const conditionallyFeasible = state.shortfall > 0 && state.shortfall < feasibilityTolerance;

  if (key === "A") {
    if (sc.purchaseYear === null) comment = "No executable repayment / purchase year found before maximum wait year";
    else if (state.shortfall > 0 && !conditionallyFeasible) comment = `Executable in ${sc.purchaseYear}, but material later liquidity shortfall ${fmtEUR2.format(state.shortfall)}`;
    else if (conditionallyFeasible) comment = `Conditionally feasible: small liquidity shortfall ${fmtEUR2.format(state.shortfall)}; dynamic repayment/purchase year: ${sc.purchaseYear}`;
    else comment = `Dynamic repayment/purchase year: ${sc.purchaseYear}`;
  }
  else if (key === "B") comment = conditionallyFeasible ? `Conditionally feasible: small liquidity shortfall ${fmtEUR2.format(state.shortfall)}` : "Conditional on second-property sale / family feasibility";
  else if (key === "C") comment = conditionallyFeasible ? `Conditionally feasible: small liquidity shortfall ${fmtEUR2.format(state.shortfall)}` : "Baseline; may not satisfy Dutch borrowing capacity";
  else comment = conditionallyFeasible ? `Conditionally feasible: small liquidity shortfall ${fmtEUR2.format(state.shortfall)}` : "Sell second property, invest proceeds into ETF, no NL property";

  return {
    key,
    label: scenarioDefs.find(s => s.key === key).label,
    rows,
    final: last,
    totalBox3Tax: totalTax,
    totalTreatyRelief,
    totalSecondPropertyTax,
    liquidityShortfall: state.shortfall,
    externalNlFundingNeed: state.externalNlFundingNeed || 0,
    feasible: state.shortfall <= 0 || conditionallyFeasible,
    conditionallyFeasible,
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
      s.conditionallyFeasible ? "Conditional" : (s.feasible ? "Yes" : "No"),
      formatCurrency(r.etf),
      formatCurrency(r.ltEquity),
      formatCurrency(r.amsEquity),
      formatCurrency(r.totalNetWorth),
      formatCurrency(r.realNetWorth),
      formatCurrency(s.totalBox3Tax),
      formatCurrency(s.totalTreatyRelief || 0),
      formatCurrency(s.totalSecondPropertyTax || 0),
      formatCurrency(s.liquidityShortfall),
      formatCurrency(s.externalNlFundingNeed || 0),
      s.comment,
    ];

    values.forEach((v, i) => {
      const td = tr.insertCell();
      td.textContent = v;
      if (i === 0 || i === 12) td.style.textAlign = "left";
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
      fmtEUR.format(r.nlPurchasePriceUsed || 0),
      fmtEUR.format(r.nlMaxMortgageAmount || 0),
      fmtEUR.format(r.nlExternalDownpaymentRequired || 0),
      fmtEUR.format(r.nlExternalFundingNeed || 0),
      fmtEUR.format(r.amsValue),
      fmtEUR.format(r.amsDebt),
      fmtEUR.format(r.amsEquity),
      fmtEUR.format(r.nlGrossMortgageMonthly || 0),
      fmtEUR.format(r.nlMortgageTaxBenefitMonthly || 0),
      fmtEUR.format(r.nlNetMortgageMonthly || 0),
      fmtEUR.format(r.totalNetWorth),
      fmtEUR.format(r.realNetWorth),
      fmtEUR.format(r.box3Tax),
      fmtEUR.format(r.box3TreatyRelief || 0),
      fmtEUR.format(r.box3ForeignRealEstate || 0),
      fmtEUR.format(r.box3ExemptDebtAllocation || 0),
      fmtEUR.format(r.box3DutchDebtAllocation || 0),
      fmtEUR.format(r.secondPropertyTaxableValue || 0),
      fmtEUR.format(r.secondPropertyTax || 0),
      r.events,
    ];

    values.forEach((v, i) => {
      const td = tr.insertCell();
      td.textContent = v;
      if (i === 0 || i === 24) td.style.textAlign = "left";
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


function pensionBaseYear(model) {
  return Math.max(model.projectionStartYear, (model.retirementYear || model.projectionEndYear || 2054) - 1);
}

function pensionStartYear(model) {
  return Math.max(model.projectionStartYear + 1, model.retirementYear || 2054);
}

function getPensionScenarioMetrics(result, scenarioKey) {
  const scenario = result?.scenarios?.[scenarioKey];
  const model = result?.model || readModel();
  const baseYear = pensionBaseYear(model);
  const startYear = pensionStartYear(model);
  const row2053 = getYearRow(scenario, baseYear);

  const basePensionAnnual = document.getElementById("pensionHigherBase")?.checked ? 34320 : 22584;
  const conservativeReturn = inputPct("pensionEtfReturn") || 0;
  const sellToggle = document.getElementById("pensionSellLt");

  let etfBase = row2053?.etf || 0;
  let ltSaleProceeds = 0;
  let note = "";

  const alreadySold = row2053 ? row2053.ltMarketValue <= 0 && row2053.ltDebt <= 0 : false;

  if (!row2053) {
    note = `Projection does not reach pension base year ${baseYear}.`;
  } else if (sellToggle?.checked && !alreadySold) {
    ltSaleProceeds = Math.max(0, (row2053.ltMarketValue || 0) - (row2053.ltDebt || 0));
    etfBase += ltSaleProceeds;
    note = `${scenarioKey}: remaining 2nd property is sold at retirement base year EOY and equity is added to ETF.`;
  } else if (alreadySold) {
    note = `${scenarioKey}: 2nd property is already sold before / by retirement base year.`;
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
  const inflationFactor = calculateInflationFactor(inflationStartYear, startYear, inflationFutureRate);
  const monthlyToday = monthlyFuture / inflationFactor;

  const ownsNlProperty = (row2053?.amsValue || 0) > 0;
  const grossNlMortgageMonthly = ownsNlProperty ? (row2053?.nlGrossMortgageMonthly || 0) : 0;

  const rentInflation = Math.max(0, (model.personalInflation || 0) - inputPct("rentInflationDiscount"));
  const rentFactor = Math.pow(1 + rentInflation, Math.max(0, startYear - model.projectionStartYear));
  const futureRentMonthly = ownsNlProperty ? 0 : (model.rentAvoided || 0) * rentFactor;

  /*
    Methodology:
    - Mortgage payments are nominal schedule payments. Do not multiply them by inflation again.
    - Rent is not fixed nominally, so grow today's/base rent by rent inflation first.
    - Convert disposable future EUR to today's EUR only after subtracting the future housing cost.
  */
  const housingCostFutureMonthly = ownsNlProperty ? grossNlMortgageMonthly : futureRentMonthly;
  const disposableMonthlyFuture = monthlyFuture - housingCostFutureMonthly;
  const disposableMonthlyToday = disposableMonthlyFuture / inflationFactor;

  return {
    scenarioKey,
    label: scenario?.label || scenarioKey,
    row2053,
    ownsNlProperty,
    etfBase,
    ltSaleProceeds,
    conservativeReturn,
    basePensionAnnual,
    pensionTax,
    annualEtfIncome,
    monthlyFuture,
    monthlyToday,
    grossNlMortgageMonthly,
    futureRentMonthly,
    housingCostFutureMonthly,
    housingCostTodayMonthly: housingCostFutureMonthly / inflationFactor,
    disposableMonthlyFuture,
    disposableMonthlyToday,
    inflationFactor,
    rentInflation,
    rentFactor,
    note,
  };
}

function calculatePensionFromResult(result) {
  const scenarioKey = document.getElementById("pensionScenario")?.value || "A";
  const p = getPensionScenarioMetrics(result, scenarioKey);

  const sellToggle = document.getElementById("pensionSellLt");
  if (sellToggle) {
    const allRows = ["A", "B", "C", "D"].map(key => getYearRow(result?.scenarios?.[key], pensionBaseYear(result?.model || readModel())));
    const hasAnyRemainingSecondProperty = allRows.some(row => row && (row.ltMarketValue || 0) > 0 && (row.ltDebt || 0) >= 0);
    sellToggle.disabled = !hasAnyRemainingSecondProperty;
    if (!hasAnyRemainingSecondProperty) sellToggle.checked = false;
  }

  return p;
}

function calculateAllPensionScenarios(result) {
  return ["A", "B", "C", "D"].map(key => getPensionScenarioMetrics(result, key));
}

function renderPension(result) {
  if (!document.getElementById("pensionEtfBase")) return;
  const p = calculatePensionFromResult(result);

  document.getElementById("pensionEtfBase").textContent = fmtEUR.format(p.etfBase);
  document.getElementById("pensionEtfIncomeAnnual").textContent = fmtEUR.format(p.annualEtfIncome);
  document.getElementById("pensionMonthlyFuture").textContent = fmtEUR.format(p.monthlyFuture);

  const disposableFutureEl = document.getElementById("pensionDisposableFuture");
  if (disposableFutureEl) disposableFutureEl.textContent = fmtEUR.format(p.disposableMonthlyFuture);

  document.getElementById("pensionMonthlyToday").textContent = fmtEUR.format(p.monthlyToday);

  const disposableTodayEl = document.getElementById("pensionDisposableToday");
  if (disposableTodayEl) disposableTodayEl.textContent = fmtEUR.format(p.disposableMonthlyToday);

  document.getElementById("pensionLtSaleProceeds").textContent = fmtEUR.format(p.ltSaleProceeds);
  const housingFutureEl = document.getElementById("pensionHousingCostFuture");
  if (housingFutureEl) housingFutureEl.textContent = fmtEUR.format(p.housingCostFutureMonthly || 0);
  const housingTodayEl = document.getElementById("pensionHousingCostToday");
  if (housingTodayEl) housingTodayEl.textContent = fmtEUR.format(p.housingCostTodayMonthly || 0);
  document.getElementById("pensionInflationFactor").textContent = `${p.inflationFactor.toFixed(3)}x`;

  document.getElementById("pensionNote").textContent =
    `${p.note} Pension base: ${fmtEUR.format(p.basePensionAnnual)}/year AOW + employer pension plus ${(p.conservativeReturn * 100).toFixed(1)}% ETF income after estimated Box 3 tax (${fmtEUR.format(p.pensionTax)}). Disposable income subtracts ${p.ownsNlProperty ? "gross NL mortgage payment" : "future rent"} (${fmtEUR.format(p.housingCostFutureMonthly)}/month).`;

  renderPensionScenarioComparison(result);
  renderLateExecutionComparison(result);
}


function cloneModelWithExecutionYear(model, executionYear) {
  return {
    ...model,
    scenarios: {
      ...model.scenarios,
      B: {
        ...model.scenarios.B,
        executionYear,
        saleYear: executionYear,
        purchaseYear: executionYear,
      },
      D: {
        ...model.scenarios.D,
        executionYear,
        saleYear: executionYear,
      },
    },
  };
}

function simulateAllWithModel(model) {
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

function renderLateExecutionComparison(result) {
  const tbody = document.querySelector("#lateExecutionComparisonTable tbody");
  if (!tbody) return;

  const baseModel = result?.model || readModel();
  const start = Math.max(baseModel.projectionStartYear, Math.round(inputNumber("lateExecutionStartYear") || baseModel.projectionStartYear));
  const end = Math.min(baseModel.projectionEndYear, Math.round(inputNumber("lateExecutionEndYear") || baseModel.projectionEndYear));
  const step = Math.max(1, Math.round(inputNumber("lateExecutionStep") || 1));

  tbody.innerHTML = "";

  for (let year = start; year <= end; year += step) {
    const model = cloneModelWithExecutionYear(baseModel, year);
    const simulated = simulateAllWithModel(model);
    const b = getPensionScenarioMetrics(simulated, "B");
    const d = getPensionScenarioMetrics(simulated, "D");
    const diff = b.disposableMonthlyToday - d.disposableMonthlyToday;
    const winner = diff >= 0 ? "B" : "D";

    const tr = tbody.insertRow();
    [
      year,
      fmtEUR.format(b.disposableMonthlyToday),
      fmtEUR.format(d.disposableMonthlyToday),
      winner,
      `${diff >= 0 ? "+" : ""}${fmtEUR.format(diff)}`,
    ].forEach((value, index) => {
      const td = tr.insertCell();
      td.textContent = value;
      if (index === 3) td.className = diff >= 0 ? "diff-good" : "diff-bad";
      if (index === 4) td.className = diff >= 0 ? "diff-good" : "diff-bad";
    });
  }
}


function renderPensionScenarioComparison(result) {
  const tbody = document.querySelector("#pensionScenarioComparisonTable tbody");
  if (!tbody) return;

  const rows = calculateAllPensionScenarios(result);
  tbody.innerHTML = "";

  rows.forEach(p => {
    const tr = tbody.insertRow();
    [
      p.label,
      p.ownsNlProperty ? "Yes" : "No",
      fmtEUR.format(p.monthlyFuture),
      fmtEUR.format(p.housingCostFutureMonthly),
      fmtEUR.format(p.disposableMonthlyFuture),
      fmtEUR.format(p.disposableMonthlyToday),
    ].forEach((value, index) => {
      const td = tr.insertCell();
      td.textContent = value;
      if (index === 0 || index === 1) td.style.textAlign = "left";
    });
  });

  const best = [...rows].sort((a, b) => b.disposableMonthlyToday - a.disposableMonthlyToday)[0];
  const bestScenarioEl = document.getElementById("bestDisposableScenario");
  const bestTodayEl = document.getElementById("bestDisposableToday");
  const rentInflationEl = document.getElementById("rentInflationUsed");

  if (bestScenarioEl) bestScenarioEl.textContent = best ? best.label : "-";
  if (bestTodayEl) bestTodayEl.textContent = best ? fmtEUR.format(best.disposableMonthlyToday) + "/month" : "-";

  const model = result?.model || readModel();
  const rentInflation = Math.max(0, (model.personalInflation || 0) - inputPct("rentInflationDiscount"));
  if (rentInflationEl) rentInflationEl.textContent = `${(rentInflation * 100).toFixed(2)}% / year`;
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
        { key: "pension.disposableMonthlyFuture", label: "Pension · Disposable income future EUR", value: pension.disposableMonthlyFuture || 0, type: "higher" },
      { key: "pension.disposableMonthlyFuture", label: "Pension · Disposable income future EUR", value: pension.disposableMonthlyFuture || 0, type: "higher" },
      { key: "pension.monthlyToday", label: "Pension · Monthly income today's EUR", value: pension.monthlyToday || 0, type: "higher" },
        { key: "pension.disposableMonthlyToday", label: "Pension · Disposable income today's EUR", value: pension.disposableMonthlyToday || 0, type: "higher" },
      { key: "pension.disposableMonthlyToday", label: "Pension · Disposable income today's EUR", value: pension.disposableMonthlyToday || 0, type: "higher" },
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



function selectedNlAcquisitionScenarioKey() {
  const pensionScenario = document.getElementById("pensionScenario")?.value || "A";
  if (pensionScenario === "B") return "B";
  return "A";
}

function selectedNlAcquisitionYear(model) {
  const key = selectedNlAcquisitionScenarioKey();
  const sc = model.scenarios?.[key];

  if (key === "B") return sc?.purchaseYear || sc?.executionYear || model.projectionStartYear;
  if (key === "A") {
    const dyn = sc?.purchaseYear ?? estimateScenarioAPurchaseYear(model);
    return dyn || sc?.earliestPurchaseYear || model.projectionStartYear;
  }

  return model.projectionStartYear;
}

function renderNlCapacityPreview(model) {
  const yearEl = document.getElementById("nlCapacityYear");
  const maxEl = document.getElementById("nlCapacityMaxMortgage");
  const gapEl = document.getElementById("nlCapacityReferenceGap");
  const noteEl = document.getElementById("nlCapacityNote");
  if (!yearEl || !maxEl || !gapEl) return;

  const year = selectedNlAcquisitionYear(model);
  const capacity = calculateNlAcquisitionCapacityForYear(model, year);
  const referencePrice = nlPurchasePriceForYear(model, year);
  const gap = Math.max(0, referencePrice - capacity.maxMortgage);

  yearEl.textContent = year || "-";
  maxEl.textContent = fmtEUR.format(capacity.maxMortgage || 0);
  gapEl.textContent = fmtEUR.format(gap);

  if (noteEl) {
    noteEl.textContent =
      `Capacity preview uses Scenario ${selectedNlAcquisitionScenarioKey()} acquisition year. ` +
      `Forecast Box 1 income: ${fmtEUR.format(capacity.income || 0)}; ` +
      `financing-load percentage: ${((capacity.financingLoadPct || 0) * 100).toFixed(2)}%; ` +
      `test rate: ${((capacity.testRate || 0) * 100).toFixed(2)}%.`;
  }
}


function renderNlMortgagePreview(result) {
  const grossEl = document.getElementById("amsGrossMortgagePaymentPreview");
  if (!grossEl) return;

  const model = result?.model || readModel();
  const loan = Math.max(0, model.amsPrice || 0); // today's-price 0-downpayment preview
  const schedule = buildAmsSchedule(model, model.projectionStartYear, loan);
  const info = calculateNlMortgageYear(model, schedule, model.projectionStartYear);

  grossEl.value = (info.grossMonthlyPayment || 0).toFixed(2);
  document.getElementById("amsMortgageTaxBenefitPreview").value = (info.taxBenefitMonthly || 0).toFixed(2);
  document.getElementById("amsNetMortgagePaymentPreview").value = (info.netMonthlyPayment || 0).toFixed(2);

  const warningEl = document.getElementById("nlMortgageTaxWarning");
  if (warningEl) {
    const pieces = [];
    if (info.warning) pieces.push(info.warning);
    if (!model.nlWozValue) pieces.push("Warning: WOZ value is missing; eigenwoningforfait uses NL purchase price as fallback.");
    if (!model.salaryBonusRows || model.salaryBonusRows.length === 0) pieces.push("Warning: no salary/bonus rows are configured; mortgage interest deduction cannot be estimated.");
    warningEl.textContent = pieces.join(" ");
  }
}

function render(result) {
  renderSummary(result);
  renderDetails(result);
  renderChart(result);
  renderInflationCalculator();
  renderPension(result);
  renderNlMortgagePreview(result);
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
      tbody.innerHTML = `<tr><td colspan="13" style="text-align:left;color:#b42318">Calculation error: ${error.message}</td></tr>`;
    }
  }
}

function downloadCsv() {
  const result = window.__lastResult || simulateAll();
  const rows = [["Scenario", "Year", "ETF", "2nd property value", "2nd mortgage debt", "2nd property equity", "NL acquisition price used", "NL max mortgage amount", "NL capacity gap vs reference price", "NL external purchase costs", "NL property value", "NL mortgage debt", "NL property equity", "NL gross mortgage/month", "NL tax benefit/month", "NL net mortgage/month", "Total net worth", "Real net worth", "Box 3 tax", "Box 3 treaty relief", "Box 3 foreign real estate value", "Box 3 exempt debt allocation", "Box 3 Dutch debt allocation", "2nd property taxable value", "2nd property tax", "Events"]];
  Object.values(result.scenarios).forEach(s => s.rows.forEach(r => rows.push([
    s.label, r.year, r.etf.toFixed(2), r.ltMarketValue.toFixed(2), r.ltDebt.toFixed(2), r.ltEquity.toFixed(2),
    (r.nlPurchasePriceUsed || 0).toFixed(2), (r.nlMaxMortgageAmount || 0).toFixed(2), (r.nlExternalDownpaymentRequired || 0).toFixed(2), (r.nlExternalFundingNeed || 0).toFixed(2), r.amsValue.toFixed(2), r.amsDebt.toFixed(2), r.amsEquity.toFixed(2), (r.nlGrossMortgageMonthly || 0).toFixed(2), (r.nlMortgageTaxBenefitMonthly || 0).toFixed(2), (r.nlNetMortgageMonthly || 0).toFixed(2), r.totalNetWorth.toFixed(2), r.realNetWorth.toFixed(2), r.box3Tax.toFixed(2), (r.box3TreatyRelief || 0).toFixed(2), (r.box3ForeignRealEstate || 0).toFixed(2), (r.box3ExemptDebtAllocation || 0).toFixed(2), (r.box3DutchDebtAllocation || 0).toFixed(2), (r.secondPropertyTaxableValue || 0).toFixed(2), (r.secondPropertyTax || 0).toFixed(2), r.events
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

function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
  const toggle = document.getElementById("themeToggle");
  if (toggle) toggle.checked = theme === "dark";
  try { localStorage.setItem("calculatorTheme", theme); } catch (_) {}
}


function setupCollapsibleBlocks() {
  document.querySelectorAll(".collapse-toggle").forEach(button => {
    const targetId = button.dataset.target;
    const target = document.getElementById(targetId);
    if (!target) return;

    button.addEventListener("click", () => {
      const collapsed = !target.classList.contains("collapsed");
      target.classList.toggle("collapsed", collapsed);
      button.textContent = collapsed ? "Expand" : "Collapse";
    });
  });
}


function syncExecutionYearInputs() {
  const bExecution = document.getElementById("bExecutionYear");
  const bSale = document.getElementById("bSaleYear");
  const bPurchase = document.getElementById("bPurchaseYear");
  if (bExecution && bSale && bPurchase) {
    bExecution.addEventListener("input", () => {
      bSale.value = bExecution.value;
      bPurchase.value = bExecution.value;
    });
  }

  const dExecution = document.getElementById("dExecutionYear");
  const dSale = document.getElementById("dSaleYear");
  if (dExecution && dSale) {
    dExecution.addEventListener("input", () => {
      dSale.value = dExecution.value;
    });
  }
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

function addNlMortgageDeductionScheduleDefaults() {
  const startYear = Math.round(inputNumber("projectionStartYear") || 2025);
  const earliestA = Math.round(inputNumber("aEarliestPurchaseYear") || startYear);
  const purchaseB = Math.round(inputNumber("bPurchaseYear") || startYear);
  const purchaseStartYear = Math.min(earliestA, purchaseB);
  const termYears = Math.ceil((inputNumber("amsMonths") || 360) / 12);
  const endYear = Math.max(2054, purchaseStartYear + termYears);

  addNlBox1RateRow({ year: 2025, bracket1UpTo: 38441, rate1: 35.82, bracket2UpTo: 76817, rate2: 37.48, topRate: 49.5, deductionCap: 37.48 });
  addNlEwfRow({ year: 2025, wozValue: inputNumber("amsPrice") || 650000, normalRate: 0.35, highThreshold: 1330000, highRate: 2.35 });

  for (let year = 2026; year <= endYear; year += 1) {
    addNlBox1RateRow({ year, bracket1UpTo: 38883, rate1: 35.75, bracket2UpTo: 78426, rate2: 37.56, topRate: 49.5, deductionCap: 37.56 });
    addNlEwfRow({ year, wozValue: inputNumber("amsPrice") || 650000, normalRate: 0.35, highThreshold: 1350000, highRate: 2.35 });
  }
}

function init() {
  initTheme();
  syncExecutionYearInputs();

  addNlMortgageDeductionScheduleDefaults();
  addRateRow({ effectiveFrom: "2025-08-25", euribor: 2.08 });
  addRateRow({ effectiveFrom: "2026-01-01", euribor: 2.12 });
  addEtfContributionRow({ amount: 10000, frequency: "Yearly", month: 1, startYear: 2026, endYear: 2028 });
  addEtfContributionRow({ amount: 16500, frequency: "Yearly", month: 1, startYear: 2029, endYear: 2045 });
  addSalaryBonusRow({ amount: 118000, frequency: "Yearly", month: 1, startYear: 2025, increaseOverride: "", description: "gross salary+bonus" });
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
  document.getElementById("addNlFinancingLoadRow")?.addEventListener("click", () => { addNlFinancingLoadRow(); calculate(); });
  document.getElementById("addNlBox1RateRow")?.addEventListener("click", () => { addNlBox1RateRow(); calculate(); });
  document.getElementById("addNlEwfRow")?.addEventListener("click", () => { addNlEwfRow(); calculate(); });
  document.getElementById("addRateRow")?.addEventListener("click", () => { addRateRow(); calculate(); });
  document.getElementById("addEtfContribution")?.addEventListener("click", () => { addEtfContributionRow(); calculate(); });
  document.getElementById("addLumpContribution")?.addEventListener("click", () => { addLumpContributionRow(); calculate(); });
  document.getElementById("addSalaryBonusRow")?.addEventListener("click", () => { addSalaryBonusRow(); calculate(); });
  document.getElementById("downloadCsv")?.addEventListener("click", downloadCsv);
  document.getElementById("addSecondPropertyTaxBracket")?.addEventListener("click", () => { addSecondPropertyTaxBracketRow(); calculate(); });
  document.getElementById("chartZoomIn")?.addEventListener("click", () => { chartZoom = Math.min(8, chartZoom * 1.4); if (window.__lastResult) renderChart(window.__lastResult); });
  document.getElementById("chartZoomOut")?.addEventListener("click", () => { chartZoom = Math.max(1, chartZoom / 1.4); if (window.__lastResult) renderChart(window.__lastResult); });
  document.getElementById("chartZoomReset")?.addEventListener("click", () => { chartZoom = 1; chartSelectedPoint = null; document.getElementById("chartTooltip")?.classList.add("hidden"); if (window.__lastResult) renderChart(window.__lastResult); });
  window.addEventListener("resize", () => { if (window.__lastResult) renderChart(window.__lastResult); });

  setupTabs();
  setupCollapsibleBlocks();
  renderChartControls();
  setupTableHeaderHover();
  setupCurrencyToggle();
  setupStoredComparison();
  applyFiscalPartnerDefaults();
  calculate();
  loadFxRates();
}

init();
