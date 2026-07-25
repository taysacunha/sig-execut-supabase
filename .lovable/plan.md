## Objetivo

Reorganizar `src/pages/despesas/DespesasHelp.tsx` em abas, preservando todo o conteúdo atual (Parte 1 conceitos, Parte 2 passo a passo, Parte 3 FAQ), mas dividindo por página/módulo do sistema para facilitar a navegação.

## Estrutura de abas proposta

Usar o componente `Tabs` do shadcn com uma `TabsList` no topo e o cabeçalho da página mantido acima.

1. **Visão geral** — introdução + "Como o módulo funciona" + centros de custo + papéis de pessoas + status/RIP de imóveis + restrições de Admin.
2. **Cadastros** — planos, categorias, centros de custo, contas, pessoas, imóveis, veículos (conceito + passo a passo de cadastro + alerta de duplicidade).
3. **Calendário / Lançamentos** — conceito de lançamento, competência mês/ano, valor opcional, referências obrigatórias (Pasta, Venda, Imóvel, Pessoa), passo a passo de novo lançamento e baixa de pagamento.
4. **Recorrências** — como criar, campo "Gerar com antecedência", renovação de séries encerradas, execução diária às 06:00.
5. **Repasses** — fluxo do aluguel de R$ 30.000, abas Beneficiários / Itens / Imóveis & inquilinos, regra de baixa exigindo beneficiário.
6. **Relatórios** — filtros, exportação Excel, gráficos.
7. **Permissões & Auditoria** — permissões por aba/CC, ações em lote, log humanizado.
8. **FAQ** — Parte 3 atual mantida integralmente.

## Regras de implementação

- Somente ajuste estrutural/visual na página `DespesasHelp.tsx`; nenhum outro arquivo é tocado.
- Reaproveitar os `Card`s existentes; apenas movê-los para dentro do `TabsContent` correspondente.
- `TabsList` responsiva com `flex-wrap` para caber em telas menores.
- Aumentar o container para `max-w-5xl` para acomodar as abas com folga.
- Manter textos em PT-BR e sem emojis.

## Validação

Abrir `/despesas/ajuda` e alternar entre as abas para conferir que todo o conteúdo antigo continua acessível e agrupado pelo módulo correspondente.
