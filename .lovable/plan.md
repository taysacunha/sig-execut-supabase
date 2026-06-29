## Problema

A Germana recebe erro ao registrar um afastamento porque há divergência entre os valores aceitos pelo banco e os valores enviados pelo frontend.

**Banco (CHECK constraint atual em `ferias_afastamentos.motivo`):**
`acidente`, `doenca`, `licenca_maternidade`, `licenca_paternidade`, `licenca_medica`, `outros`

**Frontend (`AfastamentosSection.tsx` envia):**
`atestado_medico`, `acompanhamento_familiar`, `doacao_sangue`, `licenca_maternidade`, `licenca_paternidade`, `outros`

Qualquer motivo que não seja `licenca_maternidade`, `licenca_paternidade` ou `outros` viola a constraint e o insert falha com erro tipo `new row for relation "ferias_afastamentos" violates check constraint`.

## Correção

Criar nova migration que substitui o CHECK pelos motivos realmente usados na UI:

```sql
ALTER TABLE public.ferias_afastamentos DROP CONSTRAINT IF EXISTS ferias_afastamentos_motivo_check;

ALTER TABLE public.ferias_afastamentos
  ADD CONSTRAINT ferias_afastamentos_motivo_check
  CHECK (motivo IN (
    'atestado_medico',
    'acompanhamento_familiar',
    'doacao_sangue',
    'licenca_maternidade',
    'licenca_paternidade',
    'outros'
  ));
```

Sem alterações no frontend — os labels (`MOTIVO_LABELS`) já estão alinhados à nova lista.

## Validação

Após aplicar a migration, registrar um afastamento "Atestado Médico" deve concluir sem erro.
