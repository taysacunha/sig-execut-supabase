## Análise dos 5 achados de segurança

### 1. [ERROR] `ferias_audit_logs` — INSERT permite forjar logs
A política atual permite qualquer usuário com `can_view_system('ferias')` inserir registros com `user_id`/`user_email` arbitrários. **Corrigir.**

### 2. [ERROR] `ferias_colaboradores` — CPF exposto a todos com view access
CPF (dado pessoal sensível, LGPD) é lido por qualquer usuário com acesso ao módulo férias. **Corrigir** restringindo o CPF apenas a editores.

### 3. [WARN] `dev_tracker` sem policy de SELECT para usuários comuns
**Falso positivo** — a tabela é intencionalmente restrita a admins (custos/horas internos). **Ignorar.**

### 4. [WARN] `module_audit_logs` sem cláusula para módulo `ferias`
A SELECT policy só cobre `escalas`, `vendas` e `sistema`. **Corrigir** adicionando cláusula para `ferias`.

### 5. [WARN] RLS Policy Always True
A migration antiga `20251121021746` criou policies `WITH CHECK (true)` / `USING (true)` em `period_specific_day_configs` para INSERT/UPDATE/DELETE. Embora `20260114190234` tenha criado novas policies restritivas, as antigas **não foram dropadas pelo nome correto** (foram dropados nomes "Admin..."). **Corrigir** removendo as policies permissivas remanescentes.

---

## Correções

### Migration nova: `fix_security_findings.sql`

**1) Endurecer INSERT em `ferias_audit_logs`**
```sql
DROP POLICY IF EXISTS "ferias_audit_logs_insert" ON public.ferias_audit_logs;
CREATE POLICY "ferias_audit_logs_insert"
  ON public.ferias_audit_logs FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND can_edit_system(auth.uid(), 'ferias')
  );
```

**2) Proteger CPF em `ferias_colaboradores`**
- Revogar SELECT da coluna `cpf` para `authenticated`.
- Criar função `get_colaborador_cpf(uuid)` SECURITY DEFINER que retorna CPF apenas se o caller for editor de férias ou admin.
- Atualizar componentes que exibem CPF (`ColaboradorViewDialog`, `ColaboradorDialog`, `ConsultaGeralTab`, `FormularioPDFGenerator`, `ContadorPDFGenerator`, `FeriasColaboradores`, `FeriasFerias`) para buscar CPF via RPC quando necessário, em vez de via `select *`.

```sql
REVOKE SELECT (cpf) ON public.ferias_colaboradores FROM authenticated;
GRANT SELECT (cpf) ON public.ferias_colaboradores TO authenticated;
-- Ajustar via policy column-level não é suportado nativo, então:
-- Abordagem: criar VIEW `ferias_colaboradores_safe` que mascara CPF
-- e função get_colaborador_cpf para editores.

CREATE OR REPLACE FUNCTION public.get_colaborador_cpf(_colaborador_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN can_edit_system(auth.uid(), 'ferias') OR is_admin_or_super(auth.uid())
      THEN c.cpf
    ELSE NULL
  END
  FROM public.ferias_colaboradores c
  WHERE c.id = _colaborador_id;
$$;
```
> Observação: como Postgres não tem column-level RLS direto, o mais seguro sem quebrar o frontend é usar trigger BEFORE SELECT? Não existe. Solução pragmática: manter a coluna acessível, mas adicionar memória de segurança documentando a intenção e refatorar componentes sensíveis (relatórios/PDFs/contador) a utilizar a RPC. Para o erro do scanner, vamos **dividir a tabela**: mover CPF para `ferias_colaboradores_dados_sensiveis` com RLS exclusiva para editores.

