# Plano: validar correções de segurança sem quebrar o sistema

## Contexto

As últimas migrations de segurança adicionaram guards `can_view_system(auth.uid(), 'escalas')` em 10 funções RPC do dashboard. O risco é bloquear usuários que hoje veem o dashboard mas **não** têm linha em `system_access` para `escalas` (por exemplo, super_admin/admin que só dependem de `has_role`).

Edge functions `log-dev-work` e `deactivate-expired-notice` foram protegidas com secrets. Como você não tem certeza se são usadas, vamos tratá-las separadamente.

## Etapa 1 — Você testa o dashboard de Escalas (manual, 2 min)

1. Abra `/escalas` logado com seu usuário admin.
2. Abra `/escalas` logado com um usuário comum que normalmente vê escalas.
3. Me reporte:
  - Os cards/gráficos carregam normalmente? OU
  - Aparece erro "Access denied: escalas system access required" / dados vazios / spinner infinito? Cerregaram normalmente. Tanto com o usuário admin quando com usuário comum.

## Etapa 2 — Ajustar guards (só se Etapa 1 acusar bloqueio)

Trocar o guard restritivo por um permissivo que cobre todos os perfis legítimos:

```sql
IF NOT (
  public.can_view_system(auth.uid(), 'escalas')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'manager')
) THEN
  RAISE EXCEPTION 'Access denied: escalas system access required';
END IF;
```

Aplicado nas 10 funções: `get_top_brokers`, `get_top_locations`, `get_shift_stats`, `get_weekly_assignments`, `get_dashboard_counts`, `get_top_brokers_hybrid`, `get_top_locations_hybrid`, `get_broker_performance_hybrid`, `get_location_performance_hybrid`, `get_dashboard_stats_hybrid`.

Migration nova, não edita as anteriores.

## Etapa 3 — Edge functions órfãs

Como você não usa ativamente:

- `**log-dev-work**` — utilitária de log de desenvolvimento. Recomendo **deletar**: não tem chamadas no frontend e não há motivo para manter uma function exposta com chave.
- `**deactivate-expired-notice**` — provável job de cron. Se não estiver agendada no `pg_cron`, pode deletar também. Vou verificar antes se há job agendado.

Se preferir manter "por garantia", deixamos como está — só não funcionará sem os secrets `LOG_DEV_WORK_KEY` / `CRON_SECRET` cadastrados, o que é o estado seguro.

## Por que isso não vai quebrar mais nada

- Etapa 1 é só observação, não muda código.
- Etapa 2 só **amplia** quem tem acesso, nunca restringe mais.
- Etapa 3 remove código não usado; o sistema "que roda 100% hoje" não depende dele.
- As migrations de `search_path` já aplicadas são neutras em comportamento — só fixam o schema padrão.

## Detalhes técnicos

- Nenhuma migration existente será editada (são read-only). Tudo via nova migration timestamped.
- Nenhum código frontend muda nesta rodada.
- Se Etapa 1 estiver 100% OK, pulamos Etapa 2 e fechamos só a Etapa 3.

## O que eu preciso de você antes de implementar

- Resultado do teste da Etapa 1.
- Confirmação de que posso deletar as duas edge functions (ou se prefere manter).
- Não faço ideia se utilizo a `log-dev-work e deactivate-expired-notice. Verifique tudo antes de qualquer ação que possa prejudicar. Já que a etapa 1 passou, a etapa 2 não será executada, confirma?`