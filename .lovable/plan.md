## Problema

A tabela `ferias_folgas_perdas` tem uma constraint:

```sql
CHECK (motivo IN ('falta_injustificada', 'atestado_sabado', 'aviso_previo'))
```

Mas o `PerdaFolgaDialog.tsx` insere o **rótulo em português** (ex.: `"Falta injustificada"`, `"Atestado médico"`, `"Suspensão disciplinar"`, `"Outro motivo"`) — nenhum desses bate com os valores aceitos, então qualquer salvamento falha.

## Solução

Alinhar o banco e o frontend para usar as mesmas chaves canônicas e exibir rótulos no UI.

### 1. Migração SQL (nova)

- `ALTER TABLE public.ferias_folgas_perdas DROP CONSTRAINT ferias_folgas_perdas_motivo_check;`
- Normalizar dados existentes (se houver linhas com rótulos antigos como `"Atestado médico"`, mapear para a chave nova).
- Recriar com a lista completa de chaves que o diálogo já oferece:
  ```sql
  CHECK (motivo IN (
    'falta_injustificada',
    'atestado_medico',
    'atestado_sabado',
    'aviso_previo',
    'suspensao',
    'outro'
  ))
  ```
  (mantém `atestado_sabado` por compatibilidade histórica.)

### 2. `PerdaFolgaDialog.tsx`

- Trocar o `insert` para gravar `motivo: motivoKey` (a chave) em vez do label traduzido.
- Quando `motivoKey === 'outro'`, manter a obrigatoriedade do campo `observacoes` (já existe).

### 3. Exibição em `src/pages/ferias/FeriasFolgas.tsx` (linha 828)

- Substituir `{perda.motivo}` por um helper `formatMotivoPerda(perda.motivo)` que mapeia as chaves para os rótulos em PT-BR (mesmo dicionário usado no diálogo). Fallback: retornar o valor cru.

### 4. Dev Tracker

- Acrescentar uma linha em `.lovable/dev_tracker_update_seed.sql` (sistema "Férias") registrando a correção: "Corrige constraint de motivo em perdas de folga e padroniza chaves/labels".

## Fora de escopo

- Não muda RLS, layout do diálogo, regras de negócio de afastamento/créditos.
- Não mexe em outras tabelas de férias nem em auditoria.

## Resultado esperado

Registrar perda com qualquer motivo (incluindo "Atestado médico", "Suspensão disciplinar", "Outro motivo") passa a salvar normalmente, e a tabela de perdas continua exibindo o rótulo legível em português.

Também adicione um campo de buscar por nome do colaborador no dialog de registrar perda de folga, pois hoje tem que sair rolando e procurar.