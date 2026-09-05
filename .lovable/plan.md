# Fechar de vez o histórico da /dev

## Sobre a "automatização"

Nunca houve automatização. A regra do projeto diz que **eu** registro cada entrega ao final do trabalho — rotina manual minha, não gatilho no banco. Por isso houve esquecimento. O passo 4 troca isso por algo cobrável.

## Diagnóstico fechado com os seus resultados

- A importação rodou, mas foi forçada a caber em 1.195h. Como os seus 577h já ocupavam parte do teto, só entraram 618h das 1.195h do acervo.
- Resultado: **58 atividades ficaram com 0h** e "Relatórios e PDFs" ficou com 1h em vez de 16h.
- **7 atividades do acervo repetem lançamentos seus**, somando 86h — não podem ser contadas duas vezes.

**Total verdadeiro: 577 + 1.195 − 86 = 1.686 horas.**

## Passo 1 — Rode este SQL de correção

Transacional, idempotente, não toca nos seus lançamentos manuais:

```sql
BEGIN;

-- 1. Remove as cópias importadas que repetem um lançamento seu
DELETE FROM public.dev_tracker_log l
WHERE l.source = 'legacy_item'
  AND EXISTS (
    SELECT 1 FROM public.dev_tracker_log m
    WHERE m.source = 'manual'
      AND m.system_name = l.system_name
      AND m.title = l.title
  );

-- 2. Devolve as horas cheias do acervo às atividades importadas
UPDATE public.dev_tracker_log l
SET hours = d.hours,
    description = regexp_replace(
      COALESCE(l.description, ''),
      ' \((item preservado sem horas adicionais na reconciliacao|saldo parcial do acervo legado)\)$',
      ''
    )
FROM public.dev_tracker d
WHERE l.source = 'legacy_item'
  AND l.legacy_key = 'dev_tracker:' || d.id::text
  AND l.hours IS DISTINCT FROM d.hours;

-- 3. Validação: aborta se não fechar em 1686h e sem zeradas
DO $$
DECLARE t numeric; z int;
BEGIN
  SELECT COALESCE(SUM(hours),0), COUNT(*) FILTER (WHERE COALESCE(hours,0) <= 0)
    INTO t, z FROM public.dev_tracker_log;
  IF z > 0 THEN
    RAISE EXCEPTION 'Ainda existem % atividades com 0h. Nada foi gravado.', z;
  END IF;
  IF t <> 1686 THEN
    RAISE EXCEPTION 'Total ficou em % h, esperado 1686 h. Nada foi gravado.', t;
  END IF;
  RAISE NOTICE 'Historico corrigido: % h, sem atividades zeradas.', t;
END $$;

COMMIT;
```

Se ele abortar, é porque algum número mudou — me traga a mensagem e eu ajusto sem chutar.

## Passo 2 — Ajustes na página /dev (feitos por mim depois que o SQL rodar)

- Remover a comparação fixa com o acervo legado: o total do histórico passa a ser o único número oficial.
- Bloquear salvar lançamento com horas zeradas ou negativas.
- Aviso na tela, com número exato, se aparecer atividade zerada ou título duplicado.
- PDFs sempre iguais à tela.

## Passo 3 — Encerrar a fonte antiga

- `dev_tracker` deixa de ser lido pela página; fica só como arquivo histórico.
- Os scripts antigos de importação são marcados como inválidos para não voltarem a rodar.

## Passo 4 — Registro daqui em diante

- Gravo o lançamento no mesmo momento da entrega, com horas maiores que zero, e confirmo que salvou.
- Se falhar, te aviso na hora em vez de dar a entrega por concluída.
- A tela passa a acusar o que ficou faltando, então dá para cobrar.

## Observação

`roadmap.md` será atualizado com estes passos após a aprovação — em modo de planejamento só posso alterar o próprio plano.
