# CAGR + NL Box 3 + Mortgage Calculator

Static web calculator for GitHub Pages.

## Included

- ETF growth projection
- Dutch Box 3 simplified 2025-style tax calculation
- Lithuanian real estate treaty relief approximation
- Mortgage forecast with:
  - drawdown/start date
  - first payment date
  - principal repayment start date
  - 6-month Euribor resets
  - bank margin
  - first interest-only payments
  - annuity payments after repayment starts
- Summary chart with toggleable lines
- CSV export for summary and mortgage schedule

## Mortgage defaults

The default values are aligned to the uploaded Luminor contract:

- Loan amount: EUR 144,750
- Contract date / drawdown assumption: 2025-08-25
- First payment date: 2025-09-08
- Principal repayment starts: 2025-11-06
- Final period: 240 payments
- Initial annual rate: 3.65%
- Bank margin: 1.57%
- Implied initial Euribor6M: 2.08%
- Repayment method: annuity

## Deploy on GitHub Pages

1. Upload these files to the root of a GitHub repository.
2. Go to `Settings -> Pages`.
3. Choose `GitHub Actions`.
4. Commit / push to `main`.
5. Wait for the workflow to finish.
