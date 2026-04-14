

## Quitação manual de períodos aquisitivos (individual + lote por ano)

### Confirmação
Sim, quando férias forem cadastradas no sistema, o saldo será calculado automaticamente — os dias gozados e vendidos são somados e abatidos dos 30 dias de direito. A quitação manual serve apenas para períodos antigos anteriores ao sistema.

### Implementação

**1. Migração — tabela `ferias_periodos_quitados`**
```sql
create table public.ferias_periodos_quitados (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references ferias_colaboradores(id) on delete cascade,
  periodo_inicio date not null,
  periodo_fim date not null,
  dias_quitados integer not null default 30,
  observacoes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  unique (colaborador_id, periodo_inicio)
);
alter table public.ferias_periodos_quitados enable row level security;
create policy "Authenticated users can manage quitacoes"
  on public.ferias_periodos_quitados for all to authenticated
  using (true) with check (true);
```

**2. Atualizar `PeriodosAquisitivosTab.tsx`**

- Buscar registros de `ferias_periodos_quitados` e incluir no cálculo de saldo: `saldo = 30 - diasGozados - diasVendidos - diasQuitados`
- Adicionar checkbox em cada linha com status "vencido" ou "pendente"
- Botão **"Quitar selecionados"** no topo para quitação em lote dos selecionados
- Botão **"Quitar todos vencidos do ano"** que seleciona automaticamente todos os períodos vencidos do ano filtrado e quita com 30 dias
- Botão individual **"Quitar"** por linha para quitação unitária com dialog (dias + observação)
- Períodos já quitados manualmente mostram tooltip "Quitação manual" e botão para desfazer
- Filtro de ano para facilitar a seleção em lote

**3. Dialog de quitação**
- Campos: período (read-only), colaborador (read-only), dias a quitar (default 30), observações
- Usado tanto na quitação individual quanto na confirmação do lote (observação compartilhada)

### Arquivos
- Nova migração SQL
- `src/components/ferias/ferias/PeriodosAquisitivosTab.tsx` — checkboxes, botões de lote, query da nova tabela, dialog de quitação

### Resultado
- Admin pode quitar períodos antigos individualmente ou em lote por ano
- Férias cadastradas no sistema continuam sendo calculadas automaticamente
- Períodos quitados manualmente são visualmente diferenciados

