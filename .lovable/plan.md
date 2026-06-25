## Objetivo

Reorganizar a página `/estoque/placas` para deixar claro o que é **saldo (quantidades por material/local)** e o que é **placa individual (unidade física com código)**, corrigir o fluxo de exclusão (confirmação, justificativa, atualização de saldo) e simplificar o diálogo de saída.

## Respostas rápidas (para alinhamento)

- **Botão Excluir hoje:** já existe `AlertDialog` de confirmação, mas **não pede justificativa** e **não devolve a unidade ao saldo** quando a placa estava `disponível`. Será corrigido.
- **Como atribuir código a placas existentes:** hoje só é possível na hora da saída. Vamos adicionar um botão **"Atribuir código"** em cada linha da lista (válido para qualquer placa sem código, independente do status), além de manter o fluxo na saída.
- **Saída para imóvel:** hoje há **dois caminhos** que fazem coisas levemente diferentes:
  1. Botão grande **"Nova saída para imóvel"** (topo) → escolhe material+local+código e instala.
  2. Ícone **"Instalar em imóvel"** (chave inglesa) na linha de uma placa específica `disponível`.
  Ambos são válidos. Vamos deixar isso explícito no UI (rótulos + tooltip) para o usuário não ficar em dúvida.

## Mudanças na página `EstoquePlacas.tsx`

### 1. Reorganização visual (separar Saldos × Placas)

Layout atual: filtros + card "Saldos disponíveis" + card "Lista de placas" todos colados, sem hierarquia. Novo layout para a aba **Disponíveis**:

```text
┌─ Cabeçalho da página ────────────────────────────────────┐
│ Placas    [Nova saída p/ imóvel] [PDF]                   │
├──────────────────────────────────────────────────────────┤
│ [Tabs: Disponíveis | Instaladas | Baixadas]              │
├──────────────────────────────────────────────────────────┤
│ ╔══ SALDOS (azul) ═════════════════════════════════════╗ │
│ ║ Quanto tenho de cada placa, por local                ║ │
│ ║ [tabela compacta agrupando material/local/qtd]       ║ │
│ ╚══════════════════════════════════════════════════════╝ │
│ ╔══ PLACAS (verde/âmbar/cinza por aba) ════════════════╗ │
│ ║ Unidades físicas (com ou sem código)                 ║ │
│ ║ [filtros] [tabela placa-a-placa] [paginação]         ║ │
│ ╚══════════════════════════════════════════════════════╝ │
└──────────────────────────────────────────────────────────┘
```

- Cada bloco com **header colorido + ícone + descrição curta** ("Saldos: contagem agregada" / "Placas: cada unidade individual").
- Usar cores do design system via tokens semânticos: borda/fundo sutil `border-blue-500/30 bg-blue-500/5` para Saldos, `border-emerald-500/30 bg-emerald-500/5` para Disponíveis, `border-blue-500/30` para Instaladas e `border-muted` para Baixadas.
- Bloco **Saldos** aparece apenas na aba **Disponíveis** (mantém comportamento atual, mas com destaque visual).
- Filtros movidos para dentro do bloco Placas, com label "Filtrar placas".
- Botão "Nova saída p/ imóvel" ganha tooltip explicando: "Escolha o material e local, ou use o ícone de chave inglesa em uma placa específica abaixo."

### 2. Exclusão com justificativa + ajuste de saldo

- Trocar `AlertDialog` simples por um diálogo com:
  - `Textarea` **obrigatório** "Justificativa da exclusão" (mín. 5 caracteres, máx. 500).
  - Botão "Excluir" desabilitado até preencher a justificativa.
- Na mutação `excluirMutation`:
  - Se a placa estava `disponivel` e tinha `local_armazenamento_id` → **decrementar 1 do saldo** (`estoque_saldos`) ou deletar a linha se zerar.
  - Inserir registro em `estoque_movimentacoes` tipo `saida` com a justificativa no campo `observacoes` (prefixo "Exclusão de placa <código>: …").
  - Excluir a placa (cascade já remove histórico).
- Invalidate queries: placas, saldos, movimentações.

### 3. Atribuir código a placas existentes

Hoje placas podem ficar sem código (campo virou nullable na migration `20260624120000`). Adicionar:

- Botão de ícone **`Tag`** na linha, visível quando `p.codigo == null`, com tooltip "Atribuir código".
- Novo `AtribuirCodigoDialog`:
  - Mostra material, tipo, tamanho, local atual.
  - Input "Novo código" (máx. 30) com checagem de duplicidade em tempo real (mesmo padrão do `NovaSaidaDialog`).
  - Salva via `update` em `estoque_placas` setando `codigo`.
  - Insere registro em `estoque_placas_historico` tipo `criacao` com observação "Código atribuído posteriormente".
- Disponível para placas em **qualquer status** (disponível, instalada, baixada, etc.) — para regularizar legado.

### 4. Diálogo "Nova saída para imóvel" — filtrar locais com saldo

No `NovaSaidaDialog.tsx`:

- Depois de escolher o **Material da placa**, recalcular a lista do `Select` de **Local de armazenamento** para mostrar **apenas locais com `saldo > 0`** desse material.
- Se a lista ficar vazia: substituir o select por aviso "Nenhum local tem saldo deste material. Lance entrada em `/estoque/saldos` antes."
- Manter o restante do fluxo intacto (atribuir código a placa sem código, ou criar nova).

## Detalhes técnicos

- Arquivos editados:
  - `src/pages/estoque/EstoquePlacas.tsx` — layout, cores, novo diálogo de exclusão, novo botão "Atribuir código".
  - `src/components/estoque/placas/NovaSaidaDialog.tsx` — filtrar locais com saldo do material selecionado.
- Arquivo novo:
  - `src/components/estoque/placas/AtribuirCodigoDialog.tsx`.
- Sem migrations — schema já suporta tudo (código nullable, histórico, saldos).
- Sem mudanças em RLS, hooks compartilhados ou rotas.
- Não altera regras de negócio de instalação/retirada/roubo/perda.
- Tokens semânticos do Tailwind (sem `text-white` hardcoded). Reusar `STATUS_COLORS` e adicionar uma paleta leve por bloco.

## Fora de escopo

- Refatorar `EstoqueSaldos.tsx`.
- Auditoria persistente de exclusões em tabela dedicada (a justificativa fica em `estoque_movimentacoes.observacoes`).
- Alterar comportamento do botão de instalar na linha (continua funcionando como atalho).
