# Gerar encargos de veículos — por que retorna "0 lançamento gerado"

## Como funciona hoje
O botão chama a função do banco `despesas_gerar_encargos_veiculo(veiculo, ano)`. Ela:

1. Lê o **centro de custo** do veículo (se estiver vazio, dá erro).
2. Percorre os **documentos do veículo** (aba "Documentos" dentro do diálogo do veículo: IPVA, licenciamento, seguro, multa, manutenção) que estejam **ativos**.
3. Para cada documento, cria um lançamento "a pagar" por parcela, usando o dia/mês do "1ª parcela vence em" com o **ano escolhido**.
4. Se já existir um lançamento com a mesma descrição (ex.: `IPVA 2026 — Modelo (PLACA), parcela 1/3`), ele **pula** — para não duplicar.

Ou seja, o retorno é a **contagem de lançamentos novos**. "0" significa uma destas situações:

- O veículo **não tem nenhum documento cadastrado** (caso mais provável) — é preciso abrir o veículo → aba **Documentos** → "Novo documento".
- Todos os documentos estão com **Ativo = Não**.
- Os encargos daquele ano **já foram gerados** antes (nada novo a criar).

Não há outro lugar de cadastro: os encargos vêm exclusivamente dos documentos do veículo.

## O que proponho corrigir/melhorar (só interface)
1. **Mensagem clara em vez de "0 lançamento(s) gerado(s)"**, distinguindo os casos:
   - sem documentos ativos → "Este veículo não possui documentos ativos. Cadastre IPVA, seguro etc. na aba Documentos."
   - já existentes → "Nenhum lançamento novo: os encargos de {ano} já foram gerados."
2. **Diálogo de confirmação mais informativo**: antes de gerar, mostrar a lista de documentos ativos que serão usados (tipo, valor, parcelas, 1º vencimento) e o total estimado; se não houver nenhum, o botão "Gerar" fica desabilitado com um atalho para abrir a aba Documentos.
3. **Coluna/indicador na tabela de veículos** com a quantidade de documentos ativos, para ver de relance quais veículos ainda não têm encargos cadastrados.
4. **Aviso quando o veículo estiver sem centro de custo** (hoje isso gera um erro cru do Postgres): desabilitar o botão e explicar que o centro de custo é obrigatório para gerar encargos.

## Detalhes técnicos
- `src/pages/despesas/DespesasCadastros.tsx` (`VeiculosTab`): mensagens do toast, diálogo de confirmação enriquecido, coluna de documentos, botão desabilitado sem centro de custo.
- `src/hooks/useDespesasVeiculos.ts`: hook para contar/listar documentos ativos por veículo (consulta única em `despesas_veiculo_documentos`), usado na tabela e no diálogo.
- Nenhuma mudança de banco de dados é necessária.
