## Plano corrigido

Vou aplicar somente a correção do comportamento do card **"Gozo interno (real) — Sistema interno"**.

## O que será corrigido

1. **O card Gozo interno ficará livre para editar os 30 dias**
   - Mesmo que o 1º período, o 2º período, ou ambos tenham sido marcados como enviados ao contador.
   - O usuário poderá ajustar datas internas livremente em múltiplos subperíodos.
   - A trava atual baseada em `q1JaGozada` não deve limitar o gozo interno a 15 dias nem esconder opções do 1º período dentro do card interno.

2. **O card Enviado ao contador continuará protegido**
   - Quando já tiver sido enviado ao contador, os períodos oficiais não devem ser alterados por essa edição interna.
   - A alteração será direcionada apenas para os campos/tabela de gozo interno (`gozo_quinzena...` e `ferias_gozo_periodos`).

3. **Validação do gozo interno**
   - Permitir qualquer distribuição interna válida, desde que represente uma exceção real.
   - Bloquear apenas quando o gozo interno for igual ao padrão oficial de 15 + 15, porque nesse caso não faz sentido cadastrar como exceção.
   - Manter validações de subperíodos sobrepostos e ordem cronológica.

4. **Migration já executada**
   - Não vou criar nova migration nem desfazer a tabela/colunas já criadas.
   - A migration de `ferias_gozo_periodos` é justamente o suporte para salvar esses períodos internos flexíveis, então ela pode permanecer.

## Arquivos afetados

- `src/components/ferias/ferias/ExcecaoPeriodosSection.tsx`
  - Remover as restrições de `q1JaGozada` para edição do gozo interno.
  - Permitir opções de distribuição interna para os 30 dias.
  - Ajustar textos para deixar claro que o bloqueio do contador não limita o gozo interno.

- `src/components/ferias/ferias/FeriasDialog.tsx`
  - Não permitir que `q1JaGozada` remova períodos internos da validação/salvamento.
  - Manter os campos oficiais preservados quando já enviados ao contador.
  - Validar apenas que o gozo interno não seja igual ao padrão oficial.

## Resultado esperado

Ao editar uma férias já enviada ao contador, o usuário mantém intacto o que foi enviado no card **Enviado ao contador**, mas consegue ajustar o card **Gozo interno (real)** do jeito necessário para refletir o uso real dos 30 dias no sistema interno.