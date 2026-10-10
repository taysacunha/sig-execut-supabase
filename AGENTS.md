## Vehicle expenses
- Keep vehicle charge preview, generation, settlement and removal in dedicated modules and permission-scoped RPCs; this prevents financial amount rules from leaking into date-only fleet workflows.
- Persist each document's generated-cycle watermark independently of installments; deleting installments must not reopen a previously generated year.

## Expense cost centers
- Guard permanent cost-center deletion in database RLS and a dependency-checking trigger; UI checks alone cannot protect linked records or prevent unauthorized deletion.