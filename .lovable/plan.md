## Problema

Quando criei a tabela `estoque_categorias` e troquei o input livre por Select vinculado a `categoria_id`, **não migrei** as categorias-texto que já existiam em `estoque_materiais.categoria`. Resultado:

- A página **Categorias** ficou vazia (nenhuma categoria foi criada automaticamente).
- Os materiais antigos têm `categoria` (texto) preenchido, mas `categoria_id` nulo. Na listagem o nome ainda aparece (uso o texto como fallback), mas no **dropdown de edição** o campo vem em "Sem categoria", e qualquer filtro/agrupamento futuro por `categoria_id` não enxergaria esses materiais.

Foi um vacilo meu não ter feito a importação dos dados existentes na mesma migration.

## Plano de correção

### 1. Migração de dados (uma vez)
Rodar uma migration que:

1. Coleta todos os valores **distintos** e não-nulos de `estoque_materiais.categoria` (com `trim` e ignorando vazios).
2. Para cada valor:
   - Se já existe uma linha em `estoque_categorias` com mesmo nome (case-insensitive), reutiliza.
   - Senão, insere uma nova categoria ativa com aquele nome.
3. Atualiza `estoque_materiais.categoria_id` apontando para a categoria correspondente, casando por nome (case-insensitive, com `trim`).
4. Mantém a coluna legada `categoria` (texto) preenchida para histórico/auditoria — só passa a ser ignorada na UI.

Tudo idempotente (`ON CONFLICT DO NOTHING`-equivalente via verificação por nome) para poder ser re-executado sem efeitos colaterais.

### 2. Ajuste mínimo na UI de Materiais
- Listagem passa a usar **somente** `categoria_id → nome em estoque_categorias` (sem fallback para o texto antigo, já que o passo 1 garante o vínculo).
- Continuar exibindo "—" quando o material realmente não tiver categoria.

### 3. Documentação
- Aviso na descrição do menu "Categorias" indicando que categorias antigas foram importadas automaticamente e podem ser renomeadas/desativadas.

## Detalhes técnicos

Migração SQL (resumo):

```sql
-- 1. Cria categorias faltantes
INSERT INTO public.estoque_categorias (nome, is_active)
SELECT DISTINCT btrim(m.categoria), true
FROM public.estoque_materiais m
WHERE m.categoria IS NOT NULL AND btrim(m.categoria) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.estoque_categorias c
    WHERE lower(c.nome) = lower(btrim(m.categoria))
  );

-- 2. Vincula categoria_id em todos os materiais existentes
UPDATE public.estoque_materiais m
SET categoria_id = c.id
FROM public.estoque_categorias c
WHERE m.categoria_id IS NULL
  AND m.categoria IS NOT NULL
  AND lower(c.nome) = lower(btrim(m.categoria));
```

Depois disso, edito `EstoqueMateriais.tsx` para mostrar apenas `categoriaNome(m.categoria_id)` (sem fallback) e simplifico a função.

## Resultado esperado

- Todas as categorias que você já usava aparecem na página **Categorias**.
- Todos os materiais continuam com categoria visível, agora ligados por `categoria_id`.
- Você pode renomear uma categoria em um único lugar e propagar para todos os materiais.

Confirma que posso aplicar essa migration de dados?