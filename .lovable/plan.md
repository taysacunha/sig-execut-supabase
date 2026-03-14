

## Plano: Status granular automático + anos dinâmicos

### 1. Novos status de férias

Substituir o status binário `em_gozo`/`concluida` por status granulares que reflitam cada período:

| Status DB | Label na UI | Cor |
|-----------|------------|-----|
| `aprovada` | Aprovada | azul |
| `em_gozo_q1` | Em Gozo - 1º Período | verde |
| `q1_concluida` | 1º Período Concluído | verde claro |
| `em_gozo_q2` | Em Gozo - 2º Período | verde |
| `concluida` | Concluída | cinza |
| `pendente` | Pendente | amarelo |
| `cancelada` | Cancelada | vermelho |

Quando não há Q2 (pendente ou inexistente), após o fim do Q1 a férias vai direto para `concluida`.

### 2. Função SQL `atualizar_status_ferias` (reescrever)

Transições automáticas considerando gozo_flexivel, gozo_diferente, e padrão:

```
aprovada → em_gozo_q1   (quando hoje >= início do 1º período de gozo)
em_gozo_q1 → q1_concluida   (quando hoje > fim do 1º período de gozo)
q1_concluida → em_gozo_q2   (quando hoje >= início do 2º período de gozo)
em_gozo_q2 → concluida   (quando hoje > fim do 2º período de gozo)
```

Caso especial: se Q2 é NULL → `q1_concluida` é o estado final (ou `concluida` direto se não há Q2 definido). Para simplificar: se Q2 é NULL e Q1 já passou, vai direto para `concluida`.

Para cada transição, a lógica de datas depende do tipo:
- **gozo_flexivel**: consulta `ferias_gozo_periodos` (MIN/MAX por referencia_periodo)
- **gozo_diferente**: usa `gozo_quinzena1_*` e `gozo_quinzena2_*`
- **padrão**: usa `quinzena1_*` e `quinzena2_*`

### 3. Utilitário de anos dinâmicos

Criar `src/lib/dateUtils.ts` com `getYearOptions(past, future)` e substituir em 8 arquivos:

| Arquivo | Range atual | Novo |
|---------|------------|------|
| `FeriasFerias.tsx` | currentYear-3..+1 | `getYearOptions(3, 3)` |
| `FeriasFormularioAnual.tsx` | +1..-1 | `getYearOptions(1, 3)` |
| `QuinzenasTab.tsx` | 0..+4 | `getYearOptions(0, 5)` |
| `ConsultaGeralTab.tsx` | -2..+2 | `getYearOptions(3, 3)` |
| `ContadorPDFGenerator.tsx` | -2..+2 | `getYearOptions(3, 3)` |
| `ExcecoesPDFGenerator.tsx` | -2..+2 | `getYearOptions(3, 3)` |
| `CalendarioAniversariantesTab.tsx` | -2..+7 | `getYearOptions(2, 8)` |

### 4. Arquivos impactados pelos novos status

Todos que referenciam `statusLabels`, `statusColors`, ou comparam com `em_gozo`/`concluida`:

| Arquivo | Mudança |
|---------|---------|
| `FeriasFerias.tsx` | statusLabels/Colors + stats + condições de ação |
| `FeriasViewDialog.tsx` | statusLabels/Colors |
| `ConsultaGeralTab.tsx` | statusLabels/Colors + stats |
| `CalendarioFeriasTab.tsx` | comparações inline de status |
| `ContadorPDFGenerator.tsx` | labels de status |
| `FeriasDialog.tsx` | queries `.in("status", [...])` |
| `FormularioAnualDialog.tsx` | queries `.in("status", [...])` |
| `FeriasDashboard.tsx` | query de status + contagens |
| `GeradorFolgasDialog.tsx` | query de status |
| Migration SQL | Reescrever `atualizar_status_ferias` |

### 5. Proteção contra conflitos cross-ano

A query de conflitos no `FeriasDialog.tsx` já verifica por `colaborador_id` e status ativo. Os novos status (`em_gozo_q1`, `q1_concluida`, `em_gozo_q2`) devem ser incluídos nessas queries para que o sistema detecte corretamente quando um colaborador já tem férias ativas em qualquer ano.

### Detalhes técnicos

A mudança de status é feita via ALTER de valores possíveis no campo `status` (que é `text`, não enum), então não precisa de migration de schema -- apenas atualizar a função SQL e o código frontend.

