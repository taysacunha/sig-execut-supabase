

## Correção: Controle granular do envio ao contador

### Problema
Quando Q1 é enviada, `enviado_contador` vira `true` e o botão muda para "Enviado" — como se tudo tivesse sido enviado. Ao clicar novamente, só aparece opção de desmarcar, sem permitir enviar Q2. Falta um estado parcial visível e um diálogo inteligente.

### Solução

Reescrever a lógica do botão e do diálogo na coluna "Enviado" da aba Contador em `FeriasFerias.tsx`:

**1. Três estados visuais no botão:**
- **Totalmente pendente** (Q1○ Q2○) → ícone Send, texto "Pendente", cor cinza
- **Parcialmente enviado** (Q1✓ Q2○ ou Q1○ Q2✓) → ícone Clock, texto "Parcial", cor amarela/laranja — indicando que ainda há período pendente
- **Totalmente enviado** (Q1✓ e Q2✓, ou Q1✓ sem Q2) → ícone CheckCircle2, texto "Enviado", cor verde

**2. Diálogo inteligente com ações contextuais:**
Em vez de um diálogo fixo "mark" ou "unmark", o diálogo mostra **checkboxes** por período, permitindo marcar E desmarcar no mesmo diálogo:
- Cada período aparece com checkbox (checked = já enviado)
- Usuário pode marcar Q2 sem desmarcar Q1, ou desmarcar Q1 sem afetar Q2, ou marcar/desmarcar ambos
- Texto descritivo mostra datas de cada período
- Botão "Salvar" aplica o estado selecionado

**3. Arquivo modificado:**
`src/pages/ferias/FeriasFerias.tsx` — reescrever linhas 883-932 (botão/badges) e 960-1034 (diálogo), substituindo RadioGroup por Checkboxes e eliminando a bifurcação mark/unmark.

