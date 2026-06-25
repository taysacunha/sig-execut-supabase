## Objetivo

Transformar a Central de Ajuda do Estoque em um guia realmente operacional. Hoje as abas mostram principalmente descrições do que cada área faz; vamos acrescentar **passo a passo detalhado**, **cenários práticos** e **FAQ** em todas as 12 abas.

## O que muda em cada aba

Para cada aba, manteremos o conteúdo descritivo atual e acrescentaremos três blocos visuais padronizados:

1. **Como fazer — passo a passo**
   - Sequência exata de cliques: menu lateral → botão → campos do formulário → confirmação.
   - Cada passo cita o rótulo real do botão/campo (ex.: "clique em Nova Placa", "preencha Quantidade", "selecione o Local").
2. **Cenários práticos**
   - 2 a 4 casos reais por aba, contados do início ao fim. Exemplos:
     - Placas: "Instalei uma placa 2x2 de Venda no imóvel X", "Placa foi roubada/extraviada", "Cliente devolveu placa de aluguel".
     - Saldos: "Recebi 50 placas novas do fornecedor", "Fiz contagem física e o saldo divergiu", "Transferi material entre depósitos".
     - Solicitações: "Colaborador pediu material e gestor aprovou", "Solicitação recusada por falta de saldo".
     - Movimentações: "Como exportar o histórico do mês".
3. **Perguntas frequentes (FAQ)**
   - 3 a 6 perguntas curtas por aba, em formato Accordion. Exemplos:
     - "Por que não consigo excluir um material?" → porque tem saldo/movimentação; use Inativar.
     - "Apaguei sem querer — dá para recuperar?" → consultar auditoria; restaurar manualmente.
     - "Placa baixada pode voltar a Disponível?" → não, status é definitivo.
     - "Por que o saldo da placa não bate com o que vejo em /estoque/placas?" → explicar relação Saldo ↔ unidades físicas.

## Abas cobertas

Visão Geral, Dashboard, Materiais, Categorias, Locais, Saldos, Placas, Solicitações, Movimentações, Notificações, Gestores e Usuários, Perfil e Segurança.

- **Visão Geral** ganha também um **Guia rápido de primeiros passos** (checklist único para quem nunca usou o sistema), reforçando o fluxo Categorias → Locais → Materiais → Saldos → Placas/Solicitações.
- **Placas** recebe atenção extra: explicação clara do fluxo Material (tipo Placa) → Saldo → unidades físicas em `/estoque/placas`, com cenários para cada status (Disponível, Instalada, Baixada) e para os filtros novos de tipo/uso/tamanho.

## Busca

A barra de busca atual continua funcionando. Vamos enriquecer as `keywords` de cada tópico com termos das novas perguntas do FAQ (ex.: "roubo", "extravio", "devolução", "exportar", "recuperar", "contagem", "divergência") para que a busca encontre os novos conteúdos.

## Detalhes técnicos

- Arquivo único alterado: `src/pages/estoque/EstoqueHelp.tsx`.
- Novos componentes locais auxiliares dentro do mesmo arquivo:
  - `HowTo` (passo a passo numerado com título).
  - `Scenario` (card de cenário com título + descrição + passos).
  - `Faq` (usa `Accordion` do shadcn `@/components/ui/accordion`).
- Importar `Accordion`, `AcordionItem`, `AccordionTrigger`, `AccordionContent` de `@/components/ui/accordion` (já existe no projeto).
- Sem alterações em rotas, sidebar ou em outras páginas de ajuda.
- Sem mudanças de schema, hooks, RLS ou lógica de negócio.

## Fora de escopo

- Vídeos, capturas de tela e tour interativo.
- Revisão das ajudas de Escalas, Férias e Vendas (já tratadas/listadas anteriormente).
- Qualquer mudança funcional nas páginas do sistema de Estoque.
