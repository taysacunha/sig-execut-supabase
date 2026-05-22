## Ajuste: Nome de usuário quebrando linha no sidebar

### Contexto
O componente `CurrentUserInfo.tsx` exibe o nome do usuário no rodapé das sidebars. Quando o nome é longo (ex: "Bruno" com sobrenome), a classe `truncate` corta o texto com reticências (`...`). O usuário quer que o nome caiba na largura do sidebar, quebrando para nova linha se necessário.

### Alteração
Arquivo: `src/components/CurrentUserInfo.tsx`

Remover `truncate` do `<div>` do nome e adicionar `break-words leading-tight` para permitir quebra de linha natural, mantendo o texto visível sem reticências.

```tsx
// Antes:
<div className="text-sm font-medium truncate" title={name}>
  {name}
</div>

// Depois:
<div className="text-sm font-medium break-words leading-tight" title={name}>
  {name}
</div>
```

O e-mail pode continuar com `truncate` para não poluir visualmente, pois o foco do usuário é no nome.

### Escopo
- Apenas o componente `CurrentUserInfo.tsx`. As sidebars já o importam corretamente.