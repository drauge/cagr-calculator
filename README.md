# CAGR + NL Box 3 + Mortgage Calculator

Static web calculator for GitHub Pages / GitLab Pages.

## What it calculates

1. ETF growth with optional recurring and lump-sum contributions.
2. Lithuanian property mortgage amortization.
3. Remaining debt and accumulated property capital on each Jan 1.
4. Dutch Box 3 tax using a 2025-style method:
   - ETF + foreign property as other assets
   - mortgage debt minus debt threshold
   - single-person tax-free allowance
   - fictitious returns
   - Lithuania treaty relief via prevention fraction
5. ETF after-tax value.
6. Simple CAGR and money-weighted annualized return.
7. Dynamic SVG line chart for summary values.

## Chart

The summary chart plots:

- Start balance
- Contributions
- Gross growth
- Tax paid
- End-of-year net value

Each line can be enabled/disabled. The Y-axis rescales dynamically based only on visible series.

## Important modelling choices

### Box 3 snapshot date

Box 3 is calculated from the Jan 1 position of each tax year.

### Lithuanian property relief

The model treats Lithuanian immovable property as foreign immovable property eligible for double-tax relief. It uses a prevention-fraction logic:

```text
treaty relief = Dutch Box 3 tax before relief × foreign Box 3 income / total Box 3 income
```

### Mortgage

The mortgage module uses:

```text
floating rate = active Euribor6M + bank margin
```

The default bank margin is `1.57%`.

The payment is recalculated when the active 6-month rate period changes. Add rows to the Euribor schedule when the rate resets.

### CAGR

With recurring cash flows, simple CAGR is not enough. The calculator shows:

- **Simple CAGR on total invested**: useful but crude.
- **Money-weighted annualized return**: closer to XIRR and better for irregular contributions and tax cash flows.

## GitHub Pages deployment

1. Upload files to a GitHub repository.
2. Go to `Settings -> Pages`.
3. Set source to `GitHub Actions`.
4. Push to `main`.
