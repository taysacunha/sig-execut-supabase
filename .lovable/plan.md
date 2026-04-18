

## Plano: exclusão de créditos com justificativa, cascata ao apagar escala, correção de status e do botão "Reduzir dias"

### Problemas identificados

1. **Não há como excluir um crédito** (folga ou férias) na tela de Créditos.
2. **Apagar a escala do mês** (`FeriasFolgas` → "Apagar Escala") deleta as folgas do mês mas **não toca nos créditos** já gerados a partir delas — ficam órfãos. Também não pede justificativa.
3. **Filtro de status "Em Gozo"** em `FeriasFerias` filtra por `f.status === "em_gozo"` (status legado), mas o sistema hoje usa `em_gozo_q1` / `em_gozo_q2` → retorna vazio mesmo havendo períodos em gozo.
4. **Botão "Reduzir dias"** só aparece para `aprovada` ou em-gozo. Não aparece para `q1_concluida` (que ainda tem o 2º período) — deveria. E não deve aparecer apenas quando `concluida` ou `cancelada`.
5. **Cálculo de dias máximos a reduzir** está fixo em 15 e ignora `dias_vendidos` e o tipo (padrão x exceção). Quem vendeu 30 dias tem 0 disponíveis; é preciso calcular dias restantes reais com base no período correto (oficial p/ padrão; gozo/exceção p/ exceções).

### Solução

#### 1. Excluir crédito com justificativa (`FeriasCreditos.tsx`)

- Novo botão **"Excluir"** ao lado de "Usar"/"Pagar" para qualquer crédito (independente do status).
- Abre `AlertDialog` solicitando **justificativa obrigatória** (Textarea).
- Ao confirmar: registra entrada em `ferias_audit_logs` (`action: "delete_credito"`, `entity_type: "ferias_folgas_creditos"`, `entity_id: credito.id`, `old_data: credito`, `details: justificativa`) e em seguida deleta o registro.
- Toast de sucesso e invalidação de `["ferias-creditos"]`.

#### 2. Cascata ao apagar escala de folgas (`FeriasFolgas.tsx`)

- Antes de "Apagar Escala", buscar créditos cujo `tipo='folga'` e `origem_data` está dentro do mês selecionado.
- Se existirem, expandir o `AlertDialog` atual para:
  - Mostrar quantos créditos serão afetados e de quais colaboradores.
  - **Solicitar justificativa obrigatória** (Textarea) — agora exigida sempre que houver créditos a apagar (no caso sem créditos, o diálogo continua simples).
- Mutation `deleteAllFolgasMutation`:
  1. Registrar log em `ferias_audit_logs` para cada crédito afetado (action `delete_credito_cascata`, com a justificativa).
  2. Deletar os créditos do mês.
  3. Deletar `ferias_folgas_escala` e `ferias_folgas` do mês (como hoje).
- Invalidar `["ferias-creditos"]` adicionalmente.

#### 3. Correção do filtro "Em Gozo" (`FeriasFerias.tsx`)

- Trocar a comparação direta `f.status === statusFilter` por uma lógica que, quando `statusFilter === "em_gozo"`, casa qualquer status em `FERIAS_EM_GOZO_STATUSES` (`em_gozo_q1`, `em_gozo_q2`, `em_gozo`).
- Alternativa equivalente: adicionar um item agregado "Em Gozo (qualquer)" mantendo os granulares também. Vou usar a primeira opção por simplicidade.

#### 4. Botão "Reduzir dias" — disponibilidade e cálculo

**Quando aparece:**

- Mostrar para qualquer status que **não** seja `concluida` nem `cancelada`. Ou seja: `pendente`, `aprovada`, `em_gozo_q1`, `q1_concluida`, `em_gozo_q2`, `em_gozo` (legado).

**Cálculo de dias disponíveis (`ReducaoFeriasDialog.tsx`):**

Receber `ferias` completo e calcular:

```
totalDias = (q1Fim - q1Inicio + 1) + (q2Fim - q2Inicio + 1)   // do bloco apropriado
diasJaGozados = soma dos períodos cujo data_fim < hoje
diasDisponiveis = totalDias - diasJaGozados
```

Usando o **bloco correto** conforme o tipo:
- **Padrão** (`is_excecao = false` e `gozo_diferente = false`): usa `quinzena1_*` e `quinzena2_*`.
- **Exceção / gozo diferente**: usa `gozo_quinzena1_*` e `gozo_quinzena2_*` (quando preenchidos), caindo de volta nos campos oficiais quando vazios.
- Considerar `dias_vendidos`: já está embutido nos campos, mas reforçar `max = diasDisponiveis` (que naturalmente será menor).

**Ajustes na UI:**
- Substituir `max={15}` por `max={diasDisponiveis}`.
- Mostrar texto auxiliar: "Disponível para reduzir: X dia(s) (Y vendidos, Z já gozados)".
- Se `diasDisponiveis === 0`: bloquear botão e mostrar alert "Não há dias restantes para reduzir".
- A redução continua subtraindo do **fim do último período não totalmente gozado** (lógica atual já faz isso pelo `endDateField`, mas precisa escolher entre `gozo_*` e oficiais corretamente).

### Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/ferias/FeriasCreditos.tsx` | Botão "Excluir" + AlertDialog com justificativa + log de auditoria |
| `src/pages/ferias/FeriasFolgas.tsx` | Query de créditos do mês; AlertDialog "Apagar Escala" expandido com justificativa quando há créditos; mutation faz cascata + log |
| `src/pages/ferias/FeriasFerias.tsx` | Filtro `statusFilter` agregando estados `em_gozo_*`; condição do botão "Reduzir dias" aceita `q1_concluida` (todos exceto `concluida`/`cancelada`) |
| `src/components/ferias/ferias/ReducaoFeriasDialog.tsx` | Calcular `diasDisponiveis` por tipo (padrão x exceção), considerar dias já gozados e vendidos; ajustar `max`, mensagem e bloqueio quando 0 |

### Detalhes técnicos

- Auditoria: usar `ferias_audit_logs` (já existe) com `user_id`/`user_email` do `supabase.auth.getUser()`. Para cascata múltipla, um único log com `entity_type="ferias_folgas_escala_mes"`, `details=justificativa`, `new_data={ creditos_apagados: [...ids], ano, mes }` (mais leve que N logs).
- Filtro de status: `matchesStatus = statusFilter === "all" || f.status === statusFilter || (statusFilter === "em_gozo" && FERIAS_EM_GOZO_STATUSES.includes(f.status))`.
- Reduzir dias: novo helper local `calcDiasRestantes(ferias)` retornando `{ total, gozados, vendidos, disponiveis, endField }`; `endField` indica qual campo de data atualizar (`gozo_quinzena2_fim` ou `quinzena2_fim`, com fallback para q1 se q2 não existir).

