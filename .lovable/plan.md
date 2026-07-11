## Como vai funcionar (fluxo correto)

Exemplo: placa código `X` está no imóvel 123 → é roubada.

1. Usuário registra o roubo (fluxo atual, sem mudança). A placa antiga fica com `status = 'roubada'` e o código `X` permanece nela como registro histórico.
2. O código `X` entra em uma **"lista de códigos disponíveis para reaproveitamento"** (todos os códigos de placas com status `roubada` ou `perdida`).
3. Na aba **Disponíveis**, cada placa física **sem código** (`codigo IS NULL`, `status = 'disponivel'`) passa a ter um novo botão **"Reaproveitar código"** (ícone `RefreshCcw`), ao lado do botão atual "Atribuir código".
4. Ao clicar, abre um dialog `ReaproveitarCodigoDialog` mostrando:
   - Placa destino (readonly): material, tamanho, local.
   - Select: **Código disponível para reaproveitamento** → lista os códigos de placas roubadas/perdidas, com badge indicando origem (ex: `X — roubada em 12/05/2026, imóvel 123`).
   - Botão "Confirmar reaproveitamento".
5. Ao confirmar, tudo em uma transação (RPC `reaproveitar_codigo_placa`):
   - `UPDATE estoque_placas SET codigo = NULL WHERE id = <antiga>` — libera o código da placa antiga (que continua com status roubada/perdida como registro).
   - `UPDATE estoque_placas SET codigo = 'X' WHERE id = <placa_destino_sem_codigo>` — atribui o código à placa disponível.
   - `INSERT INTO estoque_placas_historico` na placa **destino** com `tipo = 'reaproveitamento_codigo'`, `observacoes` = "Código X reaproveitado da placa <id_antiga> (roubada em dd/mm/yyyy)".
   - `INSERT INTO estoque_placas_historico` na placa **antiga** com `tipo = 'reaproveitamento_codigo'`, `observacoes` = "Código X transferido para placa <id_destino>".
   - **Nenhum saldo é movimentado** — a placa destino já tinha sido consumida do saldo quando foi cadastrada sem código.

## Regras

- Botão "Reaproveitar código" só aparece em placas físicas com `codigo IS NULL` e `status = 'disponivel'`.
- Só códigos de placas com `status IN ('roubada','perdida')` **e** `codigo IS NOT NULL` entram na lista de disponíveis.
- Se não há nenhum código disponível para reaproveitar, o botão fica desabilitado com tooltip "Nenhum código de placa roubada/perdida disponível".
- Retiradas normais continuam devolvendo a placa para `disponivel` mantendo o código intacto (não vira placa sem código).
- Baixa administrativa (`baixada`) **não** libera código.

## Escopo técnico

### 1. Migração
- Ampliar `estoque_placas_historico.tipo` para aceitar `reaproveitamento_codigo` (via `ALTER TYPE ... ADD VALUE` se enum, ou ajustar CHECK).
- Criar `public.reaproveitar_codigo_placa(p_placa_destino_id uuid, p_placa_origem_id uuid) RETURNS uuid` com `SECURITY DEFINER`, validando `can_edit_system(auth.uid(), 'estoque')` e ambos os estados esperados (destino sem código + origem roubada/perdida).

### 2. Frontend
- `useEstoquePlacas.ts`: adicionar `reaproveitamento_codigo: "Reaproveitamento de código"` em `HIST_LABELS` e no union type de `PlacaHistorico['tipo']`. Novo hook `useCodigosReaproveitaveis()` que retorna placas com `status IN ('roubada','perdida') AND codigo IS NOT NULL`.
- Novo componente `src/components/estoque/placas/ReaproveitarCodigoDialog.tsx` seguindo o padrão de `AtribuirCodigoDialog.tsx` (select de códigos + info da placa destino + chamada RPC).
- `EstoquePlacas.tsx`: adicionar botão `RefreshCcw` nas linhas físicas com `codigo IS NULL AND status = 'disponivel'`, ao lado do "Atribuir código". Nenhuma outra ação é alterada.
- `HistoricoDialog`: `HIST_LABELS['reaproveitamento_codigo']` já cobre o rótulo; a `observacao` traz a referência da contraparte em texto.

### 3. Sem alterações
- Fluxo de instalar/retirar/roubo/perda/histórico/excluir.
- Movimentação de saldos (nenhum saldo é consumido no reaproveitamento).
- Linhas "Saldo agregado" e `NovaSaidaDialog`.
- Botão "Atribuir código" existente continua para atribuir um código **novo** (não reaproveitado).
