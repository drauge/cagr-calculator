# Scenario Comparison Calculator

## v10 changes

- Streamlined inflation:
  - Personal inflation / spending inflation: 3.3%
  - LT property appreciation: 3.6%
  - Amsterdam property appreciation: 5.0%
  - Real net worth now uses one personal inflation factor for the full net worth result.
- Added separate Inflation Calculator:
  - historical eurozone annual inflation for past years
  - personal inflation for future years
  - amount, start year, and target year inputs
- Fixed currency display and added more robust EUR/USD loading.
- Currency conversion now applies to:
  - Overall performance & analysis monetary columns
  - Best nominal net worth
  - Best real net worth
  - Most liquid final ETF
- Scenario order changed:
  - A. Repay LT + buy AMS
  - B. Sell LT + buy AMS
  - C. Keep LT + no AMS
  - D. Sell LT + ETF only
- Added Scenario D: sell LT property, invest proceeds into ETF, no Amsterdam purchase.

Historical eurozone inflation data is embedded for 1997-2025 based on public annual eurozone HICP inflation tables.


## v11 changes: Future pension income

Added a bottom-page Future pension income section:
- Scenario selector: A/B/C/D.
- AOW + employer pension toggle:
  - EUR 22,584/year without additional contribution.
  - EUR 34,320/year with additional contribution.
- Uses selected scenario's ETF value at end of 2053 as the base.
- Separate conservative ETF return input from 2054 onward, default 6%.
- Optional toggle to sell remaining LT property into ETF at EOY 2053.
  - Disabled automatically if LT property is already sold in the selected scenario.
- Outputs:
  - ETF base at EOY 2053.
  - annual ETF income.
  - monthly future pension income.
  - monthly income in today's EUR using personal inflation.
