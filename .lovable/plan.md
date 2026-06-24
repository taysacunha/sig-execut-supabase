## Objetivo

Impedir que o usuário cadastre/edite um material como "Placa" pelo dialog **Novo Material** em `/estoque/materiais`. O fluxo correto é usar o botão **Nova Placa**, que aciona `NovaPlacaDialog` e gerencia o material `is_placa` e o pré-cadastro do código.

## Como detectar "tentativa de placa"

No dialog de Novo Material, considerar tentativa de cadastrar placa quando, no campo **Nome**, o texto (após `trim().toLowerCase()`) começar com `placa` (mesma heurística já usada em `NovaPlacaDialog` no fallback de `is_placa`).

## Mudanças (somente em `src/pages/estoque/EstoqueMateriais.tsx`)

1. Criar um derivado:
   ```ts
   const isPlacaNome = form.nome.trim().toLowerCase().startsWith("placa");
   ```
2. Mostrar um alerta inline logo abaixo do campo **Nome** quando `isPlacaNome` for `true`:
   - Texto: *"Materiais do tipo Placa devem ser cadastrados pelo botão **Nova Placa**. Este formulário não aceita placas."*
   - Incluir um botão/link "Abrir Nova Placa" que fecha o dialog atual (`closeDialog()`) e abre `setNovaPlacaOpen(true)`.
   - Usar o componente `Alert` (variant destructive) já presente no design system, sem cores hardcoded.
3. Desabilitar o botão **Salvar/Cadastrar** do `DialogFooter` quando `isPlacaNome` for `true` (somando à condição atual de `disabled`).
4. Defesa em profundidade no handler de submit (`handleSubmit`/mutation): se `isPlacaNome` for `true`, exibir `toast.error(...)` com a mesma mensagem e abortar antes de chamar o Supabase. Isso protege contra edição (`editingMaterial`) e contra qualquer caminho que não passe pelo botão.
5. Não alterar `NovaPlacaDialog`, schema, RLS, nem lógica de saldos/movimentações.

## Fora de escopo

- Bloqueio no banco (trigger/policy) — apenas UI/UX por enquanto.
- Renomear placas já cadastradas erroneamente.
