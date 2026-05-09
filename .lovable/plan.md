## Objetivo

Exibir a **unidade** vinculada ao colaborador em três pontos do módulo de Férias para facilitar a leitura visual de quantos colaboradores de cada unidade estão de férias/folga:

1. Aba **Férias** do Calendário → lista "Férias em {mês}"
2. Aba **Férias** do Calendário → gráfico de **Gantt** (nome lateral + tooltip)
3. Aba **Mapa por Setor** das Folgas de Sábado

Formato exibido: `Nome - Unidade` (ex.: `Taysa - Tambaú`).

---

## Mudanças por arquivo

### 1. `src/components/ferias/calendario/CalendarioFeriasTab.tsx`
Na lista "Férias em {mês}" (card que renderiza `feriasDoMes`), incluir a unidade ao lado do nome do colaborador:
- `{f.colaborador?.nome} {f.colaborador?.unidade?.nome ? `- ${f.colaborador.unidade.nome}` : ""}`
- Manter o setor como informação secundária (já exibida).
- Os dados de unidade já vêm na query (`colaborador.unidade.nome`), então não precisa alterar a busca.

### 2. `src/components/ferias/calendario/GanttFeriasView.tsx`
- Adicionar `unidade` ao tipo já existente em `Ferias.colaborador` (já está tipado como `unidade?: { nome: string } | null`).
- No agrupamento `rows` (Map por colaborador), guardar também `unidade: f.colaborador?.unidade?.nome ?? ""`.
- **Coluna fixa de nomes** (esquerda): renderizar `{nome} - {unidade}` na linha do nome (ou em uma segunda linha em fonte menor, se ficar muito longo). Manter setor como terceira linha pequena.
- **Tooltip** das barras: adicionar uma linha com a unidade dentro do bloco que hoje mostra setor e datas: `<div className="text-xs text-muted-foreground">{unidade}</div>`.

### 3. `src/components/ferias/folgas/SetoresSabadosTable.tsx`
- Estender a query de `ferias_folgas` para trazer a unidade do colaborador:
  ```ts
  colaborador:ferias_colaboradores!ferias_folgas_colaborador_id_fkey(
    nome, nome_exibicao, setor_titular_id, familiar_id,
    unidade:ferias_unidades(nome)
  )
  ```
- Atualizar a interface `Colaborador` para incluir `unidade?: { nome: string } | null`.
- No `Badge` de cada folga na célula da matriz, exibir a unidade abaixo do nome em fonte pequena. Como o `Badge` é um único bloco compacto, a melhor abordagem é trocar pelo conjunto:
  ```tsx
  <div className="flex flex-col items-center gap-0.5">
    <Badge ...>{getDisplayName(folga.colaborador)}</Badge>
    {folga.colaborador?.unidade?.nome && (
      <span className="text-[10px] text-muted-foreground leading-tight">
        {folga.colaborador.unidade.nome}
      </span>
    )}
  </div>
  ```
- Manter o `title` (tooltip nativo) incluindo a unidade também.

---

## Pontos fora do escopo

- Não altera filtros, ordenação ou regras de cálculo.
- Não cria índice/agrupamento por unidade (apenas exibição).
- Não mexe na aba de Aniversariantes nem na Folgas de Sábado fora da tab "Mapa por Setor".

Posso confirmar e implementar?