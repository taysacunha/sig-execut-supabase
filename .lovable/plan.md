

## Plano consolidado: Gestão completa de créditos

Combina o fluxo automatizado de consumo de créditos (página Créditos) com os alertas/integrações nos diálogos de folga manual e perda de folga.

### 1. Novos diálogos de consumo na página Créditos

**`UtilizarCreditoFolgaDialog.tsx`** (novo)
- Acionado pelo botão "Usar" em créditos do tipo `folga`
- Campos: data do sábado (DatePicker filtrando apenas sábados futuros)
- Ao confirmar: insere em `ferias_folgas` com `is_excecao = true`, `excecao_motivo = "credito_folga"`; marca crédito como `utilizado` com `utilizado_referencia` apontando para a data
- Invalida queries `ferias-folgas` e `ferias-creditos`

**`UtilizarCreditoFeriasDialog.tsx`** (novo, inteligente por cenário)
- Acionado pelo botão "Usar" em créditos do tipo `ferias`
- Permite selecionar **múltiplos créditos** do mesmo colaborador para somar dias
- Detecta cenário consultando `ferias_ferias` do colaborador:
  - **A — Sem férias**: oferece "Criar novo período" → pré-preenche `FeriasDialog` com 30 + N dias
  - **B — Tem férias não gozadas**: oferece "Estender período X em N dias" ou "Criar período adicional"
  - **C — Gozou parcialmente**: oferece "Adicionar ao período restante" ou "Criar período independente"
  - **D — Gozou tudo**: oferece "Criar período extra de N dias" (`is_excecao = true`, `excecao_motivo = "credito_ferias"`)
- Ao confirmar: aplica update/insert em `ferias_ferias`, marca créditos como `utilizado` com referência ao período criado/estendido

### 2. Ajuste manual de folga (`FeriasFolgas.tsx`)

- Ao abrir o diálogo de "Ajuste Manual" e selecionar um colaborador, executa query buscando créditos `tipo = 'folga'` e `status = 'disponivel'`
- Se houver créditos:
  - Exibe **Alert informativo**: "Este colaborador tem X crédito(s) de folga disponível(is)."
  - Exibe **Checkbox**: "Utilizar crédito de folga neste ajuste"
- Ao salvar com checkbox marcado:
  - Insere folga normalmente com `is_excecao = true`, `excecao_motivo = "credito_folga"`
  - Atualiza o crédito mais antigo: `status = 'utilizado'`, `utilizado_em = hoje`, `utilizado_referencia = data_sabado`
- Invalida `ferias-creditos` além das queries normais

### 3. Cadastro de férias (`FeriasDialog.tsx`)

- Ao selecionar colaborador, query busca créditos disponíveis (folga e férias)
- Se houver, exibe **Alert informativo** abaixo do combobox: "Este colaborador possui X crédito(s) disponível(is) (Y dia(s) de folga, Z dia(s) de férias). Para utilizá-los, vá para a página **Créditos**."
- Não bloqueia nem altera o cadastro — apenas informa, pois o consumo correto exige o fluxo da nova tela

### 4. Registro de perda de folga (`PerdaFolgaDialog.tsx`)

- Ao selecionar colaborador, query busca créditos `tipo = 'folga'` disponíveis
- Se houver, exibe **Alert informativo**: "Este colaborador possui N crédito(s) de folga disponível(is). A perda será registrada normalmente; os créditos permanecem disponíveis para uso futuro."
- Não bloqueia o registro

### Arquivos modificados/criados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/ferias/creditos/UtilizarCreditoFolgaDialog.tsx` | **Novo** |
| `src/components/ferias/creditos/UtilizarCreditoFeriasDialog.tsx` | **Novo** — lógica por cenário, multi-seleção |
| `src/pages/ferias/FeriasCreditos.tsx` | Substituir botão "Usar" genérico pelos novos diálogos por tipo |
| `src/pages/ferias/FeriasFolgas.tsx` | Query de créditos + alert + checkbox no ajuste manual; consumo ao salvar |
| `src/components/ferias/ferias/FeriasDialog.tsx` | Query de créditos + alerta informativo |
| `src/components/ferias/folgas/PerdaFolgaDialog.tsx` | Query de créditos + alerta informativo |

### Detalhes técnicos

- Queries leves filtradas por `colaborador_id` e `status = 'disponivel'`, com `enabled` condicional ao `colaborador_id` selecionado
- No `UtilizarCreditoFeriasDialog`, detecção de cenário: ordenar `ferias_ferias` por `quinzena1_inicio`, comparar `status` e datas atuais com `new Date()` para saber quais períodos já foram gozados
- Estender período: `UPDATE ferias_ferias SET quinzena2_fim = quinzena2_fim + interval 'N days'` (ou campo `gozo_quinzena2_fim` quando aplicável)
- Criar período extra: `INSERT INTO ferias_ferias` com `quinzena1_inicio/fim` calculados a partir da data informada e `is_excecao = true`
- Botão "Salvar" desabilitado até que o cenário e os campos obrigatórios estejam preenchidos

