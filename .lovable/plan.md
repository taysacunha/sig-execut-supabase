## Problema

Quando um período é totalmente vendido (15 dias), ele desaparece da coluna "Períodos" da aba Férias:

- **Ramo padrão**: `calcAdjustedPeriodo` retorna apenas `"Vendido"` (sem o intervalo de datas).
- **Ramo flexível**: só são listados os sub-períodos de gozo cadastrados em `ferias_gozo_periodos`. Se o colaborador vendeu o 1º período inteiro, não existe sub-período de gozo para ele → o 1º período não é exibido (caso do Pedro).
- **Ramo `gozo_diferente`**: omite o período se `gozo_quinzenaN_*` estiver vazio.

O usuário quer que os **dois períodos sempre apareçam**, com suas datas oficiais, e a venda seja sinalizada ao lado — sem substituir o intervalo.

## Correção

### `src/pages/ferias/FeriasFerias.tsx` — coluna "Períodos" (linhas 1038-1064)

Reestruturar para sempre renderizar dois blocos (1º e 2º período). Por bloco:

1. Rótulo fino `1º período` / `2º período` (texto pequeno, `text-muted-foreground`).
2. Datas oficiais (`quinzenaN_inicio` – `quinzenaN_fim`).
   - Se `quinzena2_inicio` estiver vazio → badge `2º pendente` (mantém).
3. Linha auxiliar:
   - Se `v === 15` → badge `Vendido (15d)`.
   - Se `0 < v < 15` → texto `Gozo: DD/MM a DD/MM · Vendido: Y dias` (usa `calcAdjustedPeriodo`).
   - **Ramo flexível**: listar sub-períodos de `ferias_gozo_periodos` que referenciam aquele período, mantendo o formato atual de cada linha.
   - **Ramo `gozo_diferente`**: mostrar linha "Gozo: `gozo_quinzenaN_inicio`–`gozo_quinzenaN_fim`".

Isso unifica padrão, flexível e gozo_diferente sob a mesma estrutura visual.

### `src/components/ferias/ferias/FeriasViewDialog.tsx`

Aplicar o mesmo padrão nos cards "1º Período (Direito)" e "2º Período (Direito)":
- Sempre exibir as datas oficiais completas.
- Se `v ≥ 1` → badge `Vendido (Nd)`.
- Se `0 < v < 15` → segunda linha com intervalo de gozo via `renderPeriodoAjustado`.

## Fora do escopo

- `getVendaPorPeriodo` (cálculo) — já correto.
- Aba Contador / PDF — já consistente.
- Migrations e dados.
