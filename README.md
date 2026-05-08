# Scenario Comparison Calculator

Compares three scenarios:
1. A. Repay LT mortgage fully + buy Amsterdam
2. B. Keep LT mortgage + no Amsterdam purchase
3. C. Sell LT property + buy Amsterdam

Layout:
- common variables first
- scenario-specific assumptions on 3 tabs
- overall performance and analysis
- yearly details

Important assumptions:
- Amsterdam owner-occupied home is treated outside Box 3.
- LT investment property is modeled in Box 3 with treaty-relief approximation.
- Scenario A treats full LT repayment as required for Amsterdam borrowing capacity.


## v2 changes

Scenario A no longer asks for separate LT full repayment year and Amsterdam purchase year.

Instead:
- the calculator dynamically finds the earliest year when ETF + extra cash can fully repay the LT mortgage
- LT full repayment and Amsterdam purchase happen in that same year
- if no such year exists before the maximum wait year, Scenario A is marked infeasible

Added:
- optional LT mortgage lump-sum repayments table
- these repayments reduce the LT mortgage forecast before the dynamic Scenario A affordability test


## v3 changes

The old dedicated LT lump-sum repayment table was replaced with a unified **Lump sum contributions** table.

Each row has:
- amount
- year
- month
- destination: `ETF` or `LT repayment`
- description

Scenario logic:
- `ETF` destination increases ETF balance in that year/month.
- `LT repayment` destination reduces the LT mortgage balance in the mortgage forecast.
- Scenario A dynamic repayment/purchase year uses both:
  - ETF-directed lump sums when calculating available ETF liquidity
  - LT-repayment-directed lump sums when calculating remaining LT mortgage debt


## v4 changes: Box 3 fiscal partner flag

Added **Fiscal partner for Box 3?**

If enabled, the model uses 2025 joint Box 3 limits:
- heffingsvrij vermogen: EUR 115,368
- debt threshold: EUR 7,600

The model allocates the combined Box 3 allowance fully to the user's side, as requested.


## v5 changes

Fiscal partner dropdown now updates the visible input fields:
- No: allowance EUR 57,684, debt threshold EUR 3,800
- Yes: allowance EUR 115,368, debt threshold EUR 7,600

Updated default assumptions:
- LT annual appreciation: 3.6%
- LT annual inflation: 3.44%
- Amsterdam purchase costs: EUR 25,000
- Rent avoided: EUR 2,300/month
- NL annual inflation: 3.3%


## v6 changes

Added:
- Light / dark theme switch with localStorage persistence.
- Table header hover highlighting:
  - hover a header to lightly highlight that column;
  - hover a row to lightly highlight the row;
  - intersection cell receives stronger highlight.
