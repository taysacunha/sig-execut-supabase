## Diagnóstico

O bloco "Placas" tem dois níveis:

1. `estoque_saldos` — quantidade agregada por material/local (aparece no bloco azul "Saldos por material e local").
2. `estoque_placas` — cada placa física individualizada, com código próprio, status, imóvel, histórico (aparece no bloco verde "Placas disponíveis").

Hoje, quando você registra uma **entrada de saldo** na aba Saldos, só a linha em `estoque_saldos` é criada. **Nenhuma linha em `estoque_placas` é criada.** Por isso:

- A placa 1x1 aparece no bloco de cima (saldo agregado = 1), mas **não** aparece no bloco de baixo (nenhuma unidade física individualizada existe ainda).
- No dialog "Nova saída para imóvel", o modo **"Selecionar disponível"** exige uma placa `estoque_placas.status='disponivel'` com `codigo` preenchido — não há nenhuma.
- O modo **"Criar novo código"** hoje tenta **atualizar** uma placa `disponivel` sem código (`disponiveisSemCodigo`). Como o schema atual tem `codigo NOT NULL` e nenhuma placa é criada automaticamente na entrada, `disponiveisSemCodigo.length === 0` e o radio fica **desabilitado**. Resultado: os dois modos ficam bloqueados.

Ou seja, o fluxo está quebrado: entradas em Saldos nunca produzem placas individuais, e o dialog de saída depende de placas pré-existentes.

## O que corrigir (somente frontend)

Ajustar `src/components/estoque/placas/NovaSaidaDialog.tsx` para que **"Criar novo código" sempre crie uma nova linha em `estoque_placas`** consumindo 1 do `estoque_saldos`, sem precisar de uma placa "sem código" pré-existente.

### Mudanças no dialog

1. **Modo "Criar novo código"** (o principal fluxo para o caso da usuária):
   - Deixar sempre habilitado quando `saldoLocal > 0` (remover a dependência de `disponiveisSemCodigo.length > 0`).
   - Ao confirmar: `INSERT` em `estoque_placas` com:
     - `codigo` = novo código digitado
     - `material_id`, `local_armazenamento_id` = escolhidos
     - `tipo_uso`, `tamanho`, `tamanho_outro` = vindos de `resolvePlacaAttributes(material)`
     - `status = 'instalada'`, `imovel_codigo_atual`, `data_instalacao_atual`
   - Inserir 2 registros em `estoque_placas_historico`: `criacao` (data de hoje) e `instalacao` (data escolhida) — mantendo o padrão do histórico.
   - Decrementar `estoque_saldos` em 1 (delete se zerar, update caso contrário) — igual ao já implementado.
   - Registrar `estoque_movimentacoes` de saída.
   - Remover o `UPDATE` sobre `disponiveisSemCodigo[0]` (bloco morto no schema atual).

2. **Modo "Selecionar disponível"**:
   - Continuar exatamente como está — só habilitado quando há placas `status='disponivel'` com código; realiza `UPDATE` da placa para `instalada`, cria histórico `instalacao`, decrementa saldo, registra movimentação.

3. **Auto-switch entre os modos** (efeito `useEffect` atual): substituir por regra simples — default `existente` se `disponiveisComCodigo.length > 0`, senão `novo`. Sem mais forçar a troca conforme `disponiveisSemCodigo`.

4. **Validação `podeSalvar`**: `novo código` passa a exigir apenas `novoCodigo.trim()` não duplicado e `saldoLocal > 0` (não mais `disponiveisSemCodigo.length > 0`).

5. **Textos de ajuda**: ajustar a linha do radio "Criar novo código" para deixar claro que gera uma nova placa física a partir do saldo — sem contador `disponiveisSemCodigo`.

### Sobre "a placa 1x1 não aparece"

Depois desta correção, a placa continuará **não** aparecendo no bloco verde "Placas disponíveis" enquanto ninguém der um código a ela (isso é intencional: só existem linhas em `estoque_placas` para placas rastreadas individualmente). O bloco azul acima já mostra corretamente o saldo agregado — inclusive a mensagem "Há saldo agregado... mas ainda não há unidades físicas com código" já explica isso.

Assim que a usuária conseguir usar "Nova saída → Criar novo código", a nova placa passará a aparecer (como `instalada`), e o saldo cai para 0. Sem mudança visual necessária na página.

## Fora de escopo

- Nada de mudanças em migrations, RLS, RPC ou schema — só ajuste no dialog do frontend.
- Não mexer no `AtribuirCodigoDialog` (que serve para o caso de placas legadas sem código, se existirem).
- Não alterar textos/lógica do bloco de saldos agregados nem da tabela de placas individualizadas.

## Arquivos que serão alterados

- `src/components/estoque/placas/NovaSaidaDialog.tsx` — reescrever o ramo `modo === "novo"` da mutation para `INSERT`, ajustar `useEffect` de auto-switch, `podeSalvar`, e o `disabled` do radio/input.
