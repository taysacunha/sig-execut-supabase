# Premiação de Férias — Tabela de Férias

Nova funcionalidade na aba **Tabela de Férias** (`/ferias/ferias`) para registrar o pagamento da premiação (1/3) por período de cada colaborador, com 4 modelos de recibo (não vende / vende 5 / vende 10 / vende 15 dias), conforme a planilha enviada.

## 1. Banco de dados

Nova tabela `ferias_premiacoes` (migração):

```text
id                uuid PK
ferias_id         uuid FK ferias_ferias(id) ON DELETE CASCADE
periodo           int  (1 = 1ª quinzena, 2 = 2ª quinzena)
data_inicio       date  (período de gozo de fato)
data_fim          date
dias_gozados      int   (0, 5, 10 ou 15)
dias_vendidos     int   (0, 5, 10 ou 15)  — soma 15
valor_premiacao   numeric(12,2)           — valor digitado pelo usuário
data_recebimento  date
created_at/by, updated_at/by
UNIQUE (ferias_id, periodo)
```

RLS: `can_view_system('ferias')` para SELECT, `can_edit_system('ferias')` para INS/UPD/DEL.
Triggers de auditoria no padrão dos demais módulos de férias.

**Regra de ordem (validação no app + trigger):** não permitir INSERT de `periodo = 2` se não existir registro com `periodo = 1` para a mesma `ferias_id`. Apagar o 2º é permitido; apagar o 1º exige que o 2º também não exista (ou apagar em cascata controlada — proponho bloquear). Certo, bloqueie.

## 2. UI — Tabela de Férias

### 2.1 Dropdown antes do nome do colaborador

- Ícone de seta (chevron) na primeira coluna de cada linha.
- Ao expandir, mostra os pagamentos já cadastrados (1º e/ou 2º período):
  - Período (1ª/2ª quinzena), datas de gozo, dias vendidos, valor, data de recebimento, data do lançamento.
  - Botões: **Gerar PDF novamente**, **Editar**, **Apagar** (com AlertDialog).
  - Apagar respeita a regra: não apaga 1º se 2º existir.

### 2.2 Novo botão "Premiação" na coluna de ações

Ícone `BadgeDollarSign` (ou `Award`). Abre o **Dialog de Pagamento de Premiação**.

### 2.3 Dialog "Pagamento de Premiação" (multi-step)

**Etapa 1 — Seleção do período**

- Radio com "1ª Quinzena" e "2ª Quinzena" (esta última desabilitada com tooltip se não houver registro do 1º período ainda).
- Períodos já pagos aparecem desabilitados.

**Etapa 2 — Confirmação do período de gozo de fato**

- O sistema calcula o período real a partir de:
  1. `ferias_gozo_periodos` (gozo flexível) referente ao período selecionado, OU
  2. `gozo_quinzena{N}_inicio/fim` (gozo diferente), OU
  3. `quinzena{N}_inicio/fim` (padrão).
- Mostra datas e a quantidade de dias gozados/vendidos da quinzena (0/5/10/15).
- Campo de data de recebimento (default = hoje).

**Etapa 3 — Valor da premiação**

- Input numérico "Valor da Premiação (R$)".
- Para "não vende" (15 dias gozados): valor digitado é a **comissão de 15 dias** (metade do mensal já calculada externamente, como na planilha).
- Para "vende 5/10/15": valor digitado é a **premiação base** da quinzena (linha "PREMIAÇÃO" da planilha).

**Etapa 4 — Preview do recibo**

- Renderiza o modelo correto (4 layouts):


