## Objetivo

Reescrever `src/pages/despesas/DespesasHelp.tsx` para refletir tudo que mudou nas últimas iterações e virar um **manual passo a passo** para o usuário final — não só descrição conceitual.

Muitas dúvidas recentes (onde entra o valor do aluguel no repasse, para que serve "antecipar", como funcionam as referências do lançamento, o que muda ao marcar duplicidade) **não estão** hoje na página, ou estão desatualizadas.

## Estrutura nova da página

Duas partes bem separadas:

### Parte 1 — Como o módulo funciona (conceito, mantido/atualizado)

- Visão geral do fluxo (mantida).
- Centros de custo (mantido).
- Cadastros — **atualizar**: remover "Subcategorias" da lista (foi removido do sistema); atualizar Pessoas mencionando papéis novos (Proprietário, Inquilino, Empresa (ex-Loja), Fornecedor, Prestador de Serviço, Beneficiário, Outro com descrição livre); Imóveis mencionando RIP (ex-Matrícula) e status "Em aquisição", "Desocupado" (ex-Vago), "Alugado", "Próprio", "Em obra", "Gimob", "Quitado"; Credenciais em área isolada.
- Permissões em cascata (mantido).
- Perfis de acesso (mantido).

### Parte 2 — Passo a passo (nova, o "instruções para o usuário")

Cards curtos, numerados, com o exato caminho de cliques. Um card por tarefa comum:

1. **Cadastrar uma pessoa** — passos + aviso de duplicidade CPF/CNPJ (lista os semelhantes e pede justificativa ≥10 caracteres para prosseguir).
2. **Cadastrar um imóvel** — RIP, inscrição municipal, encargos, status; duplicidade por código ou inscrição municipal com justificativa.
3. **Lançar uma conta a pagar/receber** —
   - Competência agora é **Mês/Ano** (não data completa).
   - **Valor total é opcional** (você pode registrar só o compromisso e informar valores nos pagamentos).
   - "Subcategoria" **não existe mais**.
   - **Referências obrigatórias (pelo menos uma)**: Nº de Pasta, Cód. Venda, Imóvel ou Pessoa — pode preencher várias ao mesmo tempo.
   - Registrar pagamento: aceita parciais; status vira "pago" só quando quita.
4. **Criar uma recorrência** —
   - "Gerar com antecedência (meses)" = com quantos meses de antecedência as próximas ocorrências já aparecem no Calendário (não é o aviso da notificação, isso é outra config).
   - Fim da série: use "data fim" ou desative.
   - Botão **Renovar** em séries encerradas prorroga por mais X meses.
5. **Fazer um repasse ao proprietário** — passo a passo detalhado, respondendo diretamente à dúvida do usuário:
   - (a) Vá em **Despesas → Repasses → Novo repasse** (ou use "Montar repasse" a partir do Calendário para consolidar automaticamente lançamentos existentes).
   - (b) Escolha proprietário, mês e centro de custo.
   - (c) Na aba **Itens** adicione um crédito Origem=Aluguel com o valor recebido (ex.: R$ 30.000) — pode vincular ao imóvel. Adicione débitos (encargos, taxa, ajustes) se aplicável.
   - (d) Bruto − Taxa admin = **Líquido** (recalcula automaticamente).
   - (e) Na aba **Beneficiários** distribua o líquido entre uma ou mais pessoas (proprietário, cônjuge, procurador). Botão "Restante" preenche o saldo. A soma não pode passar do líquido.
   - (f) A aba **Imóveis** é informativa: mostra os imóveis do proprietário e seus inquilinos (edite no cadastro do imóvel).
   - (g) **Marcar como pago** gera o lançamento correspondente no Calendário automaticamente.
6. **Configurar suas notificações** — Preferências, dias de antecedência, alerta de vencidos, sino no topo.
7. **Consultar auditoria** — quem fez, o quê, quando, com diff humanizado.
8. **Gerenciar permissões por aba** — abas, seleção múltipla, ações em lote, centros permitidos (vazio = todos).

### Parte 3 — Perguntas frequentes (nova)

Curta, com as dúvidas reais:

- "Onde coloco o valor do aluguel no repasse?" → aba Itens, crédito Origem=Aluguel.
- "Preciso preencher o valor total do lançamento?" → Não; é opcional.
- "Sumiu Subcategoria?" → Sim, removida.
- "Salvei e apareceu alerta de duplicidade — e agora?" → Confirme se é diferente e justifique.
- "Como o admin enxerga só os usuários dele?" → Vê apenas quem tem os mesmos módulos habilitados e não pode desativar/excluir.

## Arquivos afetados

- `src/pages/despesas/DespesasHelp.tsx` — reescrita completa.

Sem mudanças em outros arquivos, sem migrations, sem alteração de comportamento. É só documentação.
