

## Correção: Tabela de Férias mostrando dados do contador + status não atualiza para "concluída"

### Problemas identificados

**1. Tabela mostra períodos oficiais, não os de gozo**
Linha 459 do `FeriasFerias.tsx`: a tabela mostra `quinzena1_inicio/fim` (período do contador) e só verifica `gozo_diferente` para o caso legado. Quando Ingrid tem `gozo_flexivel = true` com períodos na tabela `ferias_gozo_periodos` (ex: 20 dias seguidos a partir de 09/02), a tabela ignora isso e mostra os dois períodos oficiais.

**2. Status "em_gozo" nunca vira "concluída" para gozo flexível**
A função SQL `atualizar_status_ferias` calcula o fim do gozo como `COALESCE(gozo_quinzena2_fim, quinzena2_fim)`. Problemas:
- Não consulta `ferias_gozo_periodos` — ignora completamente o gozo flexível
- Quando `quinzena2_fim` é NULL (2º período pendente), `COALESCE` retorna NULL, e `NULL < CURRENT_DATE` é falso — o status fica preso em "em_gozo" para sempre

---

### Plano

#### A. Atualizar a função SQL `atualizar_status_ferias`

Reescrever para considerar 3 cenários de fim de gozo:
1. **Gozo flexível** (`gozo_flexivel = true`): buscar `MAX(data_fim)` de `ferias_gozo_periodos`
2. **Gozo diferente legado** (`gozo_diferente = true`): usar `gozo_quinzena2_fim` ou `gozo_quinzena1_fim`
3. **Padrão**: usar `quinzena2_fim` ou `quinzena1_fim` (para quando Q2 é null)

Mesma lógica para o início do gozo (transição aprovada → em_gozo).

#### B. Tabela de Férias: mostrar períodos de gozo reais

No `FeriasFerias.tsx`:
- Buscar `ferias_gozo_periodos` para as férias com `gozo_flexivel = true` (mesma abordagem do `CalendarioFeriasTab`)
- Na tabela, quando `gozo_flexivel`, mostrar os sub-períodos reais em vez de Q1/Q2 oficial
- Quando `gozo_diferente` (legado), já funciona parcialmente — manter
- Quando é caso padrão (sem exceção), Q1/Q2 oficial = gozo, manter como está

A coluna "1º Período" e "2º Período" passam a representar o gozo real. A aba "Contador" já existe para mostrar os períodos oficiais.

---

### Arquivos impactados

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | Reescrever `atualizar_status_ferias` para considerar `gozo_flexivel` e Q2 null |
| `FeriasFerias.tsx` | Buscar `ferias_gozo_periodos`, exibir gozo real nas colunas de período |

