
Objetivo: corrigir de forma definitiva o status prematuro da Taysa (e de qualquer outro registro), mesmo quando já foi rodado SQL manualmente.

1) Diagnóstico que vou tratar
- Hoje o frontend chama `supabase.rpc("atualizar_status_ferias")` em `FeriasFerias.tsx`, mas ignora erro da RPC.
- Se a função no banco falhar por qualquer motivo, a tela continua carregando os dados antigos e mantém “Em Gozo - 1º Período” incorretamente.
- A pasta `supabase/migrations` ainda está com versões antigas da função (legado `em_gozo`), então o histórico de migração do projeto está inconsistente com o comportamento granular esperado.

2) Implementação planejada

A. Tornar a atualização de status observável no frontend
- Arquivo: `src/pages/ferias/FeriasFerias.tsx`
- Alterar a chamada RPC para capturar erro explicitamente:
  - `const { error: statusError } = await supabase.rpc("atualizar_status_ferias");`
  - se houver erro: lançar exceção para não seguir com `select` silenciosamente.
- Expor estado de erro da query na UI (alerta simples) para evitar “status errado sem aviso”.

B. Substituir a lógica SQL por reconciliação determinística
- Criar migration nova em `supabase/migrations/...sql` (não em `.lovable`).
- Reescrever `public.atualizar_status_ferias()` para calcular status final com base em datas reais de gozo (flexível / gozo_diferente / oficial), sem depender do status anterior.
- Regras:
  - antes do início real do Q1 => `aprovada`
  - durante Q1 => `em_gozo_q1`
  - entre fim Q1 e início Q2 => `q1_concluida`
  - durante Q2 => `em_gozo_q2`
  - após último fim => `concluida`
  - sem Q2 => após Q1 vai direto para `concluida`
- Incluir no mesmo SQL:
  - saneamento de legado (`referencia_periodo` nulo -> 1 quando aplicável)
  - reconciliação imediata executando a função ao final da migration para corrigir dados já existentes.

C. Eliminar ponto frágil de “fallback indevido”
- Ajustar a função para priorizar `ferias_gozo_periodos` quando `gozo_flexivel = true` e só cair para oficial quando realmente não houver subperíodos válidos.
- Isso evita marcar “em gozo” por data oficial quando o gozo real foi dividido em exceção e começa depois.

3) Detalhes técnicos (resumo)
- Arquivos afetados:
  - `src/pages/ferias/FeriasFerias.tsx`
  - `supabase/migrations/<novo_arquivo>.sql`
- Estratégia SQL:
  - CTE para calcular `q1_inicio_real`, `q1_fim_real`, `q2_inicio_real`, `q2_fim_real`
  - `UPDATE ferias_ferias ... SET status = CASE ... END` em lote
  - manter `SECURITY DEFINER` e `search_path=public`.

4) Critérios de aceite
- Na tabela de férias, Taysa deve aparecer como `Aprovada` até 18/03.
- Card “Em Gozo” deve reduzir automaticamente se ela estava contando indevidamente.
- No dia 18/03, após refresh, transição para `Em Gozo - 1º Período` deve ocorrer automaticamente.
- Se houver qualquer falha da RPC, a tela deve mostrar erro explícito (não status antigo silencioso).
