# Repasses — exclusão e edição de itens/beneficiários

## Problema

No diálogo de Repasse, o botão de lixeira dispara a exclusão no banco, mas a linha continua na tela: a página guarda o repasse aberto em um estado local (`detalhe`) capturado no clique. A mutação invalida a lista, a lista é recarregada, mas o objeto passado ao diálogo continua sendo a cópia antiga — por isso "não exclui" aos olhos do usuário.

Além disso hoje não há confirmação antes de excluir, e não há como editar um item ou beneficiário já lançado (só adicionar e remover).

## O que será feito

1. **Diálogo sempre com dados atuais**: a página passará a guardar apenas o ID do repasse aberto e o diálogo lerá o registro atualizado da lista em cache. Assim, exclusões, edições e inclusões aparecem imediatamente.
2. **Confirmação ao excluir**: ao clicar na lixeira (item ou beneficiário) abre um AlertDialog "Excluir item?/Excluir beneficiário?" com resumo (descrição/pessoa e valor) e botões Cancelar / Excluir.
3. **Edição inline**: cada linha das abas Beneficiários e Itens ganha um botão de lápis que transforma a linha em campos editáveis (Itens: tipo, origem, descrição, valor; Beneficiários: pessoa, valor, observação) com Salvar/Cancelar, reaproveitando os hooks de salvar que já suportam update por `id`.
4. **Feedback**: toast de sucesso/erro em excluir e salvar, e botões desabilitados enquanto a mutação roda.
5. As regras atuais de permissão continuam: itens só editáveis com repasse "aberto"; beneficiários enquanto não estiver pago/cancelado.

## Detalhes técnicos

- `src/pages/despesas/DespesasRepasses.tsx`: trocar `detalhe: Repasse | null` por `detalheId: string | null`; derivar `repasses.find(r => r.id === detalheId)`.
- `src/components/despesas/RepasseDialog.tsx`: estados `confirmDelete` (`{tipo: 'item'|'benef', id, label}`) e `editando` (id + rascunho); AlertDialog único reutilizado; linhas em modo edição chamando `useSaveRepasseItem` / `useSaveRepasseBeneficiario` com `id`.
- Sem mudanças de banco: as políticas RLS de DELETE/UPDATE já existem para `despesas_repasse_itens` e `despesas_repasse_beneficiarios`.
