## Objetivo

Criar uma página de Ajuda para o sistema de Férias e Folgas, no mesmo estilo do `Help.tsx` já existente em Plantões — com explicações detalhadas de cada módulo, passo a passo de cadastros, atualizações, visualizações e dicas de uso.

## Arquivos

**Novo:**
- `src/pages/ferias/FeriasHelp.tsx` — página com Tabs cobrindo cada área do módulo.

**Editados:**
- `src/App.tsx` — registrar lazy import e rota `/ferias/ajuda`.
- `src/components/FeriasSidebar.tsx` — adicionar item "Ajuda" no menu (ícone `HelpCircle`), visível para qualquer usuário com acesso ao sistema "ferias".

## Estrutura da página (abas)

Seguindo exatamente o padrão visual do `Help.tsx` de Plantões (Tabs + Cards + Alerts + Badges + ícones lucide, container `max-w-5xl`, tokens semânticos do design system):

1. **Visão Geral** — o que é o sistema, papéis (super_admin/admin/manager/supervisor/collaborator), fluxo recomendado de uso.
2. **Dashboard** — indicadores exibidos, como interpretar pendências e alertas.
3. **Colaboradores** — cadastro completo (campos obrigatórios, vínculo com unidade/setor/cargo/equipe), edição, visualização (botão olho), inativação, importação/aniversário, afastamentos.
4. **Estrutura** — abas Unidades, Setores, Cargos, Equipes: criar/editar/visualizar, vínculos entre entidades, regras de inativação.
5. **Períodos Aquisitivos e Férias** — como funcionam os períodos aquisitivos, geração automática, lançamento manual, redução de férias, exceções de períodos, quitação de período, validações de sobreposição/conflitos, gerador em lote.
6. **Folgas de Sábado** — gerador de folgas, mover folga (individual e em lote), trocar, perda de folga, remover, impressão/PDF, quadro de setores nos sábados.
7. **Calendário** — abas de férias, folgas e aniversariantes; visão Gantt; filtros.
8. **Aniversariantes** — listagem, geração de PDF padrão e versão "celebre".
9. **Relatórios** — Consulta Geral, Contador, Exceções, Formulário Anual; exportação PDF.
10. **Créditos** — créditos de férias e folgas, como utilizar, regras de prescrição.
11. **Configurações** — abas Quinzenas, Feriados, Folgas, Regras, Avançado.
12. **Perfil, Usuários e Auditoria** — alteração de senha, gestão de acessos, leitura dos logs (com os filtros novos de data/módulo/limite).

Cada aba terá: descrição da funcionalidade, passo a passo numerado ("Como cadastrar", "Como editar", "Como visualizar"), `Alert` com dicas/avisos importantes, e referência aos botões/ícones reais da interface.

## Notas técnicas

- 100% frontend, sem alterações de schema, RLS ou lógica de negócio.
- Reutilizar componentes shadcn já usados em `Help.tsx` (Card, Tabs, Alert, Badge, Separator).
- Conteúdo em PT-BR.
- Antes de escrever cada aba, vou consultar rapidamente os componentes/diálogos correspondentes em `src/components/ferias/**` e as páginas em `src/pages/ferias/**` para descrever fielmente os campos, botões e fluxos reais — evitando inventar funcionalidades.
