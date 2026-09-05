# Fechar de vez o histórico da /dev

## Sobre a "automatização"

Nunca houve automatização. A regra do projeto diz que **eu** registro cada entrega no histórico ao final do trabalho — rotina manual minha, não gatilho no banco. Por isso houve esquecimento. O passo 4 troca isso por algo cobrável.

## O que os seus resultados provaram

- A importação **rodou e gravou**: o histórico tem 204 linhas, sendo 94 lançamentos seus (577h) e 110 vindos do acervo (618h).
- O acervo original tem 110 atividades somando **1.195h**, nenhuma zerada.
- Como o script foi obrigado a fechar exatamente em 1.195h, só coube 618h das 1.195h do acervo. Resultado: **58 atividades entraram com 0h** e outras entraram com horas cortadas pela metade.
- Portanto **1.195 não é o total real** — é um teto imposto pelo script. O total verdadeiro é: 577h seus + 1.195h do acervo, menos o que estiver duplicado.
- Já apareceram **7 títulos repetidos** (estoque, férias, infraestrutura, vendas), que precisam ser conferidos antes de somar.

## Passo 1 — Um último SQL de conferência

Só leitura. Mostra quanto cada atividade importada perdeu e separa as duplicatas:

```sql
SELECT l.system_name, l.title,
       l.hours AS horas_no_historico,
       d.hours AS horas_no_acervo,
       (d.hours - l.hours) AS horas_perdidas,
       EXISTS (
         SELECT 1 FROM public.dev_tracker_log m
         WHERE m.source = 'manual'
           AND m.system_name = l.system_name
           AND m.title = l.title
       ) AS ja_existe_lancamento_manual
FROM public.dev_tracker_log l
JOIN public.dev_tracker d ON 'dev_tracker:' || d.id::text = l.legacy_key
WHERE l.source = 'legacy_item'
ORDER BY ja_existe_lancamento_manual DESC, horas_perdidas DESC;
```

Também o total que vai resultar da correção:

```sql
SELECT
  (SELECT SUM(hours) FROM public.dev_tracker_log WHERE source = 'manual') AS manual,
  (SELECT SUM(hours) FROM public.dev_tracker) AS acervo,
  (SELECT COALESCE(SUM(d.hours),0)
     FROM public.dev_tracker d
     JOIN public.dev_tracker_log l ON l.legacy_key = 'dev_tracker:' || d.id::text
    WHERE l.source = 'legacy_item'
      AND EXISTS (SELECT 1 FROM public.dev_tracker_log m
                  WHERE m.source='manual' AND m.system_name=l.system_name AND m.title=l.title)
  ) AS duplicado_a_remover;
```

Total corrigido = manual + acervo − duplicado.

## Passo 2 — Correção final (uma migração só)

Depois que você colar esses dois resultados:

- Cada atividade importada volta a ter **as horas cheias do acervo**; nenhuma fica em 0h.
- As atividades importadas que repetem um lançamento seu são **removidas** (some a cópia importada, o seu lançamento fica).
- Nada seu é apagado, reduzido ou reescrito.
- Sem teto artificial: o total passa a ser a soma real das atividades.
- Transacional e idempotente: se o resultado não bater com a conta acima, nada é gravado.

## Passo 3 — A tela para de esconder inconsistência

- Nenhuma atividade com 0h contada como trabalho válido.
- Não dá para salvar lançamento com horas zeradas ou negativas.
- Aviso na tela com o número exato quando houver zerada ou título duplicado.
- Some a comparação fixa com o acervo legado; o total do histórico passa a ser o único.
- PDFs sempre iguais à tela.

## Passo 4 — Registro daqui em diante

- Gravo o lançamento no mesmo momento da entrega, com horas maiores que zero, e confirmo que salvou.
- Se falhar, te aviso na hora em vez de dar a entrega por concluída.
- A tela passa a acusar o que ficou faltando, então dá para cobrar.

## Observação

`roadmap.md` será atualizado com estes passos após a aprovação — em modo de planejamento só posso alterar o próprio plano.
