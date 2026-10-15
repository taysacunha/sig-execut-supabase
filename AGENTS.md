## Vehicle expenses
- Keep vehicle charge preview, generation, settlement and removal in dedicated modules and permission-scoped RPCs; this prevents financial amount rules from leaking into date-only fleet workflows.
- Persist each document's generated-cycle watermark independently of installments; deleting installments must not reopen a previously generated year.

## Expense cost centers
- Guard permanent cost-center deletion in database RLS and a dependency-checking trigger; UI checks alone cannot protect linked records or prevent unauthorized deletion.

## Expense accounts and status
- Enforce operational bank-account assignments in database policies and mutation triggers, separately from administrative catalogue access; unassigned historical links must remain editable without disclosing account details.
- Normalize due status in a non-recursive database trigger using a shared business-day function; date edits and background jobs must follow the same rule.

## Vacation sale allocation
- Resolve accountant allocation independently from internal enjoyed-day distribution through shared sale helpers; the explicit both-period allocation must never be read as a third vacation period or inferred from exception sale amounts.
## Phone lines
- Phone lines read units, sectors and collaborators from the vacation system only through a permission-scoped lookup RPC; Despesas users must not need vacation-system access to fill those fields.
