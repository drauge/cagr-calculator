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


## v19 fix: shared external cash reserve

Problem:
- Scenarios B/C/D could show liquidity shortfalls because taxes / costs were charged against ETF only.
- The Scenario A extra-cash input did not affect B/C/D, because it was scoped only to Scenario A.

Fix:
- Added **External cash reserve (€)** under Common variables.
- This cash reserve is available to all scenarios to cover taxes, property purchase costs, local 2nd-property tax, and negative housing cashflow before recording a liquidity shortfall.
- Scenario A still has its own extra-cash field for the dynamic repayment-year search. Scenario A uses:
  - common External cash reserve
  - plus Scenario A repayment-search cash
- External cash reserve is treated as liquidity support only:
  - it is not invested
  - it is not included in net worth
  - it is not included in ETF return calculations


## v20 fix: Scenario A chooses earliest fully feasible year

Scenario A dynamic year selection was made stricter and less brittle.

Previous behavior:
- The search chose the first year where the 2nd mortgage repayment itself looked possible.
- If that year later produced a small liquidity shortfall from purchase costs, tax, local property tax, or same-year cashflow, the whole Scenario A could be marked infeasible.

New behavior:
- For each candidate year, the calculator first checks whether 2nd mortgage repayment is possible after Jan 1 tax.
- Then it runs the actual Scenario A mechanics with that candidate year:
  - Box 3 tax
  - 2nd mortgage repayment
  - NL property purchase costs
  - monthly housing cashflow
  - 2nd property local tax
  - ETF contributions/growth
- If the candidate year creates a liquidity shortfall, the calculator tries the next year.
- Scenario A is infeasible only if no fully feasible year exists before the Maximum wait year.

This means a small shortfall in 2033 should cause the calculator to try 2034 instead of failing the whole scenario.


## v21 fix: shared extra cash across all scenarios

Fixed liquidity behavior for scenarios B/C/D.

Before:
- The field "Extra cash available for repayment" was only included in Scenario A's cash reserve.
- B/C/D could still show liquidity shortfalls even if that field had a large value.

Now:
- "Extra cash available for repayment / liquidity" is shared across all scenarios.
- It is used as external liquidity support for:
  - Box 3 tax
  - 2nd property local tax
  - NL property purchase costs
  - negative housing cashflow
  - other scenario cash shortfalls
- Scenario A still uses the same value in its earliest feasible repayment / NL purchase year search.

As before, this extra cash is treated as liquidity support only:
- not invested
- not earning ETF returns
- not included in net worth


## v22 fix: 2nd property local tax base

Fixed the 2nd property local real-estate tax base.

Previous behavior:
- Local 2nd-property tax was calculated from the modeled market value / purchase-derived value.

Corrected behavior:
- Local 2nd-property tax now uses a separate **Official taxable / mass valuation value** input.
- This value can optionally grow annually with **Taxable value annual growth (%)**.
- The tax module no longer uses purchase price, market value, or property equity as the default tax base.

Rationale:
- In Lithuania, immovable property tax is based on the taxable value / average market value determined by the Centre of Registers, typically via mass valuation.
- Mortgage debt is not deducted from this local real-estate tax base.


## v23 changes: Box 3 debt allocation and treaty relief

Updated Box 3 logic to model Dutch category returns and proportional debt allocation for foreign treaty-exempt real estate.

Added inputs:
- Bank/savings balance in Box 3
- Bank/savings fictitious return
- Foreign real estate treaty relief toggle
- Debt allocation method:
  - proportional to exempt assets
  - full debt against NL assets
  - ignore debt
- Standalone Box 3 debt allocation calculator:
  - Dutch savings
  - Dutch investments / ETF
  - foreign real estate value
  - Box 3 debt
  - outputs exempt debt allocation, Dutch usable debt, tax before relief, treaty relief, and final Box 3 tax

Scenario calculations now track:
- Box 3 treaty relief
- debt allocated to treaty-exempt foreign real estate
- debt allocated to Dutch taxable assets


## v24 fix: scenario-year Box 3 debt allocation

Fixed the Box 3 allocation model.

Problem:
- v23 added a standalone allocation calculator, but scenario taxes still used a static foreign property tax value.
- That did not reflect the yearly scenario table.

Now:
- Every scenario year calculates Box 3 using that year's forecast values:
  - Dutch investments = ETF value at the tax calculation point
  - foreign real estate value = forecasted 2nd-property position
  - Box 3 debt = remaining 2nd mortgage debt
