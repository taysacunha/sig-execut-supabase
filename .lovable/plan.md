## Objetivo

Reescrever `src/pages/despesas/DespesasHelp.tsx` transformando o guia atual — que só lista as abas — em um manual didático que explica **como o módulo funciona como um todo**, com foco especial em **centros de custo** (dúvida explícita do usuário).

## Estrutura da nova página

Cards em ordem de leitura, do conceito ao detalhe:

1. **Como o módulo funciona (visão geral)** — parágrafo de abertura com a "linha do tempo": cadastros → lançamentos → recorrências geram lançamentos → pagamentos mudam status → relatórios e calendário consomem → auditoria registra tudo.

2. **Centros de custo — o coração do módulo**
   - O que é: o "bolso" de onde sai / para onde entra o dinheiro (ex: Sede, Imóvel Nammos, Frota, Obra Rua X).
   - O que **não** é: não é fornecedor nem categoria contábil.
   - Para que serve: responder "quanto o Nammos gastou este mês?", "a Frota deu prejuízo?", isolar resultado por unidade.
   - Como aparece na prática: campo obrigatório em cada lançamento, filtro em Calendário e Relatórios, base das permissões.
   - Exemplo concreto com 2–3 centros e como um mesmo fornecedor pode aparecer em vários.

3. **Cadastros (a base)** — subitens curtos para Plano de contas, Categorias/Subcategorias, Contas bancárias, Pessoas, Imóveis, Veículos. Cada um em uma linha explicando função.

4. **Lançamentos** — ciclo de vida: previsto → pago (total/parcial) → atrasado. Papel do centro de custo e da conta bancária em cada lançamento.

5. **Recorrências e o agendador diário** — como o `despesas-scheduler` roda 06:00 BRT, materializa ocorrências e dispara notificações; edição isolada vs. série.

6. **Repasses** — fluxo aluguel recebido → encargos descontados → líquido ao proprietário.

7. **Permissões por aba + centros de custo** — reescrito com o modelo em cascata:
   - Acesso ao módulo (via /usuarios) é o portão.
   - Nível por aba diz **o que** a pessoa faz.
   - Centros permitidos dizem **o que** a pessoa enxerga (vazio = todos).
   - Exemplo: gerente do Nammos com nível "editar" em Calendário + centro "Imóvel Nammos" só vê/edita lançamentos daquele imóvel.

8. **Notificações, Duplicidade e Auditoria** — mantém o conteúdo atual, condensado, pois já está claro.

## Convenções

- Tom didático em PT-BR, mesmo tom da explicação que dei no chat.
- Sem emojis.
- Usar `Card` / `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` já importados.
- Usar `<ul className="list-disc pl-5 space-y-1">` para listas dentro de descrições, e `<b>` para destacar termos-chave.
- Sem novas dependências, sem mudanças de rota.

## Fora de escopo

- Nada de mudanças em outras páginas, hooks ou banco.
- Não gerar dados de exemplo (item recusado pelo usuário).
