## Análise dos achados de segurança

Verifiquei as três descobertas contra o código do projeto (políticas RLS, funções `can_view_system`/`can_edit_system`, e como o frontend consome essas RPCs). **Nenhuma delas é falso positivo** — todas são reais e devem ser tratadas. Abaixo, a análise e o plano de correção.

---

### 1. ERROR — Escalas Queue/Stats Mutation RPCs (crítico)

**Funções afetadas (8):**
- `sync_saturday_queue`, `update_saturday_queue_after_allocation`
- `save_broker_weekly_stats`, `delete_weekly_stats_for_period`
- `sync_location_rotation_queue`, `update_location_queue_after_allocation`, `bulk_update_location_queues_after_allocation`
- `aggregate_month_data`

**Por que é real:** todas são `SECURITY DEFINER` (rodam como owner, ignoram RLS) e não checam `auth.uid()`. Qualquer usuário autenticado — mesmo sem acesso ao módulo Escalas — pode chamá-las via PostgREST e reescrever filas de rotação, apagar estatísticas semanais e reagregar histórico mensal. Isso quebra a integridade operacional do módulo.

**Veredicto:** **NÃO é falso positivo. Tratar como erro.**

---

### 2. WARN — Escalas Read RPCs (4 funções de leitura)

**Funções afetadas:**
- `get_saturday_queue`, `get_previous_week_stats`
- `get_location_rotation_queue`, `get_weekday_distribution_hybrid`

**Por que é real:** mesma classe do anterior, mas apenas leitura. Expõem nomes de corretores, posições de fila e contagens de plantões a qualquer usuário autenticado, ignorando `can_view_system('escalas')`. Como o restante do módulo usa esse guard, manter essas 4 funções abertas é inconsistente e vazamento de dados operacionais.

**Veredicto:** **NÃO é falso positivo. Tratar.**

---

### 3. WARN — Vendas Dashboard RPCs (3 funções)

**Funções afetadas:**
- `get_sales_dashboard_summary_flexible`
- `get_sales_team_vgv_ranking_flexible`
- `get_sales_broker_vgv_ranking_flexible`

**Por que é real:** expõem VGV (faturamento), rankings de equipes e de corretores. Um usuário com acesso apenas a Férias ou Escalas pode ler todo o desempenho comercial chamando essas RPCs diretamente. Dado que Vendas é justamente o módulo com regra de visibilidade de VGV (memória do projeto), essa exposição contradiz a política existente.

**Veredicto:** **NÃO é falso positivo. Tratar.**

---

## Plano de correção

Criar **uma única migration** que adiciona um guard de autorização no topo de cada função, mantendo a assinatura e o comportamento atual:

### Padrão para funções de escrita (Escalas)
```sql
IF NOT public.can_edit_system(auth.uid(), 'escalas') THEN
  RAISE EXCEPTION 'Acesso negado: permissão de edição do módulo Escalas necessária';
END IF;
```

### Padrão para funções de leitura (Escalas)
```sql
IF NOT public.can_view_system(auth.uid(), 'escalas') THEN
  RAISE EXCEPTION 'Acesso negado: acesso ao módulo Escalas necessário';
END IF;
```

### Padrão para funções de Vendas
```sql
IF NOT public.can_view_system(auth.uid(), 'vendas') THEN
  RAISE EXCEPTION 'Acesso negado: acesso ao módulo Vendas necessário';
END IF;
```

### Passos
1. **Migration única** com `CREATE OR REPLACE FUNCTION` para as 15 funções listadas, preservando corpo atual + adicionando o guard como primeira instrução do `BEGIN`.
2. **Verificação no frontend:** as chamadas existentes (hooks `useSaturdayQueue`, `useLocationRotationQueue`, dashboards de Vendas, etc.) já são feitas por usuários com acesso ao respectivo módulo — nenhuma alteração de UI necessária. Apenas usuários sem permissão receberão erro, que é o comportamento desejado.
3. **Atualizar memória de segurança** após aplicar, registrando que esses RPCs agora exigem `can_view_system`/`can_edit_system`.
4. **Marcar findings como fixed** após confirmação do usuário.

### Observação
Nenhuma quebra funcional esperada: o app já usa `ProtectedRoute` + `SystemGuard` para garantir que só quem tem acesso ao módulo abra as telas que chamam essas RPCs. O guard no banco apenas fecha o bypass via API direta (PostgREST).

Se aprovado, implemento a migration e atualizo a memória de segurança.