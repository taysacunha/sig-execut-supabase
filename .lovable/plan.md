# Repasses por proprietário com histórico de competências

## O que muda para o usuário

Hoje cada repasse é uma linha isolada de um único mês. Passa a existir uma **conta de repasse** por Proprietário + Centro de custo, e dentro dela um **histórico de competências** (junho, julho, agosto…).

1. **Montar repasse**: pede apenas Proprietário e Centro de custo. Sem competência.
2. **Lista de repasses**: uma linha por conta (Proprietário / Centro), com totais acumulados (bruto, taxa admin., líquido), quantidade de competências e quantas estão pagas. O olho abre a conta.
3. **Dentro do diálogo**:
   - Barra superior com seletor de competência: `Todas` (consolidado) + cada mês cadastrado, e botão **"+ Competência"**.
   - Cabeçalho mostra Bruto / Taxa admin. / Líquido do mês selecionado, ou a soma de tudo quando estiver em `Todas`.
   - **Itens**: crédito/débito lançados dentro da competência selecionada. Em `Todas`, a tabela vira somente-leitura agrupada por mês.
   - **Beneficiários**: também por competência, com valor do mês, **limite mensal**, data de recebimento, sobra (residual) e observação.
   - **Limite anual (opcional)** por beneficiário: definido uma vez na conta (por ano) e exibido junto com o quanto já foi recebido no ano; ao distribuir, o sistema respeita o limite mensal e o saldo anual restante.
   - Botões **Fechar repasse** e **Marcar como pago** passam a agir sobre a competência selecionada (some quando estiver em `Todas`). Cada mês tem seu próprio status/badge.
4. **Nova competência**: ao criar, copia automaticamente os beneficiários da competência anterior (pessoa, valor, limite mensal, residual, observação, ordem) **sem a data de recebimento**. Se não houver mês anterior, cria vazio.

## Detalhes técnicos

Banco (nova migration em `db/migrations/`):
- `despesas_repasse_contas` (id, proprietario_id, centro_custo_id, observacao, timestamps, UNIQUE(proprietario, centro)) + GRANTs + RLS espelhando as políticas de `despesas_repasses` (`despesas_pode_ver_aba('repasses')` e `despesas_centros_permitidos`).
- `despesas_repasses.conta_id uuid REFERENCES despesas_repasse_contas` + backfill das linhas existentes (cria a conta a partir de proprietário/centro atuais) + UNIQUE(conta_id, competencia).
- `despesas_repasse_benef_limite_anual` (conta_id, pessoa_id, ano, valor_limite) UNIQUE(conta_id, pessoa_id, ano) + GRANTs + RLS.
- RPC `despesas_repasse_criar_conta(_proprietario_id, _centro_custo_id)` → devolve conta (idempotente).
- RPC `despesas_repasse_add_competencia(_conta_id, _competencia)`: cria a linha de `despesas_repasses` da competência (reaproveitando a consolidação de lançamentos já feita por `despesas_montar_repasse`) e copia os beneficiários do mês anterior zerando `data_recebimento`.
- Validação: soma dos beneficiários ≤ líquido do mês (regra atual mantida); aviso quando o acumulado do ano ultrapassar o limite anual cadastrado.

Frontend:
- `src/hooks/useDespesasRepasses.ts`: novo `useRepasseContas` (lista agregada por conta com as competências aninhadas), `useCriarConta`, `useAddCompetencia`, hooks de limite anual; hooks de item/beneficiário passam a invalidar a conta.
- `src/pages/despesas/DespesasRepasses.tsx`: tabela por conta, KPIs sobre o acumulado do filtro, diálogo "Montar repasse" só com Proprietário + Centro; filtro de competência passa a filtrar quais meses aparecem/contam.
- `src/components/despesas/RepasseDialog.tsx`: recebe `contaId`, adiciona a barra de competências, o botão "+ Competência", o consolidado `Todas`, os botões de status por competência e o campo de limite anual na aba Beneficiários. Abas Itens/Beneficiários/Imóveis & inquilinos preservadas.
- Exportação XLSX passa a incluir a competência de cada linha dentro da conta.

Compatibilidade: repasses já existentes viram automaticamente contas com uma competência, sem perda de itens, beneficiários ou status.