| Cenário               | Fórmulas (conforme planilha)                                                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vende 0 (gozo 15)** | comissão 15d = valor; **Recebe = valor / 3**                                                                                                  |
| **Vende 5 (gozo 10)** | base = valor; +1/3 = valor/3; total = valor·4/3; venda5+1/3 = total·5/30; 1/3·10d = (valor/3)·10/30; **Recebe = venda5 + 1/3·10d = valor/3**  |
| **Vende 10 (gozo 5)** | base = valor; +1/3 = valor/3; total = valor·4/3; venda10+1/3 = total·10/30; 1/3·5d = (valor/3)·5/30; **Recebe = valor·5/12 (≈ valor·0,4167)** |
| **Vende 15 (gozo 0)** | base = valor; +1/3 = valor/3; total = valor·4/3; venda15+1/3 = total·15/30; **Recebe = total/2 = valor·2/3**                                  |


Layout do recibo segue exatamente a planilha (linhas, ordem, rótulos, "____QUINZENA" preenchido com "1ª" ou "2ª"), incluindo colaborador, datas do período, data de recebimento e a frase **"EXECUT - Consultoria & Negócios Imobiliários Ltda."**

**Etapa 5 — Botões finais**

- **Salvar** (grava em `ferias_premiacoes`)
- **Gerar PDF** (jsPDF, A4 retrato, com `src/assets/execut-logo.jpg` no topo)
- Botão de PDF também disponível depois pelo dropdown.

## 3. Arquivos a criar/alterar

**Novos**

- `db/migrations/<timestamp>_ferias_premiacoes.sql` — tabela, RLS, trigger de ordem, trigger de auditoria.
- `src/components/ferias/ferias/PremiacaoDialog.tsx` — fluxo multi-step.
- `src/components/ferias/ferias/PremiacaoReciboPreview.tsx` — render dos 4 layouts.
- `src/lib/premiacaoCalc.ts` — fórmulas e tipo `PremiacaoResultado`.
- `src/lib/premiacaoPdf.ts` — geração do PDF (jsPDF) usando o logo.
- `src/hooks/ferias/useFeriasPremiacoes.ts` — React Query (list/insert/update/delete) com chave `["ferias-premiacoes", ferias_id]`.

**Alterados**

- `src/pages/ferias/FeriasFerias.tsx`
  - Adicionar coluna de expand (chevron) + estado `expandedRows`.
  - Sub-linha com lista de pagamentos + ações (PDF/editar/apagar).
  - Botão "Premiação" na barra de ações da linha → abre `PremiacaoDialog`.
  - Invalidar query ao salvar/apagar.

## 4. Regras de negócio resumidas

- Não vendeu = soma de dias vendidos da quinzena é 0; vende 5/10/15 conforme `dias_vendidos` distribuído por quinzena (já existe lógica `Math.min(dias_vendidos, 10)` por quinzena — será reusada).
- Não permitir 2º período sem 1º (UI + DB).
- Apagar 1º só se 2º não existir (UI + DB).
- Editar permite alterar valor, data de recebimento e datas (datas pré-preenchidas com o gozo de fato).
- Confirmações destrutivas via AlertDialog (padrão do projeto).

## 5. PDF

- A4 retrato, margens ~20mm.
- Topo: logo Execut (esquerda) + título "RECIBO" centralizado.
- Corpo: tabela com 2 colunas reproduzindo o layout da planilha do cenário correspondente.
- Rodapé: "EXECUT - Consultoria & Negócios Imobiliários Ltda." + linha para assinatura.
- Nome do arquivo: `Premiacao_<Colaborador>_<Periodo>_<AAAA-MM>.pdf`.

## 6. Pontos a confirmar antes de implementar

1. No cenário **"não vende"**, o valor digitado é a **"comissão de 15 dias" (340 na planilha)** — ou prefere digitar a **premiação mensal (680)** e o sistema divide por 2? (proposta: digitar a comissão de 15 dias, já que é por quinzena). Se o valor digitado for de 680, a comissão de 15 dias é de 340, então ela vai receber no final 113,33, que é 1/3 de 340.
2. Datas do período no recibo: usar o **gozo de fato** (flexível/diferente/padrão) — confirmado.
3. Permissão: somente quem tem `can_edit_system('ferias')` pode lançar/editar/apagar — ok? ok.