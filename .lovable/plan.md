

O erro indica que a policy `"Ferias users can view afastamentos"` já existe na tabela. Isso significa que parte do SQL já foi executada anteriormente — provavelmente a versão antiga do arquivo `.lovable/ferias_afastamentos_rls_fix.sql` rodou em algum momento, criando as novas policies, mas as antigas (permissivas) podem ter ficado também.

## Diagnóstico

O `DROP POLICY IF EXISTS` cobre apenas os nomes antigos listados. Como as novas policies (`"Ferias users can view afastamentos"`, etc.) já existem, o `CREATE POLICY` falha no primeiro conflito.

## Correção

Adicionar `DROP POLICY IF EXISTS` também para os **novos** nomes de policy antes do `CREATE POLICY`. Assim o script vira idempotente e pode ser rodado múltiplas vezes sem erro.

### Mudança no arquivo `.lovable/ferias_afastamentos_rls_fix.sql`

Incluir 4 linhas adicionais de drop antes dos creates:

```sql
DROP POLICY IF EXISTS "Ferias users can view afastamentos" ON public.ferias_afastamentos;
DROP POLICY IF EXISTS "Ferias editors can insert afastamentos" ON public.ferias_afastamentos;
DROP POLICY IF EXISTS "Ferias editors can update afastamentos" ON public.ferias_afastamentos;
DROP POLICY IF EXISTS "Ferias editors can delete afastamentos" ON public.ferias_afastamentos;
```

Depois execute o arquivo novamente no SQL Editor. Vai derrubar tudo (antigas + novas) e recriar limpo.

| Arquivo | Alteração |
|---------|-----------|
| `.lovable/ferias_afastamentos_rls_fix.sql` | Adicionar `DROP POLICY IF EXISTS` para os 4 novos nomes antes dos `CREATE POLICY`, tornando o script idempotente |

