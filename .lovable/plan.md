## 1) Erro "Edge Function returned a non-2xx status code" ao adicionar usuário

### Diagnóstico

A função `invite-user` (linha 85 de `supabase/functions/invite-user/index.ts`) só permite que `super_admin` ou `admin` criem usuários — qualquer outra role recebe **403**:

```ts
if (roleError || !callerRole || !["super_admin", "admin"].includes(callerRole)) {
  return ... status: 403, body: { error: "Apenas Super Administradores e Administradores podem adicionar usuários" }
}
```

A função em si está respondendo certo. O problema é que, no frontend, `supabase.functions.invoke()` (UserManagement.tsx linhas 306/338) **engole o corpo da resposta** quando o status não é 2xx e exibe apenas a mensagem genérica "Edge Function returned a non-2xx status code". Por isso a Edneide vê esse texto em vez do motivo real.

Os metadados dela mostram `role: "collaborator"` no convite original, mas a role efetiva é a que está em `public.user_roles`. Hipóteses prováveis, em ordem:

- **(A) Edneide é `collaborator` (ou `manager`/`supervisor`)** em `user_roles` → o backend está rejeitando corretamente, mas a UI não deveria nem mostrar o botão "Adicionar usuário" para ela. Hoje o gate da UI está fraco.
- **(B) Edneide é `admin`/`super_admin**` e algum outro erro está acontecendo (rate limit, email duplicado, falha na inserção em `user_roles`). Só conseguimos confirmar olhando o log da função no momento da tentativa.

### Correções a implementar

1. **Surfacing do erro real no frontend** (`src/pages/UserManagement.tsx`, ambas as chamadas a `invite-user`):
  - Trocar o tratamento atual por: ler `data?.error` primeiro; se vier algo, exibir no toast. Como `functions.invoke` perde o body em status != 2xx, usar `fetch` direto contra a URL da função (mantendo `Authorization` e `apikey`) para preservar o JSON de erro, OU encapsular numa função utilitária que faça o `fetch` manual.
  - Resultado: ao invés de "non-2xx status code", a Edneide veria, p.ex., "Apenas Super Administradores e Administradores podem adicionar usuários".
2. **Reforçar o gate de UI** em `UserManagement.tsx`: o botão "Adicionar usuário" (e o formulário) só deve ser renderizado se `useUserRole()` retornar `super_admin` ou `admin`. Hoje o controle existe parcialmente; confirmar e fechar.
3. **Pedir ao usuário** o print do log no painel de Edge Functions (link no final) referente à tentativa da Edneide, para confirmar se foi 403 (permissão), 429 (rate limit), ou 500 (outro bug). Isso decide se basta (1)+(2) ou se há um terceiro ajuste.

Nenhuma migração de banco é necessária. Nenhuma mudança na lógica da própria edge function — ela está se comportando como esperado.

## 2) Botão "Exportar PDF" na Tabela de Férias

Hoje a aba **"Tabela do Contador"** já tem o botão `Exportar PDF` (linha 1031 de `src/pages/ferias/FeriasFerias.tsx`) que chama `generateContadorPDF`. A aba **"Tabela de Férias"** (linhas 729+) não tem botão equivalente.

### O que será feito

Em `src/pages/ferias/FeriasFerias.tsx`, somente na aba `value="ferias"`:

1. Criar `generateFeriasPDF` (useCallback) seguindo exatamente o padrão de `generateContadorPDF`:
  - jsPDF em landscape A4.
  - Título: `TABELA DE FÉRIAS — {anoFilter}`.
  - Subtítulo: filtros ativos (Busca / Status / Setor).
  - Colunas: **Colaborador · Setor · Períodos · Venda · Status · Origem · Exceção** (mesmas colunas da tabela na tela, sem a coluna "Ações").
  - Coluna "Períodos": prioriza `gozo_periodos`; se não houver, usa `gozo_*` quando `gozo_diferente`; senão usa `quinzena1_*`/`quinzena2_*`. Indica "2º pendente" quando aplicável.
  - Coluna "Venda": "{dias} dias" ou "—".
  - Coluna "Status": label de `statusLabels`.
  - Coluna "Origem": "Gerada" se `formulario_anual`, senão "Manual".
  - Coluna "Exceção": "Sim ({motivo})" ou "Não"; sinaliza "Conflito afast." quando estiver em `feriasAfastamentoConflicts`.
  - Linhas zebradas e quebra de página automáticas, como no PDF do contador.
  - Rodapé com data de geração e total de registros.
  - Usa `filteredFerias` (não apenas a página atual) para exportar tudo que está filtrado.
  - `pdf.save('ferias-${anoFilter}.pdf')` e `toast.success(...)`.
2. Adicionar o botão na barra de ações da aba (logo acima dos filtros, junto de "Gerar Férias" / "Cadastro Manual" / "Novo Formulário"):

```tsx
<Button variant="outline" className="gap-2" onClick={() => generateFeriasPDF()}>
  <Printer className="h-4 w-4" /> Exportar PDF
</Button>
```

- Mostrar para qualquer usuário com acesso à página (igual ao da aba do contador), não restrito a `canEditFerias`.
- Desabilitar quando `filteredFerias.length === 0`.

### Fora de escopo

- Nenhuma mudança em dados, RLS, geração de férias, lógica de venda, exibição da tabela na tela, ou no PDF do contador.
- Nenhuma alteração nas outras abas (Períodos Aquisitivos / Contador).

Só dexando claro que Edneide, hoje, está com o perfil Administrador.

Logs do invite-user
&nbsp;