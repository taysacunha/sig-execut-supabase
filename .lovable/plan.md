

## Plano: evitar folga no mesmo sábado para mesmo setor + setores substitutos

### Causa raiz

No `GeradorFolgasDialog.tsx`:

1. **Setores substitutos são carregados mas nunca usados.** A query `setoresSubstitutos` (linhas 254–264) traz `ferias_colaborador_setores_substitutos`, mas o array nunca aparece no algoritmo. Resultado: se Jesus é titular do Setor A e Gabriella é substituta do Setor A (titular em outro setor), o algoritmo não os enxerga como "mesmo setor" e pode colocá-los no mesmo sábado.
2. **Setores grandes (units > nº de sábados) não evitam empilhar pessoas do mesmo setor no mesmo sábado quando há alternativa melhor.** A ordenação dos sábados candidatos só usa `globalPersonCount`; não considera quantas pessoas daquele setor já estão alocadas naquele sábado.
3. **Rebalanceamento (linha 714–718) só protege `setoresRestritos`.** Para setores grandes ele aceita mover criando concentração no mesmo setor.

### Mudanças

**Arquivo único**: `src/components/ferias/folgas/GeradorFolgasDialog.tsx`

#### 1. Incluir setores substitutos no `allSetorIds` de cada `AllocationUnit`
Construir um mapa `colabId -> Set<setorId>` que une `setor_titular_id` + todos os `setor_id` de `ferias_colaborador_setores_substitutos`. Ao criar units (linhas 480–510), preencher `allSetorIds` com a união de **todos os setores (titular + substitutos)** de **todos os membros**. Isso faz o `sectorSaturdayCount` rastrear cada colaborador em todos os setores onde ele atua, então o filtro `satsSemSetor` passa a evitar conflitos com colegas substitutos.

#### 2. Adicionar tiebreaker de sector-density em todos os ordenamentos de candidatos
Onde hoje há `.sort((a, b) => globalPersonCount[a] - globalPersonCount[b])` (passos 6A, 6B, 7 e 8), passar a usar critério composto:
- 1º: somatório de `sectorSaturdayCount[sid][sat]` para todos os `sid` em `unit.allSetorIds` (menor primeiro — evita empilhar mesmo setor)
- 2º: `globalPersonCount[sat]` (menor primeiro)
- 3º: data (estabilidade)

Assim, mesmo em setores grandes, o algoritmo prefere um sábado sem ninguém do mesmo setor quando existe um.

#### 3. Estender a proteção do rebalanceamento (linhas 714–718) a TODOS os setores
Trocar `if (setoresRestritos.includes(sid))` por uma checagem que também bloqueia mover para um sábado quando isso aumentaria a densidade do setor além do mínimo necessário — exceto quando a origem do movimento já tinha o mesmo setor duplicado (mover para corrigir desbalanço continua permitido).

#### 4. Diagnóstico
Adicionar à `diagnostics` um aviso quando uma alocação teve que ser feita em sábado que já tinha alguém do mesmo setor (porque não havia alternativa). Isso aparece em `diagnosticMessage` no preview, sinalizando ao usuário onde o algoritmo foi forçado a aceitar empilhamento.

### Notas técnicas
- A tabela `ferias_colaborador_setores_substitutos` tem `colaborador_id` e `setor_id` (já visto na useful-context). Construo `Map<string, Set<string>>` colabId → setIds substitutos uma vez no início de `handleGeneratePreview`.
- `unitsBySetorId` (linha 514) já itera `unit.allSetorIds`, então automaticamente passa a indexar a unit em todos os setores substitutos sem outras mudanças.
- A classificação `setoresRestritos` vs `setoresGrandes` continua válida: passa a contar a unit também nos setores onde ela é apenas substituta (mais conservador, é o comportamento esperado).
- Não há mudanças de schema, RLS ou query — apenas lógica do gerador.

### Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/ferias/folgas/GeradorFolgasDialog.tsx` | Incluir substitutos em `allSetorIds`; reordenar candidatos por densidade-de-setor + global; estender proteção do rebalanceamento; diagnóstico de empilhamento |

