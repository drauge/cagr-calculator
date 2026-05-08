# CAGR + NL Box 3 + Mortgage Calculator

Static web calculator for GitHub Pages.

## Defaults in this version

- Euribor6M schedule:
  - 2025-08-25: 2.08%
  - 2026-01-01: 2.12%
- ETF value on Jan 1 start year: 0
- ETF contributions:
  - 10000 yearly, start year 2026, end year 2028
  - 16500 yearly, start year 2029, end year 2045
- Chart includes optional Mortgage debt Jan 1 line

## Output definition

EOY net worth = ETF end value after tax + accumulated property capital.

## Deploy

Upload the files to the repository root and use GitHub Pages with GitHub Actions.


## Property appreciation

This version adds a Property appreciation schedule:
- dated rows with annual property appreciation rates
- the active rate applies from its effective date until the next row
- property value is compounded by actual days
- Box 3 and EOY net worth use the appreciated property value

EOY net worth now uses:

```text
ETF end value after tax + max(0, appreciated property value Jan 1 - mortgage debt Jan 1)
```

## Table layout

The Results and Mortgage forecast tables have sticky headers and scrollable bodies.


## Inflation schedules

This version adds separate inflation schedules:
- NL inflation schedule for ETF purchasing power.
- LT inflation schedule for Lithuanian property equity purchasing power.

Nominal values are still shown. The calculator also adds:
- Inflation-adjusted ETF value.
- Inflation-adjusted net worth.

Adjusted logic:

```text
inflation-adjusted ETF value = ETF end value after tax / NL inflation factor
inflation-adjusted property equity = property equity / LT inflation factor
inflation-adjusted net worth = adjusted ETF value + adjusted property equity
```
