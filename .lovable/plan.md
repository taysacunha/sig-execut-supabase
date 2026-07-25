## Objetivo

Alertar (não bloquear) quando um imóvel for salvo com `codigo` ou `inscricao_municipal` já usado por outro imóvel. Se o usuário optar por prosseguir, exigir justificativa registrada em auditoria.

## Mudanças

### 1. Banco — `db/migrations/20260805120000_despesas_imoveis_dup_index.sql`

Índices não únicos para acelerar a busca por duplicatas (case-insensitive, ignorando inativos e nulos):

```sql
CREATE INDEX IF NOT EXISTS idx_desp_imoveis_codigo_lower
  ON public.despesas_imoveis (lower(codigo))
  WHERE codigo IS NOT NULL AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_desp_imoveis_insc_mun_lower
  ON public.despesas_imoveis (lower(inscricao_municipal))
  WHERE inscricao_municipal IS NOT NULL AND is_active = true;
```

Sem constraint única — duplicidade é apenas alerta.

### 2. Hook `src/hooks/useDespesasImoveis.ts`

Exportar helper `buscarImoveisDuplicados({ codigo, inscricaoMunicipal, excluirId? })` que retorna `{ id, codigo, descricao, inscricao_municipal, situacao, is_active, campo: "codigo" | "inscricao_municipal" }[]`. Faz um único `select` com `.or(...)` case-insensitive, exclui o próprio `id` na edição, inclui inativos marcando o status.

Adicionar parâmetro opcional `justificativa?: string` em `useSaveImovel` — quando presente, após salvar, gravar em `module_audit_logs` (via insert direto, mesmo padrão já usado em Férias/Despesas) com `action = "DUPLICIDADE_IMOVEL_CONFIRMADA"`, guardando `codigo`, `inscricao_municipal`, IDs duplicados e o motivo.

### 3. `src/components/despesas/ImovelDialog.tsx`

Ao clicar em **Salvar**, se `codigo` ou `inscricao_municipal` estiverem preenchidos, chamar `buscarImoveisDuplicados` (excluindo `editing?.id`). Se retornar itens:

- Abrir `AlertDialog` "Imóvel duplicado detectado" listando cada imóvel encontrado com: código, descrição, inscrição municipal, situação, status (Ativo/Inativo) e qual campo bateu.
- Campo `Textarea` obrigatório para justificativa (mín. 10 caracteres).
- Botões "Cancelar" e "Salvar mesmo assim" (habilitado só com justificativa válida).
- Ao confirmar, chamar `saveMut.mutateAsync({ id, input, justificativa })`.

Se não houver duplicatas, salvar direto (fluxo atual).

## Notas

- Mesma lógica adotada em Pessoas (CPF/CNPJ), agora com auditoria obrigatória via justificativa — Pessoas não exige justificativa hoje, mas o usuário pediu explicitamente para imóveis.
- Comparação case-insensitive porque códigos/inscrições podem ser digitados com variações.
- Não altera Veículos nem outros diálogos.

Quero que você trate também os imóveis sem o código ou a inscrição municipal, pois alguns que ainda estão em construção pode não ter e nesse caso, como tratar isso?