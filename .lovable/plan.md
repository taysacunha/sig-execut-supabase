# Corrigir a página de Ajuda de Despesas

A Ajuda atual (`src/pages/despesas/DespesasHelp.tsx`) descreve funcionalidades que **não existem** no sistema. Vou reescrevê-la para refletir exatamente o que está implementado hoje, conferindo cada afirmação contra o código real antes de escrever.

## Erros confirmados na Ajuda atual

Comparando `DespesasHelp.tsx` com o código real:

1. **"No Calendário, use Montar repasse"** — falso. O botão `Montar repasse` só existe em `/despesas/repasses` (`DespesasRepasses.tsx` linha 99). `DespesasCalendario.tsx` só tem os botões **Nova receita**, **Nova despesa**, **Exportar CSV**, além de ações por linha (Pagar, Editar, Cancelar, Excluir, Estornar).
2. **"Marcar como pago cria o lançamento correspondente no Calendário"** — precisa validar contra o hook do repasse; a Ajuda afirma isso sem base clara.
3. **Aba "Imóveis" no diálogo de repasse** — na verdade a aba se chama **"Imóveis & inquilinos"** (`RepasseDialog.tsx`).
4. **Páginas que a Ajuda esquece** que existem no sidebar (`DespesasSidebar.tsx`): **Dashboard** (`/despesas`), **Notificações** (`/despesas/notificacoes`, com aba própria), **Relatórios** (`/despesas/relatorios`), **Perfil** (`/despesas/perfil`), **Usuários** admin (`/despesas/usuarios`).
5. **"Notificações → Preferências"** — a página é a inteira `/despesas/notificacoes`; "Preferências" é só o card interno.

## O que vou fazer

**Arquivo único a alterar:** `src/pages/despesas/DespesasHelp.tsx`.

Antes de reescrever, vou reler os arquivos abaixo para garantir que cada frase da Ajuda corresponda ao que existe:

- `DespesasSidebar.tsx` — lista canônica de páginas/rotas.
- `DespesasDashboard.tsx`, `DespesasCalendario.tsx`, `DespesasRecorrencias.tsx`, `DespesasNotificacoes.tsx`, `DespesasImoveis.tsx`, `DespesasRepasses.tsx`, `DespesasCadastros.tsx`, `DespesasRelatorios.tsx`, `DespesasPermissoes.tsx`, `DespesasAuditLogs.tsx`.
- `LancamentoDialog.tsx`, `RepasseDialog.tsx`, `ImovelDialog.tsx`, `PessoaDialog.tsx` — para descrever com precisão campos, abas e regras (referências obrigatórias, competência mês/ano, duplicidade, beneficiários, etc.).

## Nova estrutura da Ajuda (abas)

Uma aba por página real do sidebar, na mesma ordem, mais uma "Visão geral" e um FAQ. Cada aba com "O que a página faz", "Passo a passo" e "Regras / atalhos".

1. **Visão geral** — fluxo do módulo, centro de custo, cascata de permissões.
2. **Dashboard** — o que os KPIs mostram.
3. **Calendário** — botões que realmente existem: Nova receita, Nova despesa, Registrar pagamento, Editar, Cancelar, Excluir, **Estornar** (com justificativa ≥10 caracteres para reverter `pago`/`quitado`/`gimob`). **Sem** menção a "Montar repasse".
4. **Recorrências** — periodicidade, gerar com antecedência (meses), Renovar, encerrar por data-fim/desativar; scheduler 06:00 BRT.
5. **Notificações** — dias de antecedência, alerta de vencidos, sino.
6. **Imóveis** — RIP, inscrição municipal, situação (inclui "Em aquisição"), encargos, credenciais, duplicidade com justificativa.
7. **Repasses** — único lugar onde se monta repasse. Passo a passo com exemplo de R$ 30.000: **Montar repasse** → escolher proprietário/mês/CC → aba **Itens** (Crédito Aluguel + Débitos) → aba **Beneficiários** (soma ≤ líquido, botão Restante) → aba **Imóveis & inquilinos** (informativa) → **Marcar como pago**. Exportação XLSX.
8. **Cadastros** — Plano de contas, Categorias (sem subcategoria), Centros de custo, Contas bancárias, **Pessoas** (papéis: Proprietário, Inquilino, Empresa, Fornecedor, Prestador de Serviço, Beneficiário, Motorista, Outro com texto), Veículos.
9. **Relatórios** — filtros, gráficos Recharts, exportação XLSX, respeita permissões.
10. **Permissões & Usuários & Auditoria** — cascata de acesso, ações em lote por aba, restrições do perfil Admin, auditoria humanizada.
11. **FAQ** — só perguntas cujas respostas realmente correspondem ao sistema atual.

## Verificação após edição

- `tsgo` para garantir tipos.
- Abrir `/despesas/ajuda` no preview e conferir que cada botão/campo citado existe na página correspondente (checagem visual em pelo menos Calendário, Repasses e Recorrências).

## Detalhes técnicos

- Manter `Tabs` do shadcn e a estrutura de `Card`/`CardHeader`/`CardContent` já usada.
- Sem novas dependências, sem mudanças em rotas ou banco de dados.
- Container `max-w-5xl`, mesmo padrão visual atual.
