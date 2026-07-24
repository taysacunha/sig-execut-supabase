## Contexto

Dois problemas relacionados no fluxo "enviado ao contador" das férias:

**1. Ivone — só aparece o 2º período no seletor "Período da venda"**

Em `FeriasDialog.tsx` (linhas 280-288, 1731, 1842), a variável `q1JaGozada` esconde a opção "1º Período" sempre que o fim do 1º período já passou (`fimQ1JaPassou`) OU o status é `q1_concluida | em_gozo_q2 | em_gozo | concluida`. Como as férias da Ivone estão editadas depois do fim do 1º período, o sistema assume que Q1 já foi gozado e só oferece o 2º. Isso é uma proteção correta para casos normais, mas não permite corrigir um registro histórico em que a venda foi de fato do 1º período.

**2. Não há como desfazer "enviado ao contador"**

Em `FeriasFerias.tsx` o diálogo já permite desmarcar Q1/Q2 na prática (o botão salva o novo estado), mas:
- não pede justificativa,
- não registra evento explícito de reversão,
- os campos de datas oficiais no `FeriasDialog` ficam travados quando `enviado_contador_q1/q2 = true` (linhas 1659, 1688), sem caminho de reversão explícito e auditado.

## O que fazer

### A. Permitir corrigir "Período da venda" mesmo quando Q1 já passou

No `FeriasDialog.tsx`, no bloco padrão de venda (linhas 1836-1848) e no bloco de exceção (1706-1740):

- Manter a lógica atual (esconder 1º Período quando `q1JaGozada`) como default.
- Adicionar, logo abaixo do Select, um pequeno botão/link discreto: **"Corrigir período histórico"**.
- Ao clicar, abre um pequeno diálogo de confirmação exigindo:
  - motivo (textarea obrigatório, mín. 10 caracteres),
  - checkbox "Confirmo que a venda foi realizada no 1º período aquisitivo".
- Após confirmar, libera a opção "1º Período" no Select apenas para essa edição, e o `useEffect` da linha 348-355 (que força `quinzena_venda = 2`) passa a respeitar essa liberação.
- No submit, além de gravar `quinzena_venda = 1`, registrar o motivo em `module_audit_logs` (ver seção C) — o registro normal em `ferias_ferias` já é auditado pelo trigger existente, então basta um insert manual complementar com `action = 'CORRECAO_QUINZENA_VENDA'` e o motivo em `new_data`.

### B. Reverter "enviado ao contador" com justificativa

No diálogo "Gerenciar envio ao contador" (`FeriasFerias.tsx` linhas 1653-1702):

- Detectar reversão: alguma checkbox passa de marcada → desmarcada.
- Quando houver reversão, exibir bloco vermelho com:
  - Alerta explicando que a reversão fica registrada.
  - Textarea "Motivo da reversão" (obrigatório, mín. 10 caracteres) — só aparece se há reversão.
- Botão "Salvar" desabilitado enquanto o motivo estiver vazio, quando houver reversão.
- `toggleEnviadoContadorMutation` (linhas 433-450) recebe `motivo?: string` e, quando presente, grava um evento em `module_audit_logs` com `action = 'REVERSAO_ENVIO_CONTADOR'`, `new_data = { q1_antes, q2_antes, q1_depois, q2_depois, motivo, revertido_por, revertido_em }`.
- Aviso visual permanente: quando `enviado_contador_em` for anterior e o status atual for "Pendente" ou "Parcial" após reversão, exibir badge extra "Revertido" no lugar/junto ao status.

### C. Registro de auditoria

Nenhuma migration nova é obrigatória — reaproveitar `module_audit_logs` (já existe e tem coluna `changed_by_email`, `new_data jsonb`, `action text`).

- Inserir manualmente pelo frontend via `supabase.from('module_audit_logs').insert({ module_name: 'ferias', table_name: 'ferias_ferias', record_id, action: 'REVERSAO_ENVIO_CONTADOR' | 'CORRECAO_QUINZENA_VENDA', new_data: { motivo, ... } })`.
- Verificar RLS: se `module_audit_logs` bloquear inserts do usuário comum, criar uma RPC `SECURITY DEFINER` `registrar_evento_ferias(record_id uuid, action text, payload jsonb)` (uma migration nova pequena). Confirmar com uma consulta antes de decidir.

### D. Exibição na aba de auditoria

Adicionar rótulos amigáveis em `AuditLogsPanel.tsx` para as duas novas ações:
- `REVERSAO_ENVIO_CONTADOR` → "Reversão de envio ao contador"
- `CORRECAO_QUINZENA_VENDA` → "Correção do período da venda"

## Arquivos afetados

- `src/components/ferias/ferias/FeriasDialog.tsx` — botão "Corrigir período histórico" + diálogo de justificativa; libera o "1º Período" após confirmação.
- `src/pages/ferias/FeriasFerias.tsx` — campo de motivo no diálogo de "Gerenciar envio ao contador"; mutação envia motivo e grava evento de auditoria; badge "Revertido".
- `src/components/AuditLogsPanel.tsx` — rótulos das novas ações.
- (Opcional) `db/migrations/<data>_ferias_registrar_evento.sql` — RPC `SECURITY DEFINER` caso RLS de `module_audit_logs` não permita inserts diretos.

## Fora de escopo

- Alterar a lógica de `q1JaGozada` para o fluxo geral (permanece como proteção padrão).
- Alterar o cálculo do relatório do contador — apenas o dado de origem (`quinzena_venda`) muda.
