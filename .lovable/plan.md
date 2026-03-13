

## Cadastro de férias com apenas 1 período definido

### Situação atual

Atualmente **não é possível** cadastrar férias com apenas o 1º período. Três bloqueios impedem isso:

1. **Banco de dados**: `quinzena2_inicio` e `quinzena2_fim` são `NOT NULL` (houve uma migration para torná-los nullable, mas foi revertida por `.lovable/revert_quinzena2_not_null.sql`).
2. **Validação Zod** (linha 59-60): `quinzena2_inicio: z.string().min(1, "...")` e `quinzena2_fim: z.string().min(1, "...")` — campos obrigatórios.
3. **Validação no `onSubmit`** (linha 797-799): `if (!data.quinzena2_inicio) { toast.error("Preencha..."); return; }`.

### Sobre o gerador automático

O `vacationGenerator.ts` **sempre gera dois períodos** (Q1 e Q2). Quando encontra um colaborador que já tem férias cadastradas (`hasExisting` na linha 258), ele pula com "Já possui férias cadastradas para este ano". Ele não verifica se falta o Q2. Logo, se Camily tiver só o Q1 em 2026, ao gerar 2027 ela apareceria como "já possui férias" (o filtro é por `quinzena1_inicio` no ano) e seria ignorada — sem aviso claro de que o Q2 está pendente.

---

### Plano de implementação

#### 1. Migration: tornar quinzena2 nullable novamente

```sql
ALTER TABLE ferias_ferias ALTER COLUMN quinzena2_inicio DROP NOT NULL;
ALTER TABLE ferias_ferias ALTER COLUMN quinzena2_fim DROP NOT NULL;
```

#### 2. Ajustar schema Zod e formulário (`FeriasDialog.tsx`)

- Tornar `quinzena2_inicio` e `quinzena2_fim` opcionais no schema Zod (`.optional().or(z.literal(""))`)
- Remover a validação hard-block no `onSubmit` (linha 797-799)
- No card do 2º Período, adicionar texto indicativo: "Deixe em branco se ainda não definido"
- Se o 2º período estiver vazio, salvar `null` no banco

#### 3. Ajustar mutation de save

- No payload (linha 691-692), usar `data.quinzena2_inicio || null` em vez do valor direto
- Garantir que a checagem de conflitos (linha 500-501) não quebre quando Q2 é vazio — já faz `parseISO("")` que geraria `Invalid Date`

#### 4. Ajustar validação de conflitos (`checkConflicts`)

- Proteger contra Q2 vazio: só checar overlap do Q2 se `data.quinzena2_inicio` existir

#### 5. Ajustar `validateVacation`

- Só checar mês do Q2 (linha 767-773) se `data.quinzena2_inicio` existir

#### 6. Ajustar gerador (`vacationGenerator.ts`)

- Na verificação `hasExisting` (linha 258), diferenciar:
  - Se a férias existente tem Q2 preenchido → "Já possui férias completas"
  - Se Q2 é null → **não pular**, mas sinalizar nos `conflicts` como "2º período pendente do ano anterior"
- Na checagem de conflitos com férias existentes (linhas 204-205), proteger contra `quinzena2_inicio` null

#### 7. Indicador visual na tabela de férias (`FeriasFerias.tsx`)

- Quando uma férias tiver `quinzena2_inicio = null`, exibir badge "2º período pendente" na tabela

#### 8. Ajustar ViewDialog e Calendário

- `FeriasViewDialog`: mostrar "Não definido" para o 2º período quando null
- `CalendarioFeriasTab`: só renderizar o 2º período se existir

---

### Arquivos impactados

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | Tornar quinzena2 nullable |
| `FeriasDialog.tsx` | Schema Zod, validação, mutation, conflitos |
| `vacationGenerator.ts` | Tratar férias com Q2 pendente na geração |
| `FeriasFerias.tsx` | Badge "2º período pendente" |
| `FeriasViewDialog.tsx` | Exibir "Não definido" |
| `CalendarioFeriasTab.tsx` | Proteger contra Q2 null |

