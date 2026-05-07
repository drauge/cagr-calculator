const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const fmtEUR = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pctInput(id) {
  return num(document.getElementById(id).value) / 100;
}

function periodIndex(year, month) {
  return (year - 1) * 12 + month;
}

function isInPeriod(year, month, startYear, startMonth, endYear, endMonth) {
  const current = periodIndex(year, month);
  return current >= periodIndex(startYear, startMonth) && current <= periodIndex(endYear, endMonth);
}

function addCellInput(row, type, value, attrs = {}) {
  const td = document.createElement("td");
  const input = document.createElement("input");
  input.type = type;
  input.value = value;
  Object.entries(attrs).forEach(([key, val]) => input.setAttribute(key, val));
  input.addEventListener("input", calculate);
  td.appendChild(input);
  row.appendChild(td);
  return input;
}

function addSelect(row, value, options) {
  const td = document.createElement("td");
  const select = document.createElement("select");
  options.forEach((option) => {
    const el = document.createElement("option");
    el.value = option.value;
    el.textContent = option.label;
    if (option.value === value) el.selected = true;
    select.appendChild(el);
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
  button.textContent = "Remove";
  button.className = "secondary";
  button.addEventListener("click", () => {
    row.remove();
    calculate();
  });
  td.appendChild(button);
  row.appendChild(td);
}

function addYearlyRow({ amount = 0, month = 1, startYear = 1, endYear = 20 } = {}) {
  const row = document.querySelector("#yearlyTable tbody").insertRow();
  addCellInput(row, "number", amount, { min: 0, step: 100 });
  addCellInput(row, "number", month, { min: 1, max: 12, step: 1 });
  addCellInput(row, "number", startYear, { min: 1, step: 1 });
  addCellInput(row, "number", endYear, { min: 1, step: 1 });
  addRemoveButton(row);
}

function addMonthlyRow({ amount = 0, startYear = 1, startMonth = 1, endYear = 20, endMonth = 12 } = {}) {
  const row = document.querySelector("#monthlyTable tbody").insertRow();
  addCellInput(row, "number", amount, { min: 0, step: 50 });
  addCellInput(row, "number", startYear, { min: 1, step: 1 });
  addCellInput(row, "number", startMonth, { min: 1, max: 12, step: 1 });
  addCellInput(row, "number", endYear, { min: 1, step: 1 });
  addCellInput(row, "number", endMonth, { min: 1, max: 12, step: 1 });
  addRemoveButton(row);
}

function addLumpSumRow({ amount = 0, year = 1, month = 1, description = "" } = {}) {
  const row = document.querySelector("#lumpSumTable tbody").insertRow();
  addCellInput(row, "number", amount, { min: 0, step: 100 });
  addCellInput(row, "number", year, { min: 1, step: 1 });
  addCellInput(row, "number", month, { min: 1, max: 12, step: 1 });
  addCellInput(row, "text", description);
  addRemoveButton(row);
}

function addSkipRow({
  startYear = 1,
  startMonth = 1,
  endYear = 1,
  endMonth = 12,
  skipYearly = "No",
  skipMonthly = "No",
  reason = "",
} = {}) {
  const row = document.querySelector("#skipTable tbody").insertRow();
  addCellInput(row, "number", startYear, { min: 1, step: 1 });
  addCellInput(row, "number", startMonth, { min: 1, max: 12, step: 1 });
  addCellInput(row, "number", endYear, { min: 1, step: 1 });
  addCellInput(row, "number", endMonth, { min: 1, max: 12, step: 1 });
  addSelect(row, skipYearly, [{ value: "No", label: "No" }, { value: "Yes", label: "Yes" }]);
  addSelect(row, skipMonthly, [{ value: "No", label: "No" }, { value: "Yes", label: "Yes" }]);
  addCellInput(row, "text", reason);
  addRemoveButton(row);
}

function readRows(selector) {
  return Array.from(document.querySelectorAll(`${selector} tbody tr`)).map((row) =>
    Array.from(row.querySelectorAll("input,select")).map((el) => el.value)
  );
}

function readModel() {
  return {
    startingValue: num(document.getElementById("startingValue").value),
    projectionYears: Math.max(1, Math.min(60, Math.round(num(document.getElementById("projectionYears").value, 1)))),
    grossAnnualReturn: pctInput("grossAnnualReturn"),
    taxRate: pctInput("taxRate"),
    fictitiousReturnBase: pctInput("fictitiousReturnBase"),
    yearlyContributions: readRows("#yearlyTable").map(([amount, month, startYear, endYear]) => ({
      amount: num(amount),
      month: Math.round(num(month, 1)),
      startYear: Math.round(num(startYear, 1)),
      endYear: Math.round(num(endYear, 1)),
    })),
    monthlyContributions: readRows("#monthlyTable").map(([amount, startYear, startMonth, endYear, endMonth]) => ({
      amount: num(amount),
      startYear: Math.round(num(startYear, 1)),
      startMonth: Math.round(num(startMonth, 1)),
      endYear: Math.round(num(endYear, 1)),
      endMonth: Math.round(num(endMonth, 12)),
    })),
    lumpSums: readRows("#lumpSumTable").map(([amount, year, month, description]) => ({
      amount: num(amount),
      year: Math.round(num(year, 1)),
      month: Math.round(num(month, 1)),
      description,
    })),
    skips: readRows("#skipTable").map(([startYear, startMonth, endYear, endMonth, skipYearly, skipMonthly, reason]) => ({
      startYear: Math.round(num(startYear, 1)),
      startMonth: Math.round(num(startMonth, 1)),
      endYear: Math.round(num(endYear, 1)),
      endMonth: Math.round(num(endMonth, 12)),
      skipYearly,
      skipMonthly,
      reason,
    })),
  };
}

function shouldSkip(skips, year, month, contributionType) {
  return skips.some((skip) => {
    const flag = contributionType === "yearly" ? skip.skipYearly : skip.skipMonthly;
    return flag === "Yes" && isInPeriod(year, month, skip.startYear, skip.startMonth, skip.endYear, skip.endMonth);
  });
}

function simulate(model) {
  const monthlyGrossReturn = Math.pow(1 + model.grossAnnualReturn, 1 / 12) - 1;
  const annualTaxRateOnPortfolio = model.taxRate * model.fictitiousReturnBase;

  let balance = model.startingValue;
  const monthly = [];
  const annual = [];

  for (let year = 1; year <= model.projectionYears; year += 1) {
    const yearStartBalance = balance;
    let yearContributions = 0;
    let yearGrowth = 0;
    let yearTax = 0;

    for (let month = 1; month <= 12; month += 1) {
      const startBalance = balance;

      const yearlyContributions = model.yearlyContributions
        .filter((c) => c.amount > 0 && c.month === month && year >= c.startYear && year <= c.endYear)
        .reduce((sum, c) => sum + c.amount, 0);

      const monthlyContributions = model.monthlyContributions
        .filter((c) => c.amount > 0 && isInPeriod(year, month, c.startYear, c.startMonth, c.endYear, c.endMonth))
        .reduce((sum, c) => sum + c.amount, 0);

      const lumpSums = model.lumpSums
        .filter((c) => c.amount > 0 && c.year === year && c.month === month)
        .reduce((sum, c) => sum + c.amount, 0);

      const yearlyApplied = shouldSkip(model.skips, year, month, "yearly") ? 0 : yearlyContributions;
      const monthlyApplied = shouldSkip(model.skips, year, month, "monthly") ? 0 : monthlyContributions;
      const contributions = yearlyApplied + monthlyApplied + lumpSums;

      const balanceBeforeGrowth = startBalance + contributions;
      const grossGrowth = balanceBeforeGrowth * monthlyGrossReturn;
      const beforeTax = balanceBeforeGrowth + grossGrowth;

      const tax = month === 12 ? beforeTax * annualTaxRateOnPortfolio : 0;
      balance = beforeTax - tax;

      yearContributions += contributions;
      yearGrowth += grossGrowth;
      yearTax += tax;

      monthly.push({
        year,
        month,
        startBalance,
        yearlyApplied,
        monthlyApplied,
        lumpSums,
        contributions,
        grossGrowth,
        tax,
        endBalance: balance,
      });
    }

    annual.push({
      year,
      startBalance: yearStartBalance,
      contributions: yearContributions,
      grossGrowth: yearGrowth,
      tax: yearTax,
      endBalance: balance,
    });
  }

  return { monthly, annual };
}

function render(result) {
  const tbody = document.querySelector("#summaryTable tbody");
  tbody.innerHTML = "";

  result.annual.forEach((row) => {
    const tr = tbody.insertRow();
    [
      row.year,
      fmtEUR.format(row.startBalance),
      fmtEUR.format(row.contributions),
      fmtEUR.format(row.grossGrowth),
      fmtEUR.format(row.tax),
      fmtEUR.format(row.endBalance),
    ].forEach((value, i) => {
      const td = tr.insertCell();
      td.textContent = value;
      if (i === 0) td.style.textAlign = "left";
    });
  });

  const last = result.annual[result.annual.length - 1] || {
    endBalance: 0,
    contributions: 0,
    tax: 0,
    grossGrowth: 0,
  };

  const totals = result.annual.reduce(
    (acc, row) => {
      acc.contributions += row.contributions;
      acc.tax += row.tax;
      acc.growth += row.grossGrowth;
      return acc;
    },
    { contributions: 0, tax: 0, growth: 0 }
  );

  document.getElementById("finalValue").textContent = fmtEUR.format(last.endBalance);
  document.getElementById("totalContributions").textContent = fmtEUR.format(totals.contributions);
  document.getElementById("totalTax").textContent = fmtEUR.format(totals.tax);
  document.getElementById("totalGrowth").textContent = fmtEUR.format(totals.growth);
}

function calculate() {
  const model = readModel();
  const result = simulate(model);
  window.__lastResult = result;
  render(result);
}

function downloadCsv() {
  const result = window.__lastResult || simulate(readModel());
  const rows = [
    ["Year", "Start balance", "Contributions", "Gross growth", "Tax paid", "End-of-year net value"],
    ...result.annual.map((row) => [
      row.year,
      row.startBalance.toFixed(2),
      row.contributions.toFixed(2),
      row.grossGrowth.toFixed(2),
      row.tax.toFixed(2),
      row.endBalance.toFixed(2),
    ]),
  ];

  const csv = rows.map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "investment_projection.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function runSelfTests() {
  const almost = (a, b, epsilon = 0.01) => Math.abs(a - b) <= epsilon;

  const noTaxNoContrib = simulate({
    startingValue: 10000,
    projectionYears: 1,
    grossAnnualReturn: 0.10,
    taxRate: 0,
    fictitiousReturnBase: 0,
    yearlyContributions: [],
    monthlyContributions: [],
    lumpSums: [],
    skips: [],
  }).annual[0].endBalance;
  console.assert(almost(noTaxNoContrib, 11000), "Test failed: 10% annual growth should turn 10000 into 11000");

  const taxOnly = simulate({
    startingValue: 10000,
    projectionYears: 1,
    grossAnnualReturn: 0,
    taxRate: 0.36,
    fictitiousReturnBase: 0.0588,
    yearlyContributions: [],
    monthlyContributions: [],
    lumpSums: [],
    skips: [],
  }).annual[0].endBalance;
  console.assert(almost(taxOnly, 10000 * (1 - 0.36 * 0.0588)), "Test failed: annual tax-only case is incorrect");

  const skippedMonthly = simulate({
    startingValue: 0,
    projectionYears: 1,
    grossAnnualReturn: 0,
    taxRate: 0,
    fictitiousReturnBase: 0,
    yearlyContributions: [],
    monthlyContributions: [{ amount: 100, startYear: 1, startMonth: 1, endYear: 1, endMonth: 12 }],
    lumpSums: [],
    skips: [{ startYear: 1, startMonth: 1, endYear: 1, endMonth: 6, skipYearly: "No", skipMonthly: "Yes" }],
  }).annual[0].contributions;
  console.assert(almost(skippedMonthly, 600), "Test failed: skipped monthly contributions should leave 6 months × 100");
}

document.querySelectorAll("#startingValue,#projectionYears,#grossAnnualReturn,#taxRate,#fictitiousReturnBase")
  .forEach((el) => el.addEventListener("input", calculate));

document.getElementById("addYearly").addEventListener("click", () => {
  addYearlyRow({ amount: 0, month: 1, startYear: 1, endYear: num(document.getElementById("projectionYears").value, 20) });
  calculate();
});

document.getElementById("addMonthly").addEventListener("click", () => {
  addMonthlyRow({ amount: 0, startYear: 1, startMonth: 1, endYear: num(document.getElementById("projectionYears").value, 20), endMonth: 12 });
  calculate();
});

document.getElementById("addLumpSum").addEventListener("click", () => {
  addLumpSumRow();
  calculate();
});

document.getElementById("addSkip").addEventListener("click", () => {
  addSkipRow();
  calculate();
});

document.getElementById("downloadCsv").addEventListener("click", downloadCsv);

// Default scenario: 10k yearly for 3 years, then 16.5k yearly for 17 years.
addYearlyRow({ amount: 10000, month: 1, startYear: 1, endYear: 3 });
addYearlyRow({ amount: 16500, month: 1, startYear: 4, endYear: 20 });
addMonthlyRow({ amount: 0, startYear: 1, startMonth: 1, endYear: 20, endMonth: 12 });
addLumpSumRow({ amount: 0, year: 5, month: 6, description: "Optional one-off contribution" });
addSkipRow({ startYear: 1, startMonth: 1, endYear: 1, endMonth: 12, skipYearly: "No", skipMonthly: "No", reason: "Inactive example" });

runSelfTests();
calculate();
