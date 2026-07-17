## O que a planilha realmente é

Reli a aba única `IDEIA DE CAMPOS E NECESSIDADES` linha a linha. Sua leitura está certa: **não é uma planilha financeira de valores**, é um caderno de requisitos com blocos empilhados descrevendo o que o sistema precisa registrar e acompanhar. Os poucos números que aparecem (18000, TOTAL, #REF!) são exemplos ilustrativos, não colunas de valor a serem replicadas.

### Blocos identificados (várias "tabelas" em uma)

1. **Linhas 1–3 — Cabeçalho conceitual do Calendário**
  Campos-modelo do lançamento: Dia de Vencimento, Situação do imóvel/endereço, Parcelas/intercaladas/chaves, Empresa/Pessoa, Conta bancária, Cheque/Cartão, Texto na descrição, Serviço, Vínculo pessoa/empresa/imóvel, Imóvel nº, Centro de custo, Observação (telefone, login, senha, site com link).
2. **Linhas 6–19 — "OBSERVAÇÕES" (lista de requisitos numerados)**
  1. Relatório de imóveis alugados/vendidos, com ativar/desativar.
  2. Pagamento anual, avulso, mensal, por período.
  3. Relatório de vencimentos.
  4. Relatório de pagamentos pendentes.
  5. Perfil para alguém lançar/registrar (estados: pago, agendado, quitado, GIMOB).
  6. Despesas anuais por categoria (IPTU, TCR, SPU, IBGE, Certificado Digital, OAB, CRECI).
  7. Relatório de veículos com emplacamento/licenciamento, placa, propriedade/nota, motorista responsável, dar baixa quando vender, parcelas intercaladas de aquisição.
3. **Linhas 21–25 — Perfis de acesso por conta**
  Contas: Execut, Ocean, Gilvandro, "controle do emplacamento", etc., cada uma com lista de pessoas (Erika, Edneide, Rhanna, Fábia, Germana, Everaldo…). É pedido de **permissão granular por conta/centro de custo**.
4. **Linhas 26–35 — Relatório "IPTU/TCR/SPU – Contratos em vigor"**
  Colunas: Imóvel/Registro, Inscrição IPTU/RIP SPU, Endereço, QD/LT atual, Propriedade (nome), IPTU, TCR, Situação para pagamento (Vendendo/Vendido/Alugado, Aluguel por temporada, Para alugar, Total, Pago parcelado, Pago à vista).
5. **Linhas 40–46 — Relatório "Contratos alugados – IPTU/TCR/SPU"**
  Mesmas colunas + Garantia da locação (seguro, fiador) e "Pagamento via locatário ou proprietário".
6. **Linhas 47–50 — Relatório "Pagos por Gabi e Germaninha"**
  Colunas: Inscrição, Endereço, QD/LT, Propriedade, IPTU, TCR, Desconto IPTU, Desconto TCR, Situação (Pagos). É recorte por responsável.
7. **Linhas 58–67 — Modelo de Repasse mensal ao proprietário**
  Cabeçalho: Beneficiário/Proprietário, Mês. Colunas: Locatário (CNPJ/CPF), Registro/Imóvel, Endereço, Valor Aluguel + Multa/Juros, Outros Créditos (por categoria, ex. condomínio), Outros Débitos (proporcional IPTU, IRF…), Taxa adm, Valor repassado, Data do repasse, Valor limite para primeiro beneficiário. Aparece duas vezes (dois modelos de layout do repasse).

### Confirmando sua leitura

- **Campos de valor concentrados apenas em 2 lugares**: o lançamento em si (implícito no bloco 1) e os relatórios de IPTU/TCR/Repasse (blocos 4–7). O resto é **cadastro, permissão, situação e histórico** — exatamente como você percebeu.
- **O eixo real da planilha é**: quem lançou, o que foi lançado, para qual imóvel/centro de custo, qual a situação (pago/agendado/quitado/GIMOB), quem tem permissão para ver/editar e qual relatório extrair.

## Como isso já se encaixa no módulo hoje


| Bloco da planilha                                | Status no módulo Despesas                                                                                                                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Campos do lançamento                          | Coberto por `despesas_lancamentos` (descrição, vencimento, categoria, subcategoria, centro de custo, conta, pessoa, imóvel, veículo, observação).                                    |
| 2.1 Relatório imóveis alugados/vendidos + ativar | Coberto por `despesas_imoveis` + `despesas_imovel_situacao_historico`.                                                                                                               |
| 2.2 Anual/avulso/mensal/período                  | Coberto por `despesas_recorrencias` (frequência, ocorrências, série).                                                                                                                |
| 2.3–2.4 Relatório vencimentos/pendentes          | Coberto pela página Relatórios e KPIs criados na Fase 4/B.                                                                                                                           |
| 2.5 Estados (pago/agendado/quitado/GIMOB)        | Parcialmente — hoje temos `agendado`, `pago`, `vencido`. **Faltam `quitado` e `GIMOB**` como estados oficiais.                                                                       |
| 2.6 Despesas anuais por categoria                | Coberto por categorias/subcategorias + recorrência anual.                                                                                                                            |
| 2.7 Veículos + emplacamento + baixa              | Coberto por `despesas_veiculos` + `despesas_veiculo_documentos`.                                                                                                                     |
| 3. Perfis por conta/centro de custo              | Coberto por `despesas_aba_permissoes` e `despesas_centros_custo_permissoes`.                                                                                                         |
| 4–6. Relatórios IPTU/TCR/SPU                     | Parcialmente — a página de Relatórios agrega por categoria/centro, mas **não tem visão dedicada IPTU/TCR/SPU por imóvel** nem recorte "pagos por responsável" (Gabi/Germaninha).     |
| 7. Repasses ao proprietário                      | Coberto por `despesas_repasses` + `despesas_repasse_itens` (aluguel, créditos, débitos, taxa adm, valor repassado, data). **Falta o campo "valor limite ao primeiro beneficiário"**. |


## Lacunas reais (o que a planilha pede e ainda não existe)

1. **Estados `quitado` e `GIMOB**` no `status` do lançamento (hoje são só `pendente/agendado/pago/vencido`).
2. **Relatório dedicado "Encargos por imóvel" (IPTU / TCR / SPU)** com filtro por situação (vendendo/vendido/alugado/temporada/para alugar) e recorte "pago por responsável".
3. **Campo "Valor limite ao primeiro beneficiário"** no repasse (linha 60, coluna J da planilha).
4. **Campos livres de "credenciais/link" na observação** (telefone, login, senha, site com link) — hoje `observacao` é texto puro; a planilha sugere um bloco estruturado.
5. **Perfis nomeados por "conta" (Execut, Ocean, Gilvandro…)** — hoje as permissões são por usuário. A planilha sugere `despesas_perfis_acesso` já existentes, mas **sem UI para aplicar um perfil a vários usuários de uma vez**.

## Próximo passo proposto

Este plano é só de **revisão/mapeamento** — nada é alterado agora. Me confirme qual desses caminhos seguir:

- **A**: apenas registrar essas lacunas no `dev_tracker` e na página de Ajuda (documentação).
- **B**: implementar as 5 lacunas acima como Fase 5 (schema + UI).
- **C**: implementar só um subconjunto (ex.: 1 + 3, que são os menores e mais objetivos).

Me diga qual (A/B/C) para eu montar o plano de execução correspondente. Siga com o caminho B, que o que de fato está faltando e que consta na tabela. Não há mais nada para ajustar nesse sistema sobre o valores? Pois vejo que os valores estão bem presentes nele.