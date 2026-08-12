# Aplicar alterações às parcelas seguintes de uma recorrência

Ao editar um lançamento que pertence a uma série de recorrência, o sistema passa a perguntar se a mesma alteração deve ser aplicada às parcelas futuras da mesma série.

## Como funciona na tela

1. Você edita normalmente o lançamento (ex.: troca o centro de custo da TIM S/A de agosto) e clica em Salvar.
2. Se o lançamento pertence a uma série e algum campo "propagável" mudou, abre um diálogo:
   - Título: "Aplicar às próximas parcelas?"
   - Resumo do que mudou (ex.: "Centro de custo: Matriz -> Filial 2").
   - Texto: "Encontramos N parcelas futuras desta recorrência."
   - Lista com checkbox de cada parcela futura (vencimento, descrição, valor), com "Marcar todos" / "Desmarcar todos". Por padrão todas vêm marcadas.
   - Opção adicional: "Atualizar também o modelo da série", para que as próximas ocorrências geradas automaticamente já nasçam com o novo valor.
   - Botões: "Aplicar somente neste" e "Aplicar nos selecionados (N)".
3. Após aplicar, um toast informa quantas parcelas foram atualizadas.

## Regras

- Só entram na lista parcelas da mesma série com vencimento posterior ao lançamento editado.
- Ficam de fora (exibidas como não selecionáveis, com o motivo): parcelas pagas, pagas parcialmente, canceladas/estornadas ou quitadas.
- Campos propagáveis: centro de custo, categoria, plano de contas, conta bancária, pessoa/empresa, imóvel, tipo e números de referência, descrição, valor e observação.
- Campos nunca propagados: datas (competência e vencimento), status, pagamentos e credenciais.
- Se nada mudou em campos propagáveis, nenhum aviso aparece — salva direto.

## Detalhes técnicos

- `src/components/despesas/LancamentoDialog.tsx`: guardar um snapshot dos valores iniciais ao abrir em modo edição; no `salvar`, se `editing.serie_recorrencia_id` existir, calcular o diff dos campos propagáveis e, havendo diff, abrir o novo diálogo em vez de fechar direto.
- Novo componente `src/components/despesas/PropagarRecorrenciaDialog.tsx`: recebe `serieId`, `lancamentoId`, `dataVencimento` e o diff; lista as parcelas futuras com checkboxes (Checkbox do shadcn), contador e ações "Marcar/Desmarcar todos".
- Novos hooks em `src/hooks/useDespesasLancamentos.ts`:
  - `useParcelasFuturasSerie(serieId, dataVencimento)` — consulta `despesas_lancamentos` filtrando `serie_recorrencia_id` e `data_vencimento` maior que a do lançamento editado, ordenado por vencimento, trazendo `status` para bloquear as não elegíveis.
  - `usePropagarAlteracoes()` — `update` com `.in("id", idsSelecionados)` aplicando apenas os campos do diff; invalida `despesas-lancamentos` e `despesas-recorrencias`.
- Atualização opcional do modelo da série: reaproveitar `useSaveRecorrencia` (`src/hooks/useDespesasRecorrencias.ts`) aplicando o mesmo diff nos campos equivalentes da série.
- Nenhuma mudança de banco de dados é necessária.