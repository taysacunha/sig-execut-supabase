# db/migrations — Espelho completo de migrations (self-hosted)

Esta pasta é a **fonte única de verdade** para subir o banco do projeto em
ambiente self-hosted (PostgreSQL próprio, sem Supabase Cloud). Ela contém
TODAS as migrations que descrevem o estado completo do schema:

- **85 arquivos** copiados de `supabase/migrations/` (migrations oficiais
  geradas pelo Lovable/Supabase, mantidas com o nome original).
- **24 arquivos** com prefixo `20251015XX0000_lovable_*` que são as
  migrations soltas que estavam em `.lovable/*.sql` (executadas
  manualmente no Dashboard durante o desenvolvimento). Foram renomeadas
  com timestamp `20251015` para entrarem **antes** das migrations oficiais
  na ordem cronológica de aplicação.

## Por que existe esta pasta separada?

O Supabase CLI lê automaticamente `supabase/migrations/`. Se duplicássemos
os arquivos lá, ele tentaria reaplicar tudo e quebraria. Esta pasta isolada
é usada **apenas** quando você for subir o banco em outro ambiente.

## Como aplicar em um banco novo (self-hosted)

```bash
# Ordem alfabética = ordem cronológica de aplicação
for f in db/migrations/*.sql; do
  echo "Aplicando: $f"
  psql "$DATABASE_URL" -f "$f" -v ON_ERROR_STOP=1
done
```

Ou via Supabase CLI apontando para esta pasta:

```bash
supabase db push --db-url "$DATABASE_URL" --file db/migrations/
```

## Idempotência

Todas as migrations copiadas de `.lovable/` foram ajustadas para serem
**idempotentes**: usam `IF NOT EXISTS`, `CREATE OR REPLACE`,
`DROP POLICY IF EXISTS` antes de `CREATE POLICY`,
`DROP TRIGGER IF EXISTS` antes de `CREATE TRIGGER`, e o seed do
`dev_tracker` só insere se a tabela estiver vazia.

Isso significa que rodar esta pasta inteira:
- num banco vazio → cria todo o schema do zero;
- num banco que já tem parte do conteúdo aplicado → no-op nas partes
  já existentes, aplica só o que falta.

## Regra para migrations FUTURAS

Toda nova migration de schema (ou backfill estrutural) deve ser criada
em **duas pastas**:

1. `supabase/migrations/<timestamp>_descricao.sql` — para o Lovable
   aplicar no Supabase Cloud automaticamente.
2. `db/migrations/<timestamp>_descricao.sql` — cópia idêntica para manter
   o espelho de self-hosted atualizado.

Mantenha o **mesmo timestamp e nome** nas duas cópias para facilitar a
conferência.

## O que NÃO está aqui

- A pasta `.lovable/` continua intacta com os SQLs originais como
  histórico de referência.
- Migrations das funções edge (`supabase/functions/`) não são SQL e não
  pertencem aqui.
- Configuração do projeto (`supabase/config.toml`) não é migration.