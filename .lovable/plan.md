## Fluxo final do controle de placas

Três etapas claras, cada uma na sua página:

```text
1. MATERIAIS    → cadastra o material "Placa" (uma vez, com is_placa=true)
                   + opcionalmente pré-cadastra códigos via "Nova Placa"
2. SALDOS       → admin lança entrada de N unidades no local de armazenamento
                   (saldo numérico, sem códigos)
3. PLACAS       → gestão de saída/retorno/roubo/perda, vinculando código de
                   placa ao código do imóvel
```

## Regra-chave

O saldo da página **Saldos** é a fonte da verdade da quantidade física disponível.
Os **códigos** da página Placas são rótulos de rastreamento — só consomem saldo quando uma placa sai para um imóvel.

- Placa **disponível com código** = código já cadastrado, ainda não foi instalada.
- Placa **instalada** = saiu para um imóvel (consumiu 1 do saldo do local).
- Placa **retornada** = voltou ao estoque (devolve 1 ao saldo do local, código vira "disponível" de novo).
- Placa **roubada/perdida** = baixa definitiva (consumiu 1 do saldo, código fica bloqueado para reuso — nova compra usa novo código).

## Mudanças na página /estoque/placas

Manter as 3 abas (**Disponíveis / Instaladas / Baixadas**), mas reorganizar as ações:

### Aba Disponíveis
Lista placas com status `disponivel` (com código já cadastrado).
Ação por linha: **"Instalar em imóvel"** → dialog pede só código do imóvel + observação. Consome 1 do saldo do local de armazenamento da placa.

### Aba Instaladas
Lista placas com status `instalada` (mostra código da placa + código do imóvel + data).
Ações por linha:
- **Retornar ao estoque** → devolve 1 ao saldo, placa volta a `disponivel`.
- **Registrar roubo** / **Registrar perda** → baixa definitiva, código bloqueado.

### Aba Baixadas
Read-only: placas roubadas/perdidas com histórico completo.

### Botão principal "Nova saída para imóvel" (topo da página)
Único fluxo unificado, abre dialog com:
1. **Local de armazenamento** (select) — mostra saldo disponível ao lado.
2. **Tipo de uso** (Venda/Aluga) e **tamanho** (1x1/2x2/outro).
3. **Código da placa**:
   - Combobox listando placas com status `disponivel` no local + tipo + tamanho selecionados.
   - Se não houver código disponível ou o usuário quiser, opção **"+ Criar novo código"** → input para digitar código novo (validação de unicidade global) → cria a placa e já marca como instalada.
4. **Código do imóvel** (texto livre obrigatório).
5. **Observação** (opcional).

Validação: bloqueia se saldo do local = 0. Cria entrada em `estoque_placas_historico` (instalacao). Cria movimentação de saída em `estoque_movimentacoes` para abater o saldo automaticamente (via trigger já existente ou inserção manual).

## Mudanças na página /estoque/materiais

**Manter** o botão "Nova Placa" como o usuário pediu — serve para pré-cadastrar códigos em lote (um a um) que ficam com status `disponivel` mas **sem consumir saldo** (são só rótulos disponíveis para futura saída).

Esclarecer no dialog: "Esta placa fica disponível para ser usada em uma saída futura. O saldo do estoque é controlado separadamente em Saldos."

## Trigger de saldo

Adicionar trigger no `estoque_placas` que, ao mudar status:
- `disponivel` → `instalada`: insere movimentação de **saída** (-1) no material Placa, no local da placa.
- `instalada` → `disponivel` (retorno): insere movimentação de **entrada** (+1).
- `instalada` → `roubada`/`perdida`: insere movimentação de **saída** (-1) com motivo "Roubo"/"Perda".
- Criar placa nova direto como `instalada` (fluxo "criar novo código na saída"): insere saída (-1).
- Criar placa como `disponivel` (pré-cadastro em Materiais): **não mexe no saldo**.

## Arquivos a alterar

- **`.lovable/estoque_placas_saldo_trigger.sql`** (novo) — trigger de sincronização placa↔saldo + função de retorno ao estoque.
- **`src/pages/estoque/EstoquePlacas.tsx`** — adicionar botão "Nova saída para imóvel", ação "Retornar ao estoque" na aba Instaladas, ajustar dialog de instalar.
- **`src/components/estoque/placas/NovaSaidaDialog.tsx`** (novo) — fluxo unificado de saída (selecionar disponível OU criar novo código).
- **`src/components/estoque/placas/InstalarPlacaDialog.tsx`** (novo) — dialog simples por linha na aba Disponíveis.
- **`src/components/estoque/placas/RetornarPlacaDialog.tsx`** (novo) — retorno ao estoque.
- **`src/components/estoque/materiais/NovaPlacaDialog.tsx`** — adicionar texto explicativo de que não afeta saldo.
- **`src/hooks/useEstoquePlacas.ts`** — adicionar tipo "retorno" no histórico + mutations.

## Ação manual

Após aprovar, executar `.lovable/estoque_placas_saldo_trigger.sql` no SQL Editor do Supabase para criar o trigger de sincronização.