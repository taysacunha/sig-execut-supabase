## Diagnóstico

A `Placa Venda 1x1` ainda não aparece na div verde de **Placas disponíveis** porque essa lista não lê o saldo agregado.

Hoje a página usa duas fontes diferentes:

```text
Bloco azul "Saldos por material e local"
→ lê estoque_saldos
→ por isso mostra Placa Venda 1x1 (1)

Bloco verde "Placas disponíveis"
→ lê estoque_placas com status = 'disponivel'
→ só mostra unidades físicas individualizadas
→ se não existe linha em estoque_placas, a tabela fica vazia
```

O ajuste anterior resolveu o botão **Criar novo código** na saída: ele cria uma nova linha em `estoque_placas`, mas já com `status = 'instalada'`, porque é uma saída direta para imóvel. Por isso essa placa criada aparece em **Instaladas**, não em **Disponíveis**.

## Plano de correção

1. **Atualizar a div de Placas disponíveis** em `/estoque/placas` para também representar saldos agregados ainda não individualizados.
   - Quando houver saldo em `estoque_saldos`, mas não houver placas físicas disponíveis em `estoque_placas`, mostrar uma linha do tipo `sem código / saldo agregado`.
   - A linha deve exibir material, tipo, tamanho, local e quantidade disponível.

2. **Separar visualmente os dois tipos de disponibilidade**:
   - Placas físicas com código: continuam aparecendo como unidades individuais.
   - Saldo disponível sem placa individualizada: aparece como disponibilidade para criar código/saída.

3. **Ajustar a mensagem vazia** para não dizer que não há placa disponível quando existe saldo.
   - Trocar por uma mensagem clara: existe saldo, mas ainda não há placa física individualizada com código.

4. **Adicionar ação contextual no saldo sem código**:
   - Botão para abrir **Nova saída para imóvel** já orientando o usuário a usar **Criar novo código**.
   - Sem alterar regras de banco neste primeiro ajuste.

5. **Manter a regra atual de saída**:
   - `Criar novo código` continua consumindo 1 unidade de `estoque_saldos`.
   - A placa criada na saída continua nascendo como `instalada`, pois ela já foi vinculada ao imóvel.

## Resultado esperado

A `Placa Venda 1x1 (1)` vai deixar de parecer “sumida”: ela será visível dentro da área de disponíveis como saldo disponível ainda não individualizado, mesmo sem existir uma linha física em `estoque_placas`.