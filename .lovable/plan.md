## Fase 3 — Imóveis, Veículos e Repasses

Fase 3 fecha o núcleo operacional do módulo Despesas ligando o Calendário (Fase 2) a três domínios recorrentes: imóveis, veículos e repasses de aluguel. Nada muda em Cadastros/Permissões/Auditoria já entregues nas fases anteriores.

### 1) Imóveis (`/despesas/imoveis`)

**Objetivo:** cadastrar a carteira de imóveis e gerar automaticamente as contas recorrentes (IPTU, TCR, SPU, condomínio) no Calendário.

Nova migration `db/migrations/20260718120000_despesas_fase3_imoveis.sql`:
- `despesas_imoveis` — id, código, endereço completo, matrícula/inscrição, área, tipo (comercial/residencial/terreno), situação (`alugado | vago | vendido | proprio_uso`), proprietário (FK `despesas_pessoas`), inquilino atual (FK opcional), valor_aluguel, taxa_administracao (%), data_aquisicao, data_venda, observação, centro_custo_id (RLS por centro), created/updated.
- `despesas_imovel_encargos` — id, imovel_id, tipo (`iptu | tcr | spu | condominio | outro`), valor_anual, parcelas (int), vencimento_primeira_parcela, ativo. Serve de "template" para gerar os `despesas_lancamentos` automaticamente todo início de exercício.
- `despesas_imovel_situacao_historico` — id, imovel_id, situacao_anterior, situacao_nova, data, motivo, changed_by. Trigger `AFTER UPDATE OF situacao` grava a linha.
- Função `despesas_gerar_encargos_imovel(_ano int, _imovel_id uuid)` que cria os lançamentos "a_pagar" no calendário, com `descricao` = "IPTU 2026 — Imóvel X, parcela 3/10". Idempotente por (imovel_id, tipo, ano, parcela).
- GRANTs + RLS reaproveitando `despesas_pode_ver_aba('imoveis')` / `despesas_pode_editar_aba` + `centro_custo_id IN (SELECT despesas_centros_permitidos(auth.uid()))` (padrão da Fase 2).
- Auditoria: estender o CASE de `audit_module_changes` para incluir as três tabelas novas.

Frontend:
- `useDespesasImoveis.ts` — CRUD + geração de encargos.
- `ImovelDialog.tsx` — formulário com abas (Dados, Encargos, Histórico de situação).
- `DespesasImoveis.tsx` — KPIs (total, alugados, vagos, vendidos, receita mensal potencial), filtros (situação, tipo, centro, proprietário), tabela com ações (editar, gerar encargos do ano, ver histórico) e exportação CSV.

### 2) Veículos — completar aba em Cadastros

`despesas_veiculos` já existe (Fase 1). Fase 3 adiciona a operação recorrente:

Nova migration `db/migrations/20260718121000_despesas_fase3_veiculos.sql`:
- `despesas_veiculo_documentos` — id, veiculo_id, tipo (`ipva | licenciamento | seguro | multa | manutencao`), descricao, valor, vencimento, parcelas, ativo. Mesma lógica de template dos encargos de imóvel.
- `despesas_veiculo_baixa` — registra baixa por venda (data_venda, valor_venda, comprador, observação) e trava novos documentos após a baixa.
- Função `despesas_gerar_encargos_veiculo(_ano, _veiculo_id)` análoga à de imóvel.
- RLS/GRANTs no mesmo padrão + inclusão nas tabelas auditadas.

Frontend:
- Substituir o placeholder atual em `DespesasCadastros.tsx` (aba Veículos) por `VeiculoDialog.tsx` completo (dados + documentos + baixa) e uma tabela dedicada. Botão "Gerar encargos do ano" idêntico ao de imóveis.

### 3) Repasses (`/despesas/repasses`)

**Objetivo:** consolidar mensalmente o que a imobiliária deve repassar a cada proprietário.

Nova migration `db/migrations/20260718122000_despesas_fase3_repasses.sql`:
- `despesas_repasses` — id, proprietario_id (FK pessoas), competencia (date, dia 1), status (`aberto | fechado | pago | cancelado`), valor_bruto, taxa_administracao_valor, valor_liquido, observação, centro_custo_id, created/updated.
- `despesas_repasse_itens` — id, repasse_id, tipo (`credito | debito`), origem (`aluguel | reembolso | encargo | ajuste | outro`), imovel_id (opcional), lancamento_id (opcional — liga a conta do calendário), descrição, valor. Trigger recalcula bruto/taxa/líquido no pai a cada mudança.
- Função `despesas_montar_repasse(_proprietario_id, _competencia)` que, dado o mês, gera itens automáticos a partir dos aluguéis recebidos e encargos pagos vinculados aos imóveis do proprietário; retorna o `repasse_id`. Idempotente por (proprietario_id, competencia).
- Ao marcar `status='pago'`: gera um `despesas_lancamentos` do tipo `a_pagar` no calendário (pagamento ao proprietário), amarrado ao `repasse_id`.
- RLS/GRANTs no padrão + auditoria.

Frontend:
- `useDespesasRepasses.ts` — listar por competência, montar, editar itens, fechar, marcar pago.
- `RepasseDialog.tsx` — cabeçalho com totais + tabela de créditos e débitos editáveis; botão "Gerar automaticamente".
- `DespesasRepasses.tsx` — seletor de competência (mês/ano), KPIs (nº repasses, bruto, taxa, líquido, pendentes), tabela por proprietário e exportação CSV por CNPJ/CPF (uma linha por repasse com colunas de créditos, débitos, taxa e líquido).

### Ordem de execução

1. Migrations Fase 3 (imóveis → veículos → repasses) — você roda no SQL Editor.
2. Hooks e diálogos.
3. Páginas `DespesasImoveis` / `DespesasRepasses` + substituição da aba Veículos em `DespesasCadastros`.
4. Fumaça manual: cadastro de 1 imóvel, geração de encargos do ano, verificação no Calendário; cadastro de 1 veículo, geração de IPVA; montagem de um repasse do mês.

Fase 4 fica em aberto — depois de Fase 3 pronta você decide se ela vira Relatórios/BI (DRE, fluxo de caixa, dashboards) ou integrações (extratos bancários, OFX, boleto).
