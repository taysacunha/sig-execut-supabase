# Fechar de vez o histórico da /dev

## Sobre a "automatização"

Nunca houve automatização. A regra salva no projeto diz que **eu** registro cada entrega no histórico ao final do trabalho — é uma rotina manual minha, não um gatilho no banco. Por isso lançamentos foram esquecidos e o total ficou incoerente. O item 5 abaixo troca isso por uma regra objetiva, sem prometer robô nenhum.

## Passo 1 — Você roda este SQL e cola o resultado aqui

Somente leitura, não altera nada:

```sql
SELECT 'RESUMO' AS bloco, jsonb_pretty(jsonb_build_object(
  'dev_tracker_total',      (SELECT COALESCE(SUM(hours),0) FROM public.dev_tracker),
  'dev_tracker_linhas',     (SELECT COUNT(*) FROM public.dev_tracker),
  'dev_tracker_zeradas',    (SELECT COUNT(*) FROM public.dev_tracker WHERE COALESCE(hours,0)=0),
  'log_total',              (SELECT COALESCE(SUM(hours),0) FROM public.dev_tracker_log),
  'log_linhas',             (SELECT COUNT(*) FROM public.dev_tracker_log),
  'log_zeradas',            (SELECT COUNT(*) FROM public.dev_tracker_log WHERE COALESCE(hours,0)=0),
  'log_por_origem',         (SELECT jsonb_agg(x) FROM (
        SELECT COALESCE(source,'(sem origem)') AS origem, COUNT(*) AS linhas,
               COUNT(*) FILTER (WHERE COALESCE(hours,0)=0) AS zeradas,
               SUM(hours) AS horas
        FROM public.dev_tracker_log GROUP BY 1 ORDER BY 1) x),
  'por_sistema',            (SELECT jsonb_agg(x) FROM (
        SELECT COALESCE(t.system_name,l.system_name) AS sistema,
               COALESCE(t.h,0) AS tracker_horas, COALESCE(l.h,0) AS log_horas
        FROM (SELECT system_name, SUM(hours) h FROM public.dev_tracker GROUP BY 1) t
        FULL JOIN (SELECT system_name, SUM(hours) h FROM public.dev_tracker_log GROUP BY 1) l
          ON t.system_name = l.system_name ORDER BY 1) x)
))::text AS dados;
```

E este segundo, com as linhas problemáticas:

```sql
SELECT 'log' AS origem_tabela, id::text, occurred_on::text, system_name, title,
       hours, COALESCE(source,'') AS source, COALESCE(legacy_key,'') AS legacy_key
FROM public.dev_tracker_log
WHERE COALESCE(hours,0) <= 0
ORDER BY system_name, title;
```

```sql
SELECT system_name, title, COUNT(*) AS repeticoes, SUM(hours) AS horas
FROM public.dev_tracker_log
GROUP BY system_name, title
HAVING COUNT(*) > 1
ORDER BY repeticoes DESC, system_name;
```

## Passo 2 — Eu leio o resultado e monto a conciliação

Com os números reais na mão, eu te mostro numa lista curta:
- quantas atividades estão zeradas e de onde vieram;
- quais estão duplicadas;
- qual é o total verdadeiro somando só atividades válidas.

Sem adotar 1.195h nem 1.381h antes disso.

## Passo 3 — Uma migração única de correção

Depois da sua confirmação, um único script transacional que:
- preenche as horas das atividades zeradas com o valor comprovado do acervo legado;
- remove as duplicatas geradas pela importação anterior (só as marcadas como importação, nunca lançamentos seus);
- valida o total antes de gravar e aborta se não bater com a conciliação aprovada;
- é idempotente, pode rodar de novo sem duplicar.

Os scripts antigos de importação ficam marcados como inválidos.

## Passo 4 — A tela para de esconder o problema

- Nada de atividade com 0h aparecendo como trabalho normal.
- Bloquear salvar lançamento com horas zeradas ou negativas.
- Aviso na tela quando houver duplicidade ou horas faltando, com o número exato.
- PDFs sempre iguais à tela.

## Passo 5 — Como o registro passa a funcionar

- A cada entrega minha em qualquer sistema (fora da própria /dev), eu gravo o lançamento no mesmo momento da entrega, com horas maiores que zero, e confirmo na tela.
- Se a gravação falhar, eu te aviso na hora em vez de dar a entrega por concluída.
- Continua sendo rotina minha; a diferença é que a tela agora acusa quando algo ficou faltando, então dá para cobrar.

## Observação

`roadmap.md` será atualizado com estes passos assim que o plano for aprovado — em modo de planejamento só posso alterar o próprio plano.