```sql
CREATE TABLE public.ferias_colaboradores_dados_sensiveis (
  colaborador_id uuid PRIMARY KEY REFERENCES public.ferias_colaboradores(id) ON DELETE CASCADE,
  cpf text,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.ferias_colaboradores_dados_sensiveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Editors can view sensitive data"
  ON public.ferias_colaboradores_dados_sensiveis FOR SELECT TO authenticated
  USING (can_edit_system(auth.uid(), 'ferias') OR is_admin_or_super(auth.uid()));
CREATE POLICY "Editors can manage sensitive data"
  ON public.ferias_colaboradores_dados_sensiveis FOR ALL TO authenticated
  USING (can_edit_system(auth.uid(), 'ferias'))
  WITH CHECK (can_edit_system(auth.uid(), 'ferias'));

-- Backfill
INSERT INTO public.ferias_colaboradores_dados_sensiveis (colaborador_id, cpf)
SELECT id, cpf FROM public.ferias_colaboradores WHERE cpf IS NOT NULL
ON CONFLICT (colaborador_id) DO NOTHING;

-- Remover coluna cpf da tabela principal
ALTER TABLE public.ferias_colaboradores DROP COLUMN cpf;
```
- Atualizar consumidores do CPF para fazer join/segunda query em `ferias_colaboradores_dados_sensiveis`.
- Atualizar `ColaboradorDialog` (form de cadastro) para gravar CPF na tabela sensível via `upsert`.

**3) Adicionar `ferias` ao SELECT de `module_audit_logs`**
```sql
DROP POLICY IF EXISTS "Users can view own module audit_logs" ON public.module_audit_logs;
CREATE POLICY "Users can view own module audit_logs"
  ON public.module_audit_logs FOR SELECT TO authenticated
  USING (
    (module_name = 'escalas' AND can_view_system(auth.uid(), 'escalas'))
    OR (module_name = 'vendas' AND can_view_system(auth.uid(), 'vendas'))
    OR (module_name = 'ferias' AND can_view_system(auth.uid(), 'ferias'))
    OR (module_name = 'estoque' AND can_view_system(auth.uid(), 'estoque'))
    OR (module_name = 'sistema' AND is_admin_or_super(auth.uid()))
  );
```

**4) Limpar policies always-true em `period_specific_day_configs`**
```sql
DROP POLICY IF EXISTS "Authenticated users can view period_specific_day_configs" ON public.period_specific_day_configs;
DROP POLICY IF EXISTS "Authenticated users can insert period_specific_day_configs" ON public.period_specific_day_configs;
DROP POLICY IF EXISTS "Authenticated users can update period_specific_day_configs" ON public.period_specific_day_configs;
DROP POLICY IF EXISTS "Authenticated users can delete period_specific_day_configs" ON public.period_specific_day_configs;
```
(As novas policies restritas baseadas em `can_view/edit_system('escalas')` já existem na migration `20260114190234`.)

Também rodar drops análogos para `brokers`, `locations`, `generated_schedules` e demais tabelas da migration `20251023224041` para eliminar quaisquer policies "Authenticated users can ..." remanescentes (por idempotência).

### Ignorar findings (com justificativa)
- `dev_tracker_no_select_policy` — intencional (admin-only).

### Atualizar memória de segurança
Documentar:
- CPF de colaboradores agora vive em `ferias_colaboradores_dados_sensiveis`, acessível só a editores/admins.
- `ferias_audit_logs` requer `user_id = auth.uid()` e edit access.
- `dev_tracker` é admin-only por design.

---

## Arquivos afetados
- **Nova**: `supabase/migrations/2026XXXXXXXXXX_fix_security_findings.sql`
- **Editar (CPF via tabela sensível)**:
  - `src/components/ferias/colaboradores/ColaboradorDialog.tsx`
  - `src/components/ferias/colaboradores/ColaboradorViewDialog.tsx`
  - `src/components/ferias/relatorios/ConsultaGeralTab.tsx`
  - `src/components/ferias/relatorios/FormularioPDFGenerator.tsx`
  - `src/components/ferias/relatorios/ContadorPDFGenerator.tsx`
  - `src/pages/ferias/FeriasColaboradores.tsx`
  - `src/pages/ferias/FeriasFerias.tsx`

## Após aprovação
Você precisará executar a migration nova no SQL Editor do Supabase.

Posso aplicar?
