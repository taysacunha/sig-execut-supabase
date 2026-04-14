

## Gestão de Períodos Aquisitivos

### Situação atual
- O campo `periodo_aquisitivo_inicio/fim` já existe em `ferias_ferias`, mas é calculado automaticamente pela data de admissão + ano de referência
- O dashboard alerta períodos vencendo/vencidos, mas verifica apenas se o colaborador tem **qualquer** férias ativa — não calcula saldo real (dias gozados vs. devidos)
- Não é possível vincular férias a um período aquisitivo específico quando há mais de um pendente
- Não existe visão consolidada de "todos os períodos aquisitivos de um colaborador com saldo"

### O que será implementado

**1. Nova aba "Períodos Aquisitivos" na página de Férias** (`src/pages/ferias/FeriasFerias.tsx`)
- Terceira aba ao lado de "Tabela de Férias" e "Tabela do Contador"
- Lista todos os colaboradores ativos com seus períodos aquisitivos calculados pela data de admissão
- Para cada período mostra:
  - Período aquisitivo (ex: 01/03/2024 a 28/02/2025)
  - Período concessivo (12 meses seguintes ao aquisitivo)
  - Dias de direito: 30
  - Dias gozados: soma dos dias de férias vinculadas a esse período
  - Dias vendidos: soma dos dias vendidos nesse período
  - Saldo: 30 - gozados - vendidos
  - Status: **Quitado** (saldo = 0), **Parcial** (saldo > 0, dentro do prazo), **Pendente** (sem férias), **Vencido** (prazo concessivo expirado com saldo > 0)
- Filtros: ano, setor, status do período, busca por nome
- Badges coloridos por status

**2. Melhorar alerta no Dashboard** (`src/pages/ferias/FeriasDashboard.tsx`)
- Ao invés de apenas verificar se "tem alguma férias", calcular o saldo real de cada período aquisitivo
- Alertar quando um período tem saldo > 0 e está próximo de vencer ou já venceu
- Mostrar quantos dias ainda estão pendentes no alerta

**3. Vincular férias ao período aquisitivo no cadastro** (`src/components/ferias/ferias/FeriasDialog.tsx`)
- Adicionar seletor de período aquisitivo ao cadastrar/editar férias
- Listar os períodos aquisitivos do colaborador selecionado com o saldo disponível
- Permitir selecionar qual período está sendo quitado (útil quando há mais de um pendente)
- Validar que não se ultrapasse os 30 dias do período

### Lógica de cálculo (client-side, sem nova tabela)
Os períodos são calculados dinamicamente a partir da `data_admissao`:
- Cada aniversário gera um período aquisitivo de 12 meses
- As férias existentes em `ferias_ferias` são vinculadas ao período cujo `periodo_aquisitivo_inicio/fim` corresponde
- Dias gozados = soma das quinzenas (ou gozo_periodos flexíveis) dessa férias
- Dias vendidos = `dias_vendidos` da férias

### Arquivos modificados
- `src/pages/ferias/FeriasFerias.tsx` — nova aba "Períodos Aquisitivos"
- `src/pages/ferias/FeriasDashboard.tsx` — alerta com saldo real
- `src/components/ferias/ferias/FeriasDialog.tsx` — seletor de período aquisitivo

### Nenhuma migração necessária
Todos os dados necessários já existem: `data_admissao` dos colaboradores e `periodo_aquisitivo_inicio/fim` + `dias_vendidos` das férias.

