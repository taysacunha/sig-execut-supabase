Plano para corrigir o filtro “Aluga” na página de Placas:

1. Ajustar a fonte de dados dos saldos de placas
   - Refazer a consulta de `estoque-saldos-placas` para não depender de um filtro em memória frágil.
   - Buscar os saldos e cruzar com materiais ativos de placa de forma consistente, garantindo que materiais recém-criados como `Placa Aluga 2x2 Lona` entrem no resumo.
   - Garantir que materiais com `tipo_uso`/`tamanho` nulos ainda sejam classificados pelo nome como fallback.

2. Corrigir o comportamento do filtro “Tipo de uso”
   - Aplicar o filtro “Aluga” corretamente no bloco superior “Saldos por material e local”.
   - Manter o filtro também no bloco inferior de unidades físicas, mas deixar claro que ele lista apenas placas individualizadas/codificadas.

3. Tratar a brecha entre saldo agregado e placa física
   - Hoje, adicionar saldo em `Saldos` aumenta `estoque_saldos`, mas não cria automaticamente linhas individuais em `estoque_placas`.
   - Vou ajustar a página para que o usuário enxergue o saldo agregado filtrado por “Aluga” mesmo que ainda não existam placas físicas/códigos cadastrados.
   - Se não houver unidades físicas no bloco inferior, a mensagem será mais clara: existe saldo, mas ainda não há placas individualizadas para listar.

4. Sincronizar invalidações de cache
   - Completar as invalidações relacionadas a placas/saldos após entrada, ajuste, transferência, saída e atribuição de código.
   - Incluir `estoque-saldos-placas`, `estoque-materiais-placa` e `estoque-placas` onde necessário para evitar a tela ficar desatualizada após navegar entre Saldos, Materiais e Placas.

5. Validar o fluxo afetado
   - Conferir o cenário: material `Placa Aluga 2x2 Lona` ativo, saldo positivo cadastrado, página Placas com filtro `Tipo de uso = Aluga`.
   - Resultado esperado: o saldo agregado aparece no bloco superior; se não houver unidade física, o bloco inferior informa isso de forma explícita em vez de parecer que a placa “sumiu”.

Detalhes técnicos:
- Arquivos principais: `src/pages/estoque/EstoquePlacas.tsx`, `src/pages/estoque/EstoqueSaldos.tsx`, `src/components/estoque/placas/NovaSaidaDialog.tsx` e `src/components/estoque/placas/AtribuirCodigoDialog.tsx`.
- Não pretendo alterar banco de dados neste passo; a correção é de consulta, filtro e sincronização da UI.