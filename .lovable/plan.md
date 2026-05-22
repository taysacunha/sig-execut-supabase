## Diagnóstico

**Causa raiz do "local de armazenamento vazio"**: não é permissão sobre o material, é permissão sobre `ferias_unidades`.

Em `EstoqueSaldos.tsx`:

- `unidades` consulta `ferias_unidades`, cuja policy `ferias_unidades_select` exige `can_view_system(uid, 'ferias')`.
- Ruan só tem acesso a `estoque`, então `unidades = []`.
- A query `locais` está com `enabled: unidades.length > 0` → **nunca executa** → Select fica sem opções.
- Mesmo se executasse, o agrupamento `locaisByUnidade` no Select depende de `unidades` para resolver o nome da unidade.

Outras páginas de Estoque (Locais, Materiais, Solicitações, etc.) leem `ferias_unidades` e `ferias_setores` da mesma forma — todas quebram para quem só tem acesso a Estoque. É um problema sistêmico do módulo.

## Plano

### 1. Backend — liberar leitura de unidades/setores para quem tem acesso a Estoque

Nova migration adicionando policies SELECT permissivas:

```sql
CREATE POLICY "estoque_users_can_view_unidades"
ON public.ferias_unidades FOR SELECT TO authenticated
USING (public.can_view_system(auth.uid(), 'estoque'));

CREATE POLICY "estoque_users_can_view_setores"
ON public.ferias_setores FOR SELECT TO authenticated
USING (public.can_view_system(auth.uid(), 'estoque'));
```

Policies somam-se às existentes de ferias (OR lógico), então quem já tem ferias continua vendo normalmente.

### 2. Frontend — busca acento-insensível no Select de Material

Em `src/pages/estoque/EstoqueSaldos.tsx`, dialog **Entrada de Material**:

- Substituir o `<Select>` atual do campo Material por um padrão Popover + Command (combobox shadcn já usado em outros lugares do projeto), com:
  - Input de busca dentro do popover.
  - Filtro client-side via `normalizeText` de `src/lib/textUtils.ts` (já remove acentos e case).
  - Lista virtualizada/scrollável dos materiais filtrados.
  - Mantém o `value`/`onValueChange` ligados a `materialId`.
- Mesma mudança aplicada nos diálogos de Ajuste e Transferência? **Não** — esses já vêm pré-preenchidos da linha, não precisam.

### 3. Defesa em profundidade no frontend

Mesmo após a policy nova, remover a dependência implícita garante robustez:

- Manter `enabled: unidades.length > 0` na query `locais` **só** depois de verificar que unidades realmente carregaram para usuários estoque-only (com a policy nova, vai carregar).

## Detalhes técnicos

**Arquivos alterados**

- `db/migrations/<novo_timestamp>_estoque_can_view_ferias_estrutura.sql` — 2 policies SELECT adicionais.
- `src/pages/estoque/EstoqueSaldos.tsx` — combobox de busca no campo Material do dialog Entrada.

**Fora de escopo**

- Não mexer no fluxo de seleção/listagem dos demais diálogos.
- Não alterar policies de escrita.
- Não tocar em outras páginas de Estoque nesta rodada (mesmo problema potencial existe, mas o usuário pediu apenas o dialog Entrada). A migration já corrige globalmente a parte de leitura. Se existe um potencial problema para outras páginas e diálogs, porque não gerar um plano para corrigir logo isso?

## Como validar

1. Logar como Ruan (apenas estoque + edição) → abrir Saldos → +Entrada → o Select de Local de Armazenamento deve listar os locais agrupados por unidade.
2. No campo Material, digitar "resma" ou "rÉsma" → ambos filtram "Resma A4".
3. Logar como usuário com acesso a férias → nada muda.