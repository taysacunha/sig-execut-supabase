## Vehicle expenses
- Keep vehicle charge preview, generation, settlement and removal in dedicated modules and permission-scoped RPCs; this prevents financial amount rules from leaking into date-only fleet workflows.
- Persist each document's generated-cycle watermark independently of installments; deleting installments must not reopen a previously generated year.