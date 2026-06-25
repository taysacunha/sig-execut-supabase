## Objetivo

Aplicar o padrão criado para a Central de Ajuda do Estoque às demais páginas de ajuda do sistema:

- `src/pages/Help.tsx` — Escalas
- `src/pages/ferias/FeriasHelp.tsx` — Férias

## Padrão a replicar

Mesmo conjunto de elementos usado no Estoque:

1. **Cabeçalho** com ícone `HelpCircle`, título "Central de Ajuda" e subtítulo descrevendo o sistema.
2. **Barra de busca** com ícone `Search`, normalização sem acento, índice `topics` (label + keywords + description) e dropdown de resultados que troca a aba ativa via estado controlado (`activeTab`).
3. **Tabs controladas** (`value` + `onValueChange`) iguais às atuais — sem alterar quais abas existem em cada página.
4. **Componentes auxiliares locais** (mesma assinatura usada no Estoque):
  - `Step` / `Bullets`
  - `HowTo` — passo a passo numerado dentro de bloco destacado.
  - `Scenario` — cenário prático (título + contexto opcional + passos).
  - `Faq` — accordion (`@/components/ui/accordion`) com perguntas e respostas.
5. **Conteúdo de cada aba** ganha, além da descrição atual:
  - 1 a 3 blocos `HowTo` (passo a passo com cliques reais nos botões/campos da tela).
  - 1 a 3 blocos `Scenario` cobrindo casos comuns do dia a dia daquele módulo.
  - 1 bloco `Faq` com 3 a 6 perguntas frequentes.

O texto descritivo, as `Alert`s e os badges já existentes são preservados — só adicionamos os blocos novos.

## Páginas e cobertura

### `src/pages/Help.tsx` (Escalas)

Manter todas as abas atuais. Para cada uma, acrescentar HowTo + Scenario + FAQ. Foco extra em:

- **Escala / Alocação** — regras de prioridade, validações, conflitos.
- **Corretores** — cadastro, inativação, vínculo de unidade.
- **Vendas** (se existir a aba) — registro de venda, visibilidade de VGV.
- **Notificações, Perfil e Auditoria** — mesmo padrão simplificado.

### `src/pages/ferias/FeriasHelp.tsx` (Férias)

Manter todas as abas atuais. Acrescentar HowTo + Scenario + FAQ, com foco em:

- **Período aquisitivo / vesting** — como o sistema calcula.
- **Solicitar férias** — passo a passo do colaborador.
- **Aprovação** — fluxo do gestor.
- **Validação cronológica** — explicar erros comuns.
- **Afastamentos e contabilização** — cenários do RH.

### Conteúdo do FAQ

As perguntas serão extraídas de situações reais já tratadas no código (validações, alerts, bloqueios) e de dúvidas operacionais típicas — sem inventar comportamento que o sistema não tenha.

## Detalhes técnicos

- Apenas dois arquivos alterados: `src/pages/Help.tsx` e `src/pages/ferias/FeriasHelp.tsx`.
- Reuso do componente `Accordion` do shadcn (`@/components/ui/accordion`), já presente no projeto.
- `useState` para `activeTab` e `searchQuery`, `normalize` igual ao do Estoque.
- Sem alterações em rotas, sidebars, hooks, schema, RLS ou lógica de negócio.
- Sem mudanças no Estoque (já está pronto).

## Fora de escopo

- Criar página de ajuda para Vendas (não existe; permanece como item pendente em `.lovable/plan.md`).
- Tour interativo, vídeos ou capturas de tela.
- Refatorar o conteúdo descritivo já existente além do necessário para encaixar os novos blocos.

## Antes de executar

Para o conteúdo das novas seções fazer sentido sem inventar comportamento, ao implementar irei reler rapidamente as duas páginas atuais e os hooks/serviços principais de cada módulo (`useEscala*`, `useFerias*`) para extrair os passos reais. Nenhuma lógica será modificada.

Crie também em vendas. Todos os sistemas devem ter a página de ajuda. Entendido?