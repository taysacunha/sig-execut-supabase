## Indicadores visuais e confirmação de recebimento da Premiação

### 1. Banco de dados (nova migração)

Adicionar colunas em `ferias_premiacoes`:

- `ultima_exportacao_pdf timestamptz NULL` — atualizado toda vez que o PDF é gerado (no lançamento e nas reimpressões). Pensando melhor é melhor abrir um campo para o usuário colocar qual data ele quer que apareça e é essa data que vai aparecer.
- `recebimento_confirmado boolean NOT NULL DEFAULT false` — checkbox de atesto.
- `recebimento_confirmado_em date NULL` — data preenchida pelo usuário ao marcar o checkbox.
- `recebimento_confirmado_por uuid NULL` — registra quem confirmou (auditoria).

Regra: ao desmarcar, `recebimento_confirmado_em` e `recebimento_confirmado_por` voltam a `NULL`.

### 2. Hook `useFeriasPremiacoes`

- Novo mutation `touchExportacao(id)` → atualiza `ultima_exportacao_pdf = now()`.
- Novo mutation `setRecebimento(id, confirmado, data)` → grava/limpa as três colunas.
- Invalidar a query após cada mutation.

### 3. UI — Tabela de Férias (`FeriasFerias.tsx`)

**Indicador visual na linha do colaborador** (ao lado do nome):

- Sem premiação lançada: nada.
- 1 período lançado: badge âmbar `1/2 premiação`.
- 2 períodos lançados, algum pendente de confirmação: badge azul `Premiação lançada`.
- 2 períodos lançados e ambos confirmados: badge verde com check `Premiação quitada`.
- Tooltip resume datas das últimas exportações e confirmações.

O botão `Award` já existente continua desabilitando quando `allDone`.

**Dropdown (sub-tabela de premiações):** adicionar duas novas colunas após "Lançado em":

- **Última exportação** — `dd/MM/yyyy HH:mm` ou `—`.
- **Recebimento atestado** — Checkbox + DatePicker inline:
  - Checkbox marca/desmarca a confirmação.
  - Ao marcar, abre popover com `Input type="date"` (default = hoje) e botão Salvar; grava data e usuário.
  - Ao desmarcar, AlertDialog pedindo confirmação; limpa os campos.
  - Só habilitado para quem tem `can_edit_system('ferias')`.
  - Exibido como `✓ 17/05/2026 (por Fulano)` quando confirmado.

**Geração de PDF:** o handler `reprintPremiacao` e o fluxo de lançamento inicial chamam `touchExportacao(p.id)` após `gerarPremiacaoPDF`, atualizando o timestamp em tela.

### 4. Detalhes técnicos

- A confirmação não bloqueia exclusão; apenas o gatilho de ordem (P2 antes de P1) continua valendo.
- Auditoria automática via triggers existentes em `ferias_premiacoes` registra as mudanças no checkbox.
- Tipos do Supabase serão regenerados após a migração.

### Arquivos afetados

- `db/migrations/<timestamp>_ferias_premiacoes_recebimento.sql` (+ espelho em `supabase/migrations/`)
- `src/hooks/ferias/useFeriasPremiacoes.ts` — novos mutations.
- `src/pages/ferias/FeriasFerias.tsx` — badge no nome, colunas no dropdown, chamada a `touchExportacao` após cada PDF.
- `src/components/ferias/ferias/PremiacaoDialog.tsx` — após salvar, chama `touchExportacao` ao gerar o PDF.

### Perguntas

1. O atesto de recebimento deve ser **por período** (uma linha = um checkbox, como proposto) ou **um único atesto por férias** cobrindo as duas quinzenas? Por período.
2. Posso permitir **editar a data atestada** depois de confirmada (clicando na data exibida), ou só é possível desmarcar e marcar de novo? Sim. Não podendo ser a data de atesto menor do que a data de emissão.