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


## v12 changes: Pension inflation alignment

Fixed Future pension income inflation logic.

Previously:
- Future pension income used Personal inflation directly.
- Changing the Inflation calculator's Future annual inflation did not affect the pension section.

Now:
- Future pension income uses the same `calculateInflationFactor()` engine as the Inflation calculator.
- Pension "Inflation factor to 2054" uses:
  - Inflation calculator Start year
  - fixed pension target year 2054
  - Inflation calculator Future annual inflation
  - embedded historical eurozone inflation where available

Therefore, if the Inflation calculator has:
- Start year = projection start year
- Target year = 2054

then its cumulative inflation factor and the pension section's inflation factor to 2054 will match.


## v13 fixes

Implemented the math/logic correction plan:
1. Added Amsterdam net mortgage payment/month and subtract it from ETF cashflow after Amsterdam purchase.
2. Fixed LT mortgage amortization: principal repayment months now exclude interest-only months, so debt reaches zero at maturity.
3. Scenario A dynamic search now includes Jan 1 Box 3 tax and same-year monthly cashflows before deciding the repayment/purchase month.
4. Added LT sale month for scenarios B and D; sale proceeds use sale-month property value and sale-month mortgage debt.
5. Pension ETF income is now net of estimated annual Box 3 tax.
6. Liquidity shortfalls are tracked instead of silently flooring ETF to zero.
7. Scenario real net worth now uses the same inflation factor engine as the Inflation calculator.


## v14 changes: Store and compare

Added a **Store and compare** button in Overall performance & analysis.

Behavior:
- Saves the current calculation snapshot into browser `localStorage`.
- After parameter changes, shows stored vs current values and the difference.
- Comparison includes:
  - scenario final ETF
  - LT equity
  - AMS equity
  - total net worth
  - inflation-adjusted net worth
  - total Box 3 tax
  - liquidity shortfall
  - pension ETF base
  - pension income values
  - pension/inflation factor
- Diff colors:
  - green when higher is better and the current value is higher
  - red when higher is better and the current value is lower
  - reversed for tax, liquidity shortfall, and inflation factors


## v15 changes: generalized naming and retirement-year projection

Terminology was generalized:
- "LT property / mortgage" is now "2nd property abroad / mortgage".
- "Amsterdam property / mortgage" is now "NL property / mortgage".
- Scenario labels were updated accordingly.

Projection settings:
- "Projection years" is now derived from:
  - Projection start year
  - Retirement year
- The UI displays calculated projection years as a read-only field.


## v16 fix

The generalized v15 UI had broken runtime calculations because some broad text substitutions affected values used by the JavaScript logic.

v16 replaces `app.js` with a clean generalized implementation that keeps internal model fields stable while using generalized UI labels:
- 2nd property abroad / 2nd mortgage
- NL property / NL mortgage
- retirement year drives calculated projection years
- all scenario calculations, summary table, details table, chart, pension section, inflation calculator, FX, and stored comparison are wired again

Also preserves the v13 math fixes:
- NL net mortgage payment/month is subtracted from ETF cashflow
- 2nd mortgage amortization reaches zero at maturity
- Scenario A dynamic search includes Box 3 tax
- sale month is used for sale proceeds
- pension ETF income is net of estimated Box 3 tax
- liquidity shortfalls are tracked
- real net worth uses the shared inflation engine


## v17 changes

Added:
- Sale-month note: sale month is treated as after that month's mortgage payment.
- Interactive chart:
  - hover nodes to show scenario/year/value
  - click nodes to pin tooltip
  - click graph background to clear pinned tooltip
  - zoom in/out/reset controls
- Generalized 2nd property local real-estate tax:
  - enable/disable toggle
  - owner/allocation divisor
  - editable progressive tax brackets
  - default brackets:
    - 150k-300k at 0.5%
    - 300k-500k at 1%
    - 500k+ at 2%
  - tax is deducted from ETF/cashflow and tracked as total 2nd property tax


## v18 fix: Scenario A extra-cash liquidity

Fixed Scenario A feasibility logic.

Problem:
- Scenario A could still show a liquidity shortfall even when a very large "Extra cash available for repayment" was entered.
- The dynamic search and actual simulation did not consistently treat extra cash as available liquidity.
- Taxes and purchase costs could create shortfalls even when the scenario had extra cash entered.

Fix:
- Scenario A now creates a scenario-level cash reserve equal to "Extra cash available for repayment".
- The dynamic search deducts Box 3 tax from ETF first and then from this cash reserve before checking whether the 2nd mortgage can be fully repaid.
- Actual simulation uses the same liquidity order.
- 2nd mortgage repayment uses ETF first if "Use ETF" is enabled, then cash reserve.
- Other cash outflows, such as tax and purchase costs, can use ETF first and then the Scenario A cash reserve before recording a shortfall.

The cash reserve is treated as external liquidity for feasibility, not as an investable asset and not as part of net worth.
