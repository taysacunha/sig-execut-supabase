## Escopo

4 ajustes no módulo Despesas / diálogo de Novo Lançamento.

## 1. Campo "Competência" vira Mês/Ano

Hoje `data_competencia` é `<input type="date">`, exigindo dia. Competência conceitualmente é o mês contábil do lançamento.

**Alterações em `src/components/despesas/LancamentoDialog.tsx`:**

- Substituir o `<Input type="date">` de competência por dois `Select`: mês (Jan–Dez) e ano (ano atual ±3, usando `getYearOptions` de `src/lib/dateUtils.ts`).
- Ao salvar, montar `data_competencia = YYYY-MM-01`.
- Ao carregar um lançamento existente, extrair mês/ano de `data_competencia` para popular os selects.
- Coluna no banco continua `date` (compatível — sempre grava dia 1).

Nenhuma alteração de schema.

## 2. Renomear e explicar "Antecipar (meses)"

O campo `janela_geracao_meses` controla até quantos meses à frente o cron `despesas-scheduler` já cria as ocorrências futuras da série (ex.: janela=12 → sempre há 12 meses de lançamentos gerados adiante). Não é aviso de notificação (isso vem de `despesas_notificacoes_preferencias.dias_antecedencia`).

**Alteração em `src/components/despesas/RecorrenciaBlock.tsx`:**

- Renomear o label de "Antecipar (meses)" para "Gerar com antecedência (meses)".
- Adicionar texto de ajuda logo abaixo: "Quantos meses à frente as próximas ocorrências desta série ficam criadas automaticamente. Não afeta os avisos de vencimento — esses são configurados em Notificações."

## 3. "Renovar" recorrência após encerrar

Hoje `data_fim` congela a série; não há UI para prorrogar. A tabela `despesas_recorrencias` já tem `data_fim` editável via `useSaveRecorrencia`.

**Alterações em `src/pages/despesas/DespesasRecorrencias.tsx`:**

- Adicionar ação "Renovar" em cada linha da lista de recorrências. Habilitada quando `data_fim` não é nula (série com encerramento definido).
- Ao clicar, abrir um pequeno diálogo com dois campos: nova `data_fim` (input date, valor padrão = `data_fim` + 12 meses) e opção "Sem encerrar" (define `data_fim = null`).
- Confirmar → `useSaveRecorrencia` atualiza `data_fim` e `ativo = true`, depois dispara `useGerarOcorrencias` para gerar as novas ocorrências até a nova data.

Sem alterações de schema — as colunas já suportam.

## 4. Erro "on conflict" ao salvar (Germana)

Diagnóstico não confirmado — preciso investigar após ver a mensagem real. Suspeitos, em ordem:

1. `**useSaveLancamentoCredenciais**` (`src/hooks/useDespesasLancamentos.ts:290`) faz `upsert(..., { onConflict: "lancamento_id" })`. A tabela tem PK em `lancamento_id`, então funciona quando o usuário tem permissão. Se Germana tiver RLS de SELECT mas não de INSERT/UPDATE em `despesas_lancamentos_credenciais`, o erro `42501` já é engolido — mas se o Postgres devolver outro código (ex.: 23505 devido a upsert com policy WITH CHECK negando um leg do MERGE), o toast mostra "on conflict".
2. **Recorrência**: `useSaveRecorrencia` insere e depois o trigger de geração roda com `ON CONFLICT (serie_recorrencia_id, data_vencimento) DO NOTHING`. Se o RPC `despesas_gerar_ocorrencias` for chamado sem o índice único correspondente no ambiente da Germana (migration não executada), estoura "there is no unique or exclusion constraint matching the ON CONFLICT specification".

**Plano de ação:**

- Pedir a Germana o texto/screenshot completo do erro (código + mensagem) para confirmar qual dos dois é.
- Se for o (1): reforçar o `catch` em `salvar()` para tratar 23505/PGRST202 vindos de credenciais silenciosamente (mesmo tratamento que 42501) e logar aviso não bloqueante.
- Se for o (2): validar no Supabase que o índice `uq_desp_lanc_serie_venc` existe (`SELECT indexname FROM pg_indexes WHERE tablename='despesas_lancamentos'`); se ausente, criar migration recriando o índice.

O texto do erro foi: "there is no unique or exclusion constraint matching the ON CONFLICT specification".

## Detalhes técnicos

- Arquivos tocados: `src/components/despesas/LancamentoDialog.tsx`, `src/components/despesas/RecorrenciaBlock.tsx`, `src/pages/despesas/DespesasRecorrencias.tsx`, possivelmente `src/hooks/useDespesasLancamentos.ts` (item 4).
- Nenhuma migration nova nos itens 1–3. Item 4 pode gerar 1 migration se o índice estiver faltando no ambiente.
- Sem quebra de contrato: `data_competencia` continua sendo `date` (grava dia 01).