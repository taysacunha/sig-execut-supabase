## Ajustes no atesto de recebimento (premiação)

### Comportamento desejado
1. **Desmarcar atesto**: ao clicar no checkbox marcado, abrir `AlertDialog` de confirmação ("Deseja desmarcar o atesto de recebimento? Esta ação removerá a data e o usuário responsáveis."). Confirmando, executar `setRecebimento({ confirmado: false })`.
2. **Editar premiação**: o botão "Editar" (lápis) fica **desabilitado** enquanto `recebimento_confirmado === true`. Tooltip: "Desmarque o atesto para editar".
3. **Apagar premiação**: o botão "Apagar" continua habilitado independentemente do atesto (mantendo apenas a regra existente de "apagar o 2º antes do 1º"). Mantém o `AlertDialog` de confirmação atual.

### Alterações em arquivos

**`src/components/ferias/ferias/PremiacaoSubRow.tsx` (RecebimentoCell)**
- Quando `recebimento_confirmado` for `true`:
  - Remover o `Popover` de editar data / botão "Remover" interno.
  - Renderizar o `Checkbox` marcado dentro de um `AlertDialog`. Ao clicar (`onCheckedChange` → false), abrir o dialog de confirmação.
  - Continuar mostrando a data e o nome ao lado do checkbox (texto não clicável, sem popover).
  - Confirmando, chamar `onRemover()`.
- Quando não confirmado: comportamento atual (popover para atestar) mantido.

**`src/pages/ferias/FeriasFerias.tsx`** (linha ~1150)
- Adicionar `disabled={!canEditFerias || p.recebimento_confirmado}` no botão "Editar".
- Ajustar `title` para "Desmarque o atesto para editar" quando atestado.
- Botão "Apagar": remover dependência do atesto (já não tem); manter apenas `canDelete` para regra 1º/2º. `AlertDialog` permanece.

### Não muda
- Hook `useSetRecebimentoPremiacao` (já suporta `confirmado: false`).
- Cálculo, PDF, badges, coluna de exportação.
