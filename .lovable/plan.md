## Objetivo

Padronizar todos os campos de senha do sistema para exibir um botão de "olho" (ícone) à direita do input, que alterna entre mostrar e ocultar a senha digitada.

## Campos identificados (atualmente sem o toggle)

| Arquivo | Linha | Contexto |
|---|---|---|
| `src/pages/Auth.tsx` | 635 | Campo "Senha" do formulário de login |
| `src/pages/Profile.tsx` | 247 | "Senha Atual" (alterar senha) |
| `src/pages/Profile.tsx` | 259 | "Nova Senha" (alterar senha) |
| `src/pages/Profile.tsx` | 402 | "Confirmar Senha" (excluir conta) |
| `src/pages/UserManagement.tsx` | 845 | "Senha" (cadastro de usuário) |
| `src/pages/UserManagement.tsx` | 855 | "Confirmar Senha" (cadastro de usuário) |

Já possuem o toggle e servirão de referência visual: `src/pages/Auth.tsx` linhas 482 e 543 (form de definir/redefinir senha).

## Abordagem

Criar um componente reutilizável `src/components/ui/password-input.tsx` baseado no `Input` do shadcn, com:

- Mesmas props do `<Input>` nativo (forwardRef, className, etc.).
- Estado interno `show` (boolean).
- Botão `type="button"` posicionado absolutamente à direita (padrão `pr-10`), com ícones `Eye` / `EyeOff` do `lucide-react`.
- `aria-label` dinâmico: "Mostrar senha" / "Ocultar senha".
- `tabIndex={-1}` no botão para não atrapalhar a navegação por teclado entre campos.
- Mantém `type` alternando entre `"password"` e `"text"`.

Em seguida, substituir nos 6 pontos acima `<Input type="password" ... />` por `<PasswordInput ... />`, preservando todas as outras props (id, value, onChange, required, autoComplete, etc.).

## Detalhes técnicos

- O componente segue o mesmo padrão dos campos já existentes em `Auth.tsx` (wrapper `relative`, botão absoluto à direita).
- Sem alterações de lógica de negócio, validação ou estilo geral — apenas adição do toggle visual.
- Sem novas dependências (lucide-react já está no projeto).
- Sem mudanças no Supabase, em hooks ou em RLS.

## Fora de escopo

- Campos de senha em diálogos ainda não criados.
- Alterações nos formulários já com toggle (Auth — definir/redefinir senha).
- Regras de força de senha, validação ou autenticação.
