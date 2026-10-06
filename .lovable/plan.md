# Página de Veículos: só datas, parcelas e baixa (sem valores)

## O que muda para o usuário

1. **Sem valores em Veículos** — saem os campos e colunas de valor (cadastro de documento, lista de encargos, calendário, gerar encargos, baixa) e os botões de olho dessa página. Fica o controle de: qual encargo, quantas parcelas, datas e baixa.
2. **Ativos x Vendidos** — abas "Ativos" e "Vendidos" (veículo com data de venda vai para Vendidos), com contador em cada uma.
3. **Parcelas para frente** — ex.: IPVA em 3x com início 01/11/2026 gera 01/11/2026, 01/12/2026 e 01/01/2027, atravessando o ano quando preciso.
4. **Gerar encargos sem pedir o ano** — o campo de ano preenchido com 2026 sai. Ao gerar, o sistema lê a data de cada documento e cria as parcelas nos meses e anos certos. A confirmação mostra a lista prévia: documento, parcela e data.
5. **Próximos ciclos sem duplicar** — se o ciclo de 2027 já foi gerado, gerar de novo não duplica: o sistema oferece o próximo ciclo (2028 em diante), sem repetir anos anteriores. Quando não há nada novo, a mensagem explica o motivo com clareza.
6. **Baixa funcionando** — corrijo o botão "Registrar pagamento", que ficava sempre desabilitado. Nos encargos de veículo, a baixa passa a ser por **data de pagamento + observação**, sem valor.
7. **Visão anual correta** — em "Ano inteiro" (ex.: 2027), passam a aparecer todos os lançamentos do ano, os mesmos vistos mês a mês.
8. **Excluir encargo lançado** — botão de excluir em cada parcela, com confirmação e justificativa obrigatória. Opções: "só esta parcela" ou "esta e as seguintes do mesmo documento". Parcelas já baixadas não podem ser excluídas: é preciso estornar antes. A exclusão fica registrada na auditoria.
9. **Calendário de Veículos** — no lugar das colunas de valor entram **Vencimento**, Parcela (ex.: 2/3) e Status.
10. **Filtros na aba Ocorrências/Encargos** — busca por veículo ou placa, e filtros por tipo de encargo, status (a vencer, vencido, pago), período de vencimento e Ativos/Vendidos.
11. **Botão "Ver dados" do veículo** — abre uma ficha só para leitura: modelo, placa, motorista, proprietário, centro de custo, aquisição/venda e a lista de documentos (tipo, parcelas, 1º vencimento, ativo), com as próximas datas geradas.

## Lacunas encontradas e incluídas
- Na baixa, o valor total vazio deixava o cálculo inválido. Essa é a causa do botão desabilitado.
- O calendário anual não traz todos os lançamentos. Vou confirmar a causa com os dados reais do FIAT 500 (limite da consulta ou filtro por competência em vez de vencimento) e corrigir.
- Veículo vendido: os encargos com vencimento depois da venda deixam de ser gerados.
- O cálculo dos meses para os dias 29, 30 e 31 usa o último dia do mês quando ele não existe.

## Detalhes técnicos
- Nova RPC `despesas_gerar_encargos_veiculo_ciclo(_veiculo_id)` (SECURITY INVOKER): para cada documento ativo, encontra o próximo ciclo ainda não gerado (o último `ano_ref` gerado + 1, a partir do 1º vencimento) e cria N parcelas com `vencimento + (i) meses`, `valor_total NULL` e `veiculo_id`. Ela também guarda `documento_id`, `parcela` e `ciclo` para evitar duplicação e permitir a exclusão em cascata. Retorna a lista criada ou o motivo de não criar nada. Adiciono as colunas `veiculo_documento_id`, `ciclo` e `parcela_num` em `despesas_lancamentos`, com índice único (documento, ciclo, parcela).
- RPC `despesas_excluir_encargo_veiculo(_id, _modo, _justificativa)`: ela bloqueia parcelas com pagamento e registra o evento em `module_audit_logs`. A permissão segue `despesas_pode_excluir_aba('veiculos')`.
- `PagamentoDialog`: modo "sem valor", com baixa marcando o status como pago pela data. A regra `podeSalvar` passa a tratar `valor_total` nulo.
- `VeiculosCalendario`: no modo anual, filtro por `data_vencimento` e sem paginação limitada. Removo totais e valores e adiciono os filtros e a ação de exclusão.
- `VeiculoDialog`, `DespesasVeiculos`, `VeiculosRecorrencias`: removo valor, olho e campo de ano. Adiciono abas Ativos/Vendidos e o diálogo "Ver dados".
- Registro no `dev_tracker_log` e em `roadmap.md`.
