

## Diálogo de confirmação ao marcar "Enviado ao Contador"

### Problema atual
Ao clicar em "Pendente" para marcar como enviado, a ação executa imediatamente sem confirmação e sem perguntar qual período foi encaminhado. O diálogo de confirmação só existe para **desmarcar**.

### Solução

#### 1. Nova migração — colunas por período
Adicionar `enviado_contador_q1` e `enviado_contador_q2` (boolean, default false) à tabela `ferias_ferias`, permitindo rastrear envio independente de cada quinzena.

**Arquivo**: `.lovable/enviado_contador_periodos_migration.sql`

#### 2. Diálogo de confirmação ao marcar envio
Quando o usuário clicar em "Pendente", abrir um `Dialog` com:
- Nome do colaborador e período aquisitivo
- RadioGroup: "1ª Quinzena", "2ª Quinzena" (só se existir), "Ambos"
- Botões Cancelar / Confirmar Envio

Ao confirmar, a mutation atualiza `enviado_contador = true`, `enviado_contador_em`, e os campos `_q1` / `_q2` conforme seleção.

#### 3. Badges granulares
Os badges "1ª ✓/○" e "2ª ✓/○" passam a refletir `enviado_contador_q1` e `enviado_contador_q2` independentemente, em vez do campo booleano único.

#### 4. Desmarcar granular
O diálogo de desmarcar também perguntará qual período desmarcar. Se ambos forem desmarcados, `enviado_contador` volta a `false`.

### Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| `.lovable/enviado_contador_periodos_migration.sql` | Nova migração com colunas q1/q2 |
| `src/pages/ferias/FeriasFerias.tsx` | Diálogo de confirmação ao marcar, badges granulares, mutation atualizada |

