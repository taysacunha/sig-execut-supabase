## Problema

No diálogo **Nova saída para imóvel** (`src/components/estoque/placas/NovaSaidaDialog.tsx`):

1. Aparecem campos **Tipo de uso** e **Tamanho** editáveis. Isso é incorreto: esses atributos pertencem ao material-placa selecionado e devem ser apenas exibidos como informação (read-only), nunca alterados na saída. Alterá-los cria inconsistência entre a placa física e o material.
2. O select **Código da placa** mostra opções mesmo quando não há nenhum código cadastrado para o material/local — porque a lista `disponiveis` filtra por `tipo_uso`/`tamanho` que o usuário pode ter mudado, e/ou porque placas antigas com atributos inferidos passam pelo filtro.

## Correções

### 1. Remover edição de tipo de uso / tamanho no NovaSaidaDialog
- Remover os `<Select>` de tipo de uso e tamanho e o input de "tamanho outro" do formulário.
- Manter os estados internos (`tipoUso`, `tamanho`, `tamanhoOutro`) preenchidos automaticamente por `syncAttributesFromMaterial` a partir do material selecionado (via `resolvePlacaAttributes`), sem UI editável.
- Exibir os atributos como texto informativo abaixo do material selecionado (ex.: "Aluga · 2x2"), apenas leitura.
- Ao criar novo código (modo "novo"), usar os atributos do material — não do formulário.

### 2. Corrigir lista de códigos disponíveis
- `disponiveis` deve filtrar estritamente por `material_id` + `local_armazenamento_id` + `status='disponivel'`. Como tipo/tamanho vêm do próprio material, o cruzamento por esses campos vira redundância e será removido do filtro.
- Quando `disponiveis.length === 0`, esconder o Select (ou desabilitar com placeholder claro "Nenhum código disponível — crie um novo") e forçar o modo "novo".
- Ajustar o rótulo do radio "Selecionar disponível (N)" para refletir a contagem real após o filtro corrigido.

### 3. Validação
- Testar com material `Placa Aluga 2x2 Lona`: abrir Nova saída → confirmar que tipo/tamanho aparecem só como texto, e que o select de código está vazio quando não há placa cadastrada, oferecendo criar novo código.

## Arquivos

- `src/components/estoque/placas/NovaSaidaDialog.tsx` (única alteração — UI + filtro de `disponiveis`).

Sem mudanças de banco, hooks ou outras telas.