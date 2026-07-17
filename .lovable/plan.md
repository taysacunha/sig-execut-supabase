## Diagnóstico

Auditei o que já existe:

**Tabelas com trigger de auditoria plugado hoje** (via `audit_module_changes`):
- `despesas_lancamentos`
- `despesas_imoveis`, `despesas_imovel_encargos`
- `despesas_veiculo_documentos`
- `despesas_repasses`, `despesas_repasse_itens`
- `despesas_recorrencias`, `despesas_notificacoes_preferencias`

**Tabelas SEM auditoria** (alterações ali passam invisíveis):
- Cadastros base: `despesas_categorias`, `despesas_subcategorias`, `despesas_planos_conta`, `despesas_centros_custo`, `despesas_contas_bancarias`, `despesas_pessoas`, `despesas_veiculos`
- Permissões: `despesas_aba_permissoes`, `despesas_centros_custo_permissoes`, `despesas_perfis_acesso`

**Rótulos na UI**: nenhum campo específico de Despesas (centro_custo_id, plano_conta_id, valor_total, data_vencimento, etc.) está no dicionário `fieldLabels` de `AuditLogsPanel.tsx`, nem no `tableLabels`, nem no `resolve` de FK. Resultado: o log até é gravado, mas na tela aparece como `centro_custo_id: 3f4a…` em vez de "Centro de custo: Sede".

## Objetivo

Fechar as duas lacunas: **cobrir 100% das tabelas de Despesas com auditoria** e **traduzir os rótulos, valores e FKs** para leitura humana.

## Escopo

### Parte 1 — Nova migration `db/migrations/20260722120000_despesas_audit_gaps.sql`

Adiciona o trigger `trg_<tabela>_audit` (AFTER INSERT OR UPDATE OR DELETE → `audit_module_changes`) nestas tabelas, via loop `DO $$`:

- `despesas_categorias`, `despesas_subcategorias`, `despesas_planos_conta`
- `despesas_centros_custo`, `despesas_contas_bancarias`
- `despesas_pessoas`, `despesas_veiculos`
- `despesas_aba_permissoes`, `despesas_centros_custo_permissoes`, `despesas_perfis_acesso`

Cada bloco faz `DROP TRIGGER IF EXISTS` antes do `CREATE TRIGGER` (idempotente). Sem grants nem RLS novos: as tabelas alvo já existem e a função `audit_module_changes` já está em `public`.

**Fora de escopo** (intencionalmente): `despesas_lancamento_pagamentos` (auditado no lançamento pai, para não dobrar), `despesas_notificacoes` e `despesas_lancamentos` de série gerada automaticamente pelo scheduler — o log já cobre a recorrência que os originou.

### Parte 2 — Atualizar `src/components/AuditLogsPanel.tsx`

Um único patch acrescentando entradas nos dicionários já existentes:

**`tableLabels`** — nomes amigáveis:
```
despesas_lancamentos → "Lançamentos"
despesas_lancamento_pagamentos → "Pagamentos"
despesas_recorrencias → "Recorrências"
despesas_imoveis → "Imóveis"
despesas_imovel_encargos → "Encargos de Imóvel"
despesas_veiculos → "Veículos"
despesas_veiculo_documentos → "Documentos de Veículo"
despesas_repasses → "Repasses"
despesas_repasse_itens → "Itens de Repasse"
despesas_categorias → "Categorias"
despesas_subcategorias → "Subcategorias"
despesas_planos_conta → "Planos de Conta"
despesas_centros_custo → "Centros de Custo"
despesas_contas_bancarias → "Contas Bancárias"
despesas_pessoas → "Pessoas"
despesas_aba_permissoes → "Permissões por Aba"
despesas_centros_custo_permissoes → "Permissões de Centro"
despesas_perfis_acesso → "Perfis de Acesso (Despesas)"
```
Adicionar `despesas → "Despesas"` em `moduleLabels`.

