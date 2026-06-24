## Ajustes no dialog "Nova Placa"

Duas mudanças no `src/components/estoque/materiais/NovaPlacaDialog.tsx` e ajustes correlatos no fluxo de entrada em `/estoque/placas`.

### 1. Adicionar campo Categoria
- Igual ao do dialog "Novo Material": Select com as opções de `estoque_categorias` (ativas, ordenadas por nome), opcional.
- Buscar com `useQuery(["estoque-categorias-nova-placa"])`.
- Persistir em `estoque_placas.categoria_id` (nova coluna FK para `estoque_categorias`, ON DELETE SET NULL, nullable).

### 2. Remover campo "Código da placa"
- Remover Input do código, o `useEffect` de verificação de duplicidade e o estado `codigoCheck`.
- O código passa a ser atribuído **somente no fluxo de Entrada** dentro de `/estoque/placas` (página de gestão).
- Tornar `estoque_placas.codigo` nullable; manter unicidade apenas quando preenchido (índice único parcial `WHERE codigo IS NOT NULL`).
- Placas sem código ficam com status `aguardando_codigo` (novo valor) até receberem código na entrada. Aparecem em um contador/aba dedicada na página de placas (escopo: somente ajuste de label do status existente — sem nova aba nesta entrega).

### 3. Fluxo de Entrada em `/estoque/placas`
- Em `NovaSaidaDialog` / botão equivalente de **Entrada** (criar se ainda não existir um dialog de entrada): permitir selecionar uma placa "aguardando código" e informar o `codigo` ali, registrando histórico `tipo: "codigo_atribuido"`.
- Validação de unicidade do código acontece nesse momento (mensagem clara se já existir).

### Detalhes técnicos

**Migração SQL** (`db/migrations/<timestamp>_estoque_placas_categoria_e_codigo_opcional.sql`):
```sql
ALTER TABLE public.estoque_placas
  ADD COLUMN IF NOT EXISTS categoria_id uuid
  REFERENCES public.estoque_categorias(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS estoque_placas_categoria_id_idx
  ON public.estoque_placas (categoria_id);

ALTER TABLE public.estoque_placas
  ALTER COLUMN codigo DROP NOT NULL;

DROP INDEX IF EXISTS estoque_placas_codigo_key;
CREATE UNIQUE INDEX estoque_placas_codigo_unique
  ON public.estoque_placas (codigo) WHERE codigo IS NOT NULL;
```
(Sem novos GRANTs — tabela já existente.)

**Arquivos alterados:**
- `src/components/estoque/materiais/NovaPlacaDialog.tsx` — remove código/codigoCheck, adiciona Select de Categoria, ajusta `mutationFn` (insere sem `codigo`, com `categoria_id`).
- `src/pages/estoque/EstoquePlacas.tsx` — coluna/badge para placas sem código, ação "Atribuir código" no fluxo de entrada.
- `src/hooks/useEstoquePlacas.ts` — incluir `categoria_id` e tornar `codigo` opcional na interface `Placa`.
- `db/migrations/<timestamp>_estoque_placas_categoria_e_codigo_opcional.sql`.

### Fora de escopo
- Não vou transformar placas em linhas de `estoque_materiais` (manter modelo atual: 1 material "Placa" + instâncias em `estoque_placas`).
- Não vou mexer em RLS, saldos, ou no dialog Novo Material.
