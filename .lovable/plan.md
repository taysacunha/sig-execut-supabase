## Reestruturação da Gestão de Placas

Ajustar a feature já implementada para o fluxo correto:

- Cadastro de placa = **entrada no estoque** → acontece na página **Materiais**
- Página **Placas** = só gestão (vínculo com imóvel, entrada/saída, perda/roubo, histórico, PDF)
- Códigos de placa são **únicos globalmente**

---

### 1. Banco (nova migration `estoque_placas_ajustes.sql`)

- Adicionar coluna `is_placa boolean NOT NULL DEFAULT false` em `estoque_materiais`. Admin marca o material "Placa" existente como `is_placa = true` (UPDATE direto na migration localizando por nome, com fallback manual).
- **Reforçar unicidade do código:** trocar o índice parcial atual por `UNIQUE (codigo)` em `estoque_placas`. Como agora cada código existe uma única vez (sem versionamento), remover colunas `versao` e `substitui_placa_id` — reposição vira simplesmente "reativar a placa" ou "cadastrar nova com outro código". → confirmar abaixo.
- Manter triggers de saldo, auditoria e histórico já criados.

### 2. Página Materiais (`src/pages/estoque/EstoqueMateriais.tsx`)

- Botão **"Nova Placa"** ao lado de **"Novo Material"** (visível só para admin/super, igual à regra atual).
- Abre dialog `NovaPlacaDialog` (mover de `placas/` para `materiais/`) com campos:
  - Código da placa (único, validação ao digitar consultando `estoque_placas`)
  - Tipo de uso: Venda / Aluga
  - Tamanho: 1x1 / 2x2 / Outro (+ texto)
  - Local de armazenamento
  - Observações
- Ao salvar: insere em `estoque_placas` com `status='disponivel'` + linha em `estoque_placas_historico` tipo `criacao`. Trigger atualiza `estoque_saldos` do material Placa automaticamente.
- Bloqueio: se o material com `is_placa=true` não existir, mostrar aviso "Cadastre primeiro o material Placa e marque-o como controle unitário".

### 3. Página Placas (`src/pages/estoque/EstoquePlacas.tsx`)

Remover a aba/dialog de "Nova Placa". Reorganizar em:

- **Aba 1 – Disponíveis:** placas com `status='disponivel'`, ação principal **Instalar em imóvel** (dialog: código do imóvel + data + obs).
- **Aba 2 – Instaladas:** placas com `status='instalada'`, mostra imóvel atual + data. Ações: **Retirar** (volta a disponível) e **Registrar roubo/perda** (dialog: tipo + data + obs).
- **Aba 3 – Baixadas:** roubadas/perdidas/baixadas (somente leitura + histórico).
- Filtros globais: tipo_uso, tamanho, local, busca por código/imóvel.
- Cada linha: botão **Histórico** (drawer com timeline) e **PDF da placa**.
- Botão geral **PDF Inventário** no topo.
- Permissões: qualquer usuário com `has_system_access('estoque')` pode usar as ações; exclusão definitiva só admin.

### 4. Saldos

A página `/estoque/saldos` continua mostrando o material "Placa" com quantidade = nº de placas disponíveis (já vem do trigger). Sem mudança de UI.

### 5. Arquivos

**Criar**

- `.lovable/estoque_placas_ajustes.sql` (flag is_placa, unicidade do código, drop versão)
- `src/components/estoque/materiais/NovaPlacaDialog.tsx`

**Alterar**

- `src/pages/estoque/EstoqueMateriais.tsx` — botão "Nova Placa"
- `src/pages/estoque/EstoquePlacas.tsx` — remover criação, reorganizar abas
- `src/hooks/useEstoquePlacas.ts` — remover mutation `criar nova versão`, manter criação simples
- `src/components/estoque/placas/PlacasPDFGenerator.tsx` — sem alteração estrutural
- `.lovable/plan.md`

### 6. Pendência antes de implementar

Você confirma **remover o versionamento** (`versao`, `substitui_placa_id`)? Isso simplifica: código é único, se uma placa for roubada e depois você comprar outra com o mesmo código físico, você primeiro precisa **dar baixa definitiva** na antiga (status `baixada`) e aí o sistema libera o código para um novo cadastro.

**Alternativa:** manter o versionamento que já está pronto (placa roubada fica no histórico com versão 1, nova compra entra como versão 2 do mesmo código) — só que aí "código único" passa a ser "código único entre placas ativas", não absolutamente único.

Qual prefere? Responda e eu sigo para a implementação. Remova o versionamento.