**`fieldLabels`** — campos específicos:
```
tipo → "Tipo"                         nivel → "Nível"
descricao → "Descrição"                aba → "Aba"
valor_total → "Valor total"            recorrencia_id → "Recorrência"
valor_pago → "Valor pago"              serie_id → "Série"
valor_previsto → "Valor previsto"      periodicidade → "Periodicidade"
data_competencia → "Competência"       data_inicio → "Início"
data_vencimento → "Vencimento"         data_fim → "Fim"
data_pagamento → "Pagamento"           horizonte_meses → "Horizonte (meses)"
forma_pagamento → "Forma de pagamento" iptu → "IPTU"
numero_documento → "Nº documento"      tcr → "TCR"
observacao → "Observação"              spu → "SPU"
codigo → "Código"                      parcelas → "Parcelas"
banco → "Banco"                        proprietario_id → "Proprietário"
agencia → "Agência"                    locatario_id → "Locatário"
conta → "Conta"                        motorista_id → "Motorista"
centro_custo_id → "Centro de custo"    situacao → "Situação"
plano_conta_id → "Plano de conta"      endereco → "Endereço"
subcategoria_id → "Subcategoria"       modelo → "Modelo"
categoria_id → "Categoria"             placa → "Placa"
conta_bancaria_id → "Conta bancária"   renavam → "Renavam"
pessoa_id → "Pessoa"                   chassi → "Chassi"
imovel_id → "Imóvel"                   ano → "Ano"
veiculo_id → "Veículo"                 valor_anual → "Valor anual"
repasse_id → "Repasse"                 vencimento_primeira_parcela → "1ª parcela"
```

**`valueLabels`** — enums de Despesas:
```
tipo: { a_pagar: "A pagar", a_receber: "A receber" }
status: { a_vencer: "A vencer", vencido: "Vencido", pago: "Pago", parcial: "Parcialmente pago", cancelado: "Cancelado" }
forma_pagamento: { pix: "PIX", boleto: "Boleto", dinheiro: "Dinheiro", cartao: "Cartão", transferencia: "Transferência", cheque: "Cheque" }
situacao: { alugado: "Alugado", vago: "Vago", proprio: "Próprio", obra: "Em obra", vendido: "Vendido" }
periodicidade: { mensal: "Mensal", anual: "Anual", meses_fixos: "Meses fixos", intercalada: "Intercalada" }
nivel: { sem_acesso: "Sem acesso", view: "Visualizar", edit: "Editar", delete: "Excluir" }
aba: { calendario: "Calendário", recorrencias: "Recorrências", imoveis: "Imóveis", repasses: "Repasses", veiculos: "Veículos", cadastros: "Cadastros", relatorios: "Relatórios", permissoes: "Permissões", auditoria: "Auditoria" }
```

**`useLookups` — FKs a resolver** (adicionar no mapa `tableByField` e no pré-carregamento):
- `centro_custo_id → despesas_centros_custo.nome`
- `plano_conta_id → despesas_planos_conta.nome`
- `categoria_id → despesas_categorias.nome`
- `subcategoria_id → despesas_subcategorias.nome`
- `conta_bancaria_id → despesas_contas_bancarias.nome`
- `pessoa_id / proprietario_id / locatario_id / motorista_id → despesas_pessoas.nome`
- `imovel_id → despesas_imoveis.descricao`
- `veiculo_id → despesas_veiculos.modelo`
- `recorrencia_id → despesas_recorrencias.descricao`

**`INSERT_SUMMARY_FIELDS`** — adicionar `valor_total`, `data_vencimento`, `codigo` para gerar resumos úteis em cadastros de Despesas (ex: "Cadastrou — Descrição: Aluguel; Valor total: 3.500; Vencimento: 05/08/2026").

### Parte 3 — Sem mudanças em outros arquivos

Nem `DespesasAuditLogs.tsx` nem `DespesasHelp.tsx` precisam mudar — o `AuditLogsPanel` reaproveita tudo pelos dicionários.

## Verificação

- Após executar a migration, cadastrar/editar um item em cada tela (categoria, plano, centro, conta, pessoa, veículo, permissão) e conferir se aparece linha nova em `/despesas/auditoria` com rótulos legíveis.
- `tsgo` roda automaticamente para garantir que os patches em `AuditLogsPanel.tsx` compilam.

## O que você faz depois de eu implementar

Executar `db/migrations/20260722120000_despesas_audit_gaps.sql` no SQL Editor do Supabase.
