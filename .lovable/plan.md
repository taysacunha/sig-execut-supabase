## Corrigir 3 problemas do fluxo de placas

### Problema 1 — Botão "Editar" abre o diálogo errado
Ao clicar no lápis de um material do tipo placa em **Materiais**, abre o formulário genérico "Editar Material", que não tem os campos `tipo_uso`/`tamanho`/`tamanho_outro`. Isso obriga a desativar e recriar, e é a causa raiz de placas legadas ficarem com metadados errados.

**Correção**
- `src/components/estoque/materiais/NovaPlacaDialog.tsx`: nova prop opcional `editingMaterial?: { id, nome, tipo_uso, tamanho, tamanho_outro, descricao, estoque_minimo, categoria_id }`.
  - Quando presente: pré-preencher todos os campos; título "Editar Placa"; botão "Salvar alterações"; mostrar o nome atual em destaque com aviso "O nome do material é preservado".
  - `mutationFn`: UPDATE por `id`, gravando `tipo_uso`, `tamanho`, `tamanho_outro`, `descricao`, `estoque_minimo`, `categoria_id`, `categoria`, `is_placa=true`. Pular a checagem `ilike nome`. Não alterar `nome`.
- `src/pages/estoque/EstoqueMateriais.tsx`:
  - Estender a interface `Material` com `is_placa`, `tipo_uso`, `tamanho`, `tamanho_outro`.
  - Novo estado `editingPlaca: Material | null`.
  - No handler do lápis: se `material.is_placa === true` OU `nome.toLowerCase().startsWith("placa")`, setar `editingPlaca` e abrir `NovaPlacaDialog`; caso contrário, comportamento atual.
  - Passar `editingMaterial={editingPlaca}` ao `<NovaPlacaDialog />` e limpar no `onOpenChange(false)`.

### Problema 2 — Observação (ex: "Lona") não aparece no nome nem em lugar nenhum útil
Hoje `buildNomePlaca` gera nomes rígidos ("Placa Aluga 2x2"), sem espaço para variantes de material (Lona, PVC, etc.). A observação/descrição fica escondida em um campo que só aparece dentro do próprio diálogo.

**Correção**
- Adicionar um novo campo **"Variante / material da placa (opcional)"** no `NovaPlacaDialog` (ex.: "Lona", "PVC", "MDF") — texto livre, máx. 30 caracteres.
- `buildNomePlaca(tipoUso, tamanho, tamanhoOutro, variante)`: quando `variante` estiver preenchida, gera `Placa Aluga 2x2 Lona`; sem variante, mantém `Placa Aluga 2x2`.
- Preview do nome no cabeçalho do diálogo já reflete o resultado.
- No modo edição: exibir a variante extraída do nome atual (heurística: tudo após o padrão base), e permitir alterar — mas se o nome for alterado, revalidar unicidade `ilike nome`.
- O campo "Descrição/observações" fica como está, para textos maiores.

### Problema 3 — Placa criada agora não aparece no filtro "Aluga" da aba Placas
Diagnóstico: `EstoqueSaldos.invalidate()` só invalida `["estoque-saldos"]`, mas `EstoquePlacas` consulta pela chave separada `["estoque-saldos-placas"]`. Após dar entrada, a página de Placas continua com cache antigo. Recarregar a página faz aparecer — mas isso é péssima UX.

**Correção**
- `src/pages/estoque/EstoqueSaldos.tsx`, função `invalidate`: passar a invalidar também `["estoque-saldos-placas"]` e `["estoque-materiais-placa"]` (usadas por `EstoquePlacas`).

```ts
const invalidate = () => {
  queryClient.invalidateQueries({ queryKey: ["estoque-saldos"] });
  queryClient.invalidateQueries({ queryKey: ["estoque-saldos-placas"] });
  queryClient.invalidateQueries({ queryKey: ["estoque-materiais-placa"] });
};
```

### Fora de escopo
- Renomear placas legadas automaticamente.
- Nova migração de banco (schema já suporta tudo).
- Alterações em PDFs ou aba Saldos.

### Como testar após o build
1. Materiais → lápis em "Placa Aluga 2x2 Lona" → abre "Editar Placa" com os campos pré-preenchidos.
2. Nova Placa → tipo Aluga, tamanho 2x2, variante "Lona" → nome preview vira "Placa Aluga 2x2 Lona".
3. Saldos → dar entrada nessa placa → ir para Placas → filtro Tipo = Aluga → o card aparece sem precisar recarregar.
