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
