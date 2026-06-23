## Ajustes nos dialogs de PDF

### 1. Remover motivos legados do PDF de Afastamentos
Arquivo: `src/components/ferias/colaboradores/AfastamentosPDFGenerator.tsx`

Tirar `acidente`, `doenca` e `licenca_medica` da constante `MOTIVO_LABELS` (e consequentemente do filtro `MOTIVO_OPTIONS`). Esses valores continuam mapeados apenas no fallback durante a renderização da célula "Motivo" do PDF, via expressão local — se aparecerem em registros antigos, mostram o rótulo amigável; mas não poluem mais o seletor.

### 2. Corrigir scroll nos popovers (Colaboradores e Motivos)
Causa: o `CommandList` do shadcn vem com `max-h-[300px] overflow-y-auto`, porém o `PopoverContent` em volta não está marcado como `onWheel`-friendly em alguns navegadores quando o conteúdo interno tenta scroll. O sintoma "não sobe/desce com a roda do mouse" geralmente acontece porque o `CommandList` recebe a roda mas o elemento não tem altura limitada nesse contexto (lista curta de motivos cabe inteira, lista de colaboradores estoura) e/ou o `PopoverContent` consome o evento.

Correções:
- Em ambos os dialogs (`AfastamentosPDFGenerator.tsx` e `PerdasFolgaPDFGenerator.tsx`), adicionar `className="max-h-72 overflow-y-auto overscroll-contain"` ao `CommandList`, garantindo área rolável explícita.
- Adicionar `onWheel={(e) => e.stopPropagation()}` no `PopoverContent` para impedir que o Radix bloqueie o evento da roda quando o popover está dentro de outro Dialog (caso comum com Radix focus scope).

Sem mudanças de banco, tipos, RLS ou outras telas.