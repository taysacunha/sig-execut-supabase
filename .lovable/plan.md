

## Refatoração completa da aba Exceção no cadastro de férias

### Resumo

Mudanças profundas na aba de exceção do `FeriasDialog` para suportar distribuição flexível de períodos de gozo, tanto para venda de dias quanto para gozo em datas diferentes. Envolve nova tabela no banco, refatoração do formulário, e atualização do calendário e visualizações.

---

### 1. Nova tabela: `ferias_gozo_periodos`

A estrutura atual (`gozo_quinzena1/2_inicio/fim`) só suporta 2 períodos fixos. Para o modo "Livre" e distribuição em N sub-períodos, precisamos de uma tabela filha:

```text
ferias_gozo_periodos
├── id (uuid, PK)
├── ferias_id (uuid, FK → ferias_ferias.id, ON DELETE CASCADE)
├── tipo (text: 'venda' | 'gozo_diferente')
├── referencia_periodo (int, nullable: 1 ou 2 — qual período oficial refere)
├── numero (int — ordem sequencial)
├── dias (int — quantidade de dias deste sub-período)
├── data_inicio (date)
├── data_fim (date)
├── created_at (timestamptz, default now())
```

RLS: mesmas políticas de `ferias_ferias` (can_view/edit_system ferias).

Quando existirem registros nesta tabela para uma férias, o calendário e visualizações usarão estes períodos em vez dos campos fixos `gozo_quinzena1/2`.

---

### 2. Refatoração do formulário (FeriasDialog.tsx)

**Aba Padrão** — sem mudanças (mantém radio button e lógica atual de venda <=10 dias).

**Aba Exceção** — mudanças:

#### 2a. Remover o RadioGroup de opções

Na exceção, as opções "Vender dias" e "Gozo em datas diferentes" aparecem como **checkboxes independentes** (podem coexistir? Não — são mutuamente exclusivas mas sem radio visual). Na verdade, pelo que o usuário disse, são opções separadas. Usaremos **dois botões** (estilo toggle) em vez do radio: "Vender dias de férias" e "Gozo em datas diferentes".

#### 2b. Vender dias (exceção)

1. Campo: quantidade de dias a vender (1-30)
2. Seletor de distribuição: `1º Período` | `2º Período` | `Ambos` | `Livre`
3. **1º ou 2º Período**: gozo = 15 dias do período não vendido (se vendeu <=15) ou dias restantes. Data início + cálculo automático do fim.
4. **Ambos**: dois campos de dias (auto-balance). Ex: se total é 10 dias de gozo e coloca 7 no 1º, o 2º fica com 3. Cada um com data início e fim automático.
5. **Livre**: lista dinâmica de sub-períodos. Botão "Adicionar período". Cada item: dias + data início → fim auto. Validação: soma dos dias = (30 - dias_vendidos). Se sobrar 0, não mostra nenhum período.

#### 2c. Gozo em datas diferentes (exceção)

1. Seletor: `1º Período` | `2º Período` | `Ambos`
2. **1º Período**: 15 dias para distribuir. O usuário pode dividir em múltiplos sub-períodos (lista dinâmica como "Livre"). Total dos sub-períodos = 15.
3. **2º Período**: mesma lógica, 15 dias.
4. **Ambos**: dois blocos, cada um com seus sub-períodos de 15 dias.
5. Cada sub-período: dias + data início → fim automático.

---

### 3. Lógica de persistência (mutation)

No `onSubmit`:
- Salvar `ferias_ferias` normalmente (campos fixos `gozo_quinzena1/2` ficarão `null` quando usar períodos flexíveis).
- Adicionar flag `gozo_flexivel: true` à tabela `ferias_ferias` (nova coluna boolean, default false).
- Deletar `ferias_gozo_periodos` existentes para o `ferias_id`.
- Inserir os novos sub-períodos na tabela `ferias_gozo_periodos`.
- Para opções simples (1º ou 2º sem subdivisão), salvar como 1 registro na tabela filha.

Nova coluna em `ferias_ferias`:
```sql
ALTER TABLE ferias_ferias ADD COLUMN gozo_flexivel boolean DEFAULT false;
ALTER TABLE ferias_ferias ADD COLUMN distribuicao_tipo text; -- '1', '2', 'ambos', 'livre'
```

---

### 4. Atualização do ViewDialog

- Quando `gozo_flexivel = true`, buscar `ferias_gozo_periodos` e exibir lista de sub-períodos agrupados por `referencia_periodo`.
- Mostrar cada sub-período como um card compacto com número, dias, início e fim.

---

### 5. Atualização do Calendário

No `CalendarioFeriasTab.tsx`, a função `getGozoDates` precisa:
- Se `gozo_flexivel = true`, buscar da tabela `ferias_gozo_periodos` e retornar array de intervalos.
- O cálculo de `diasComFerias` iterará sobre todos os sub-períodos.
- Isso requer um join adicional na query principal ou uma query separada.

**Abordagem**: fazer join na query principal para trazer os sub-períodos junto com cada férias.

---

### 6. Arquivos impactados

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | Nova tabela + colunas + RLS |
| `FeriasDialog.tsx` | Refatorar seção exceção (UI + lógica + mutation) |
| `FeriasViewDialog.tsx` | Exibir sub-períodos flexíveis |
| `CalendarioFeriasTab.tsx` | Usar sub-períodos no calendário |
| `ConsultaGeralTab.tsx` | Ajustar exibição de períodos |
| `types.ts` | Auto-regenerado após migration |

### 7. Faseamento sugerido

Dada a complexidade, implementarei em uma única entrega coesa:
1. Migration (tabela + colunas)
2. FeriasDialog (formulário completo da exceção)
3. Mutation (salvar sub-períodos)
4. ViewDialog + Calendário (exibição)

