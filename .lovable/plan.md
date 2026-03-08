

## Plano: Redesign da Página de Saldos de Estoque

### Problemas Identificados

1. Tabela única mistura todas as unidades — difícil de visualizar
2. Botões "Ajuste" e "Transferência" ficam soltos no topo, sem contexto do material
3. Não existe opção de excluir uma entrada errada
4. Transferência não diferencia entre mesma unidade vs entre unidades

### Solução

#### 1. Abas por Unidade
- Substituir a tabela única por `Tabs` com uma aba por unidade (ex: "Bessa", "Manaíra")
- Cada aba mostra apenas os saldos daquela unidade
- Manter busca e paginação dentro de cada aba
- Aba "Todas" opcional como visão consolidada

#### 2. Ações por Linha (em cada material)
- Remover os botões "Ajuste" e "Transferência" do topo
- Manter apenas o botão "Entrada" no topo (ação global de registrar entrada)
- Em cada linha da tabela, adicionar coluna "Ações" com:
  - **Ajustar** — abre dialog pré-preenchido com o material e local daquela linha
  - **Transferir** — abre dialog pré-preenchido com material e local de origem
  - **Excluir** — abre AlertDialog de confirmação

#### 3. Dialog de Transferência Melhorado
- Pré-preenche material e local de origem da linha clicada
- Selecionar destino com locais agrupados por unidade para facilitar escolha
- Funciona tanto para mesma unidade quanto entre unidades

#### 4. Exclusão de Entrada com Justificativa
- AlertDialog de confirmação com campo de justificativa **obrigatório**
- Ao excluir: subtrai a quantidade do saldo correspondente (ou remove o registro de saldo se zerar)
- Registra movimentação do tipo "saida" com observação "Exclusão: [justificativa]"
- Se o saldo ficar zerado, remove o registro de `estoque_saldos`

### Arquivo a Alterar

| Arquivo | Alteração |
|---------|-----------|
| `EstoqueSaldos.tsx` | Reescrita completa: Tabs por unidade, ações por linha, exclusão com justificativa, dialog de transferência melhorado |

### Estrutura da UI

```text
Header: "Saldos de Estoque" + [Entrada]

[Alerta estoque baixo]

[Busca]

Tabs: [Todas] [Bessa] [Manaíra] [...]
  ┌──────────────────────────────────────────────────────────┐
  │ Material │ Local │ Qtd │ Mín │ Status │ Ações           │
  │──────────│───────│─────│─────│────────│─────────────────│
  │ Placa X  │ Arm.1 │  50 │  10 │  OK    │ [Ajustar][Transf][Excluir] │
  └──────────────────────────────────────────────────────────┘
  [Paginação]
```

