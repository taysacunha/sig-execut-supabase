## Diagnóstico

A tabela `module_audit_logs` armazena indefinidamente — não há cron job, não há cleanup. Os triggers de auditoria do módulo Férias (migração `20260508234225_ferias_audit_triggers.sql`) estão corretamente anexados a todas as tabelas `ferias_*`, então as alterações de ontem **estão no banco**.

**Causa real do "só aparecem os de hoje":** em `src/components/AuditLogsPanel.tsx`, `fetchLogs()` faz:

```ts
supabase.from("module_audit_logs").select("*").order("created_at", { ascending: false }).limit(500)
```

O filtro de módulo (`moduleFilter === "ferias"`) é aplicado **no cliente**, depois do `.limit(500)`. Como o sistema gera muitos logs por dia (Estoque, Escalas, Vendas, Sistema), o batch de 500 mais recentes pode estar quase todo composto por logs de outros módulos do dia atual, deixando apenas alguns ferias de hoje e empurrando os de ontem para fora da janela. O usuário, na aba Férias, vê só os ferias de hoje.

A aba "Ações Administrativas" também tem `.limit(500)`, mas ali não importa nesse caso — o problema está nas Alterações nos Módulos.

## Solução

**Arquivo:** `src/components/AuditLogsPanel.tsx`

1. **Filtro de módulo no servidor.** Em `fetchLogs`, quando `defaultModule` (ou `moduleFilter` atual) for diferente de `"all"`, aplicar `.eq("module_name", moduleFilter)` antes do `.limit()`. Assim os 500 mais recentes são todos do módulo escolhido.
   - Tornar `fetchLogs` dependente de `moduleFilter` (incluir no `useEffect` deps + recarregar quando o filtro muda) e passar a refazer fetch ao trocar módulo, em vez de filtrar localmente.
   - O filtro adicional `tableFilter` continua client-side (já dentro de um módulo).

2. **Filtro por intervalo de datas.** Adicionar dois inputs de data ("De" / "Até") no topo de cada aba (Admin e Módulos). Quando preenchidos, aplicar `.gte("created_at", de)` e `.lte("created_at", ate + 1 dia)` na query. Default: nenhum filtro (comportamento atual de "últimos N").

3. **Aumentar/expor o limite.** Trocar o `.limit(500)` fixo por um seletor "Carregar últimos N" com opções 200 / 500 / 1000 / 2000 (default 500). Quando há filtro de data ativo, dispensar o limit (ou usar 5000 como teto de segurança).

4. **Indicador "Mostrando X de Y carregados".** Pequeno texto abaixo da tabela mostrando `Carregados: {moduleLogs.length} (filtro de módulo: {moduleFilter})` para o usuário entender o escopo.

5. **Botão Atualizar** já existe (linha 372) — deve refazer o fetch respeitando os novos filtros de servidor.

## Detalhes técnicos

- Não há mudança de schema, RLS, triggers ou backend.
- O componente já aceita `defaultModule="ferias"` via prop — basta usar como valor inicial real do filtro de servidor.
- Manter PT-BR e padrões UI existentes.

## Arquivos a modificar

- `src/components/AuditLogsPanel.tsx`