- A new input controls the foreign real estate value basis:
  - 2nd property equity (default, per user request)
  - 2nd property gross value
- The yearly details table now shows:
  - Box 3 foreign real estate value used
  - exempt debt allocation
  - Dutch debt allocation
  - treaty relief
  - final Box 3 tax

The separate manual debt allocation calculator was replaced by a note, because debt allocation now happens inside every scenario year.


## v25 changes: NL mortgage gross/net payment and mortgage-interest deduction

Added official-style Dutch mortgage interest deduction modelling for the NL owner-occupied home.

New behaviour:
- Gross NL mortgage payment/month is calculated from purchase price / loan, mortgage rate, term, annuity formula.
- Net NL mortgage payment/month is calculated as gross annuity payment minus estimated monthly mortgage-interest tax benefit.
- Scenario cashflow now subtracts the calculated net mortgage payment, not a static manual input.
- Gross salary + bonus inputs are added as rows, similar to ETF contributions.
- Box 1 tax benefit uses 2025/2026 Box 1 brackets and high-income mortgage deduction cap.
- Eigenwoningforfait is added to Box 1 income before applying mortgage interest deduction.
- The yearly details and CSV now include gross mortgage payment/month, tax benefit/month, and net mortgage payment/month.

Limitations:
- The model estimates the tax benefit from mortgage interest only; one-off financing costs are not included.
- It assumes you satisfy the own-home and annuity/linear repayment requirements for mortgage interest deduction.
- If salary/bonus or WOZ values are missing, the UI shows a warning and falls back where possible.


## v26 changes: scheduled NL mortgage-interest deduction assumptions

Changed NL mortgage-interest deduction inputs from one static set into yearly schedules:
- Box 1 tax / mortgage deduction schedule:
  - year
  - bracket 1 limit and rate
  - bracket 2 limit and rate
  - top rate
  - mortgage-interest deduction cap
- Eigenwoningforfait / WOZ schedule:
  - year
  - WOZ value
  - normal EWF rate
  - high-value threshold
  - high-value rate

The active row is the latest row with `year <= calculation year`, similar to the Euribor schedule.

Yearly details and CSV now include:
- Box 1 tax before own-home deduction
- Box 1 tax after own-home deduction
- NL property tax deduction/year
- eigenwoningforfait
- gross salary + bonus

Future pension income now also shows:
- disposable income after gross NL mortgage payment
- disposable income in today's EUR


## v27 changes: retirement disposable income ranking

Added a scenario-wide retirement disposable-income comparison.

Methodology:
- For scenarios with NL property:
  - housing cost = gross NL mortgage payment/month from the mortgage schedule
  - mortgage payment is a nominal schedule amount, so it is not inflated again
- For scenarios without NL property:
  - housing cost = Rent avoided grown to 2054 using rent inflation
  - rent inflation = max(0, Personal inflation - Rent inflation discount)
  - default discount = 1.1 percentage points
- Disposable future income:
  - Monthly net pension income - future housing cost
- Disposable income in today's EUR:
  - Disposable future income / inflation factor

Added:
- Rent inflation discount vs personal inflation input
- Best disposable income scenario KPI
- Best disposable income today KPI
- Scenario comparison table in the pension section


## v32 changes: return to v27 base without navigation

Reverted to the v27 no-navigation layout and applied only the requested small tweaks:
- Retirement year default = 2054
- Fiscal partner for Box 3 default = yes
- 2nd property official taxable / mass valuation value default = EUR 152,000
- Pension base year is derived from retirement year:
  - base year = retirement year - 1
  - pension start year = retirement year
- EUR 22,584 / EUR 34,320 pension toggle is used across all pension scenario comparisons
- Box 1 / mortgage deduction and EWF schedules are extended through the possible NL mortgage horizon
- Unknown future tax rates/brackets/caps are held constant at the last known values
- No left navigation panel


## v33 runtime repair

Fixed the real runtime breakage in v32:
- `function init()` had been accidentally overwritten by the Box 1 schedule helper.
- The schedule helper recursively called itself.
- Because `init()` no longer existed correctly, no event listeners were attached and all calculators/toggles appeared dead.

v33 rebuilds the app tail:
- restores `function init()`
- keeps `addNlMortgageDeductionScheduleDefaults()` as a separate helper
- initializes default rows correctly
- reattaches all event listeners
- keeps the v27 no-navigation layout and requested defaults
