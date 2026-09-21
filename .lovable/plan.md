# Fechar pendências de Imóveis, duplicidades e calendário de Veículos

## Resultado esperado

- O card de imóveis alugados sem inquilino contará somente imóveis ativos e abrirá a página já filtrada exatamente nesses registros. Nos dados atuais, o número correto passará de **7 para 4**, pois três dos sete estão inativos.
- A busca de imóveis encontrará tanto pela descrição quanto pelo código.
- RIP deixará de ser tratado como obrigatório para todo imóvel: cada cadastro terá **Sim / Não / Não informado**.
- O painel separará pendências de **inscrição municipal** e **situação do RIP**, sem somar condições diferentes em um único número enganoso.
- O aviso de possíveis duplicidades será clicável, filtrará apenas os lançamentos envolvidos e poderá ser limpo.
- O usuário poderá marcar um par/grupo como “não é duplicidade” somente com justificativa; a decisão ficará registrada e o aviso desaparecerá automaticamente.
- Encargos de veículos sem valor serão criados como pendentes sem valor e aparecerão no calendário.

## Implementação

### 1. Pendências e busca de imóveis

- Corrigir as contagens do dashboard para usar o mesmo universo da página: apenas imóveis ativos.
- Criar links com filtros explícitos, como “alugado sem inquilino”, e fazer a página de imóveis ler esses filtros ao abrir.
- Mostrar o filtro vindo do dashboard de forma visível e oferecer “Limpar filtro”.
- Alterar a busca para consultar `descricao` **ou** `codigo`.

### 2. RIP e inscrição municipal

- Adicionar ao imóvel a situação do RIP: `possui`, `nao_possui` ou `nao_informado`.
- Migrar automaticamente imóveis que já têm RIP preenchido para `possui`; os demais permanecem `nao_informado`, sem presumir que não possuem.
- No formulário, exibir “Possui RIP?” e exigir o número somente quando a resposta for “Sim”.
- Substituir a pendência atual “sem RIP ou inscrição municipal” por itens independentes:
  - imóveis ativos sem inscrição municipal;
  - imóveis ativos com situação do RIP ainda não informada;
  - imóveis marcados como “Não” não serão tratados como pendentes de RIP.

### 3. Duplicidades revisáveis

- Criar um registro específico de revisão para cada par de lançamentos considerado duplicado, com justificativa, usuário e data.
- Proteger esses registros pelas mesmas permissões e centros de custo do Calendário; visualizar calendário permite consultar revisões, e editar calendário permite justificá-las.
- Unificar a exclusão de pares já revisados tanto no aviso do calendário quanto na verificação feita no formulário de lançamento.
- Transformar o aviso em filtro clicável, exibir somente os possíveis duplicados e oferecer “Limpar filtro”.
- Adicionar a ação “Não é duplicidade”, com confirmação e justificativa obrigatória. Após salvar, recalcular a lista e ocultar automaticamente o aviso quando não restarem casos.

### 4. Encargos do Fiat 500 e demais veículos

- Corrigir a mensagem enganosa do gerador. Hoje o Fiat 500 OFA 7777 possui três documentos ativos, todos com valor `0,00`; a função ignora esses documentos e retorna zero como se já estivessem gerados. Não há lançamentos desse veículo no banco.
- Alterar a geração para criar lançamentos com valor pendente (`sem valor`) quando o documento estiver zerado, conforme escolhido.
- Manter a prevenção de duplicidade por veículo, tipo, ano e parcela.
- Garantir que quem pode visualizar **Veículos** também possa ver no calendário da própria página os lançamentos dos veículos e centros permitidos, sem exigir acesso à página geral de Calendário ou Cadastros.
- Retornar um resultado claro após gerar: quantos foram criados, quantos já existiam e quantos ficaram sem valor.

### 5. Validação e histórico

- Conferir os links e filtros do dashboard, busca por código, estados do RIP e limpeza de filtros.
- Testar criação e revisão de duplicidades, inclusive desaparecimento do aviso.
- Gerar novamente o seguro/IPVA/licenciamento do OFA 7777 e confirmar os itens no calendário anual, inclusive sem valor.
- Validar permissões com perfis que têm Veículos, mas não Cadastros/Calendário geral.
- Registrar a entrega no histórico `/dev`.

## Detalhes técnicos

- Alterações estruturais serão aplicadas por migração no Supabase, com permissões explícitas e RLS.
- A revisão de duplicidade será por par canônico de lançamentos, evitando que dispensar um caso esconda futuras duplicidades reais do mesmo lançamento.
- A função de geração de encargos passará a aceitar `valor_total = null` quando o documento estiver zerado e manterá o vínculo `veiculo_id`.
- Consultas, cartões e tabelas continuarão respeitando o escopo de centros de custo do usuário.
