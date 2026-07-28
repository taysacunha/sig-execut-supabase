## Problema

A rota `/dev/deploy-guide` está envolvida por `ProtectedRoute` em `src/App.tsx` (linha 245), o que força login antes de renderizar a página. A página `DeployGuide.tsx` em si não tem nenhuma verificação de autenticação própria.

## Correção

Em `src/App.tsx`, remover o `ProtectedRoute` da rota `/dev/deploy-guide`, mantendo apenas o `Suspense`:

```tsx
<Route path="/dev/deploy-guide" element={<Suspense fallback={<DashboardSkeleton />}><DeployGuide /></Suspense>} />
```

A rota `/dev` (DevTracker) continua protegida.

## Observação

A página é um guia técnico de infraestrutura (portas, variáveis, comandos de deploy). Deixá-la pública torna esse conteúdo acessível a qualquer pessoa com o link. Não há segredos reais no conteúdo (as chaves são placeholders), então tecnicamente é seguro — mas vale saber. Faço como pedido.
