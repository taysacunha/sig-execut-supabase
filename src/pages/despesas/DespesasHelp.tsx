import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DespesasHelp() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ajuda — Despesas</h1>
        <p className="text-muted-foreground">
          Manual do módulo dividido por página do menu lateral. Cada aba descreve exatamente o
          que existe naquela tela — botões, campos e regras — nada além disso.
        </p>
      </div>

      <Tabs defaultValue="visao" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto justify-start">
          <TabsTrigger value="visao">Visão geral</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="calendario">Calendário</TabsTrigger>
          <TabsTrigger value="recorrencias">Recorrências</TabsTrigger>
          <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
          <TabsTrigger value="imoveis">Imóveis</TabsTrigger>
          <TabsTrigger value="repasses">Repasses</TabsTrigger>
          <TabsTrigger value="cadastros">Cadastros</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
          <TabsTrigger value="permissoes">Permissões, Usuários & Auditoria</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
        </TabsList>

        {/* Visão geral */}
        <TabsContent value="visao" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Como o módulo funciona</CardTitle>
              <CardDescription>
                O fluxo é sempre o mesmo: você monta os <b>cadastros</b> (planos, categorias,
                centros de custo, contas, pessoas, imóveis, veículos), lança contas a pagar/receber
                no <b>Calendário</b>, opcionalmente cria <b>Recorrências</b> que geram lançamentos
                automaticamente todo dia às 06:00 (BRT), registra pagamentos, monta <b>Repasses</b>
                para imóveis de terceiros, acompanha o resultado em <b>Relatórios</b> e vê tudo
                que aconteceu em <b>Auditoria</b>. As <b>Permissões</b> controlam quem enxerga e
                edita cada aba e por quais centros de custo.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Centros de custo — o coração do módulo</CardTitle>
              <CardDescription>
                O centro de custo é o <b>"bolso"</b> de onde sai (ou para onde entra) o dinheiro.
                É o que permite responder perguntas como <i>"quanto o Imóvel Nammos gastou este
                mês?"</i> ou <i>"a Frota deu lucro?"</i>.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <div>
                <b>Não confunda:</b> centro de custo <u>não é</u> fornecedor (isso é <i>Pessoa</i>)
                nem categoria contábil (isso é <i>Plano de contas / Categoria</i>). Ele é a unidade
                de negócio: uma sede, um imóvel, uma frota, uma obra.
              </div>
              <div>
                <b>Exemplo prático.</b> Três centros: "Sede Administrativa", "Imóvel Nammos" e
                "Frota". A mesma conta de energia pode gerar dois lançamentos no mesmo mês — um
                na Sede e outro no Nammos — porque o gasto pertence a unidades diferentes.
              </div>
              <div>
                <b>Onde ele aparece:</b>
                <ul className="list-disc pl-5 space-y-1 mt-1">
                  <li>Campo obrigatório em cada lançamento e recorrência.</li>
                  <li>Filtro no Calendário e nos Relatórios.</li>
                  <li>Base das permissões: você pode limitar um usuário aos centros dele.</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Páginas do menu lateral</CardTitle>
              <CardDescription>
                Ordem exata do menu à esquerda quando você abre <i>/despesas</i>.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <ul className="list-disc pl-5 space-y-1">
                <li><b>Dashboard</b> — visão geral do que você tem permissão para ver.</li>
                <li><b>Calendário</b> — lista de lançamentos, filtros e KPIs do mês.</li>
                <li><b>Recorrências</b> — modelos que geram lançamentos automaticamente.</li>
                <li><b>Notificações</b> — preferências de aviso e caixa de mensagens do módulo.</li>
                <li><b>Imóveis</b> — cadastro de imóveis com encargos e credenciais.</li>
                <li><b>Repasses</b> — <u>única página</u> onde se monta e paga repasse a terceiros.</li>
                <li><b>Relatórios</b> — KPIs, curva mensal e rankings; exporta em XLSX.</li>
                <li><b>Cadastros</b> — Plano de contas, Categorias, Centros de custo, Contas bancárias, Pessoas, Veículos.</li>
                <li><b>Perfil</b> — seus dados de acesso.</li>
                <li><b>Ajuda</b> — esta página.</li>
                <li><b>Permissões por Aba</b>, <b>Usuários</b> e <b>Auditoria</b> — só para Super Admin e Admin.</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dashboard */}
        <TabsContent value="dashboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>O que a página faz</CardTitle>
              <CardDescription>
                É a tela inicial de <i>/despesas</i>. Mostra atalhos para as abas às quais você
                tem acesso — sem KPIs próprios. Use o Calendário e os Relatórios para números.
              </CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>

        {/* Calendário */}
        <TabsContent value="calendario" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>O que a página faz</CardTitle>
              <CardDescription>
                Concentra os lançamentos com <b>KPIs</b> "A pagar (aberto)", "A receber (aberto)",
                "Vencido" e "Pago no período", filtros e a lista de linhas do mês selecionado.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <div>
                Cada linha é um <b>lançamento</b>: descrição, valor, vencimento,
                plano/categoria, <b>centro de custo</b>, conta bancária e pessoa.
              </div>
              <div>
                O status é automático: nasce <b>a vencer</b>, vira <b>pago</b> quando você registra
                pagamento (total ou parcial) e vira <b>atrasado</b> quando passa do vencimento sem
                quitação. Um mesmo lançamento aceita <b>múltiplos pagamentos</b>.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Botões que existem nesta página</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <ul className="list-disc pl-5 space-y-1">
                <li><b>Nova receita</b> e <b>Nova despesa</b> — abrem o diálogo de lançamento.</li>
                <li><b>Exportar CSV</b> — baixa a visão atual filtrada.</li>
                <li>Por linha: <b>Pagar</b> (registrar pagamento), <b>Editar</b>, <b>Cancelar</b>, <b>Excluir</b>, <b>Marcar como quitado</b> (baixa manual), <b>Marcar como tratado pelo GIMOB</b> e <b>Estornar</b> (para reverter status <i>pago/quitado/gimob</i>).</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Não confunda</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              O Calendário <b>não monta repasse</b>. Repasse só na aba <b>Repasses</b> do menu.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Passo a passo — Novo lançamento</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <ol className="list-decimal pl-5 space-y-1">
                <li>Em <b>Calendário</b>, clique em <b>Nova receita</b> ou <b>Nova despesa</b>.</li>
                <li>Preencha <b>Descrição</b>, <b>Centro de custo</b>, <b>Categoria</b> e <b>Conta bancária</b>.</li>
                <li><b>Competência</b>: selecione <b>Mês</b> e <b>Ano</b> (não é data completa).</li>
                <li><b>Vencimento</b>: a data em que a conta deve ser paga.</li>
                <li><b>Valor total é opcional</b>: se ainda não sabe, deixe em branco e informe no pagamento.</li>
                <li>
                  <b>Referências</b> (pelo menos uma; pode combinar várias): <b>Nº de Pasta</b>,
                  <b> Cód. Venda</b>, <b>Imóvel</b> ou <b>Pessoa</b>. Cada campo tem busca por popover.
                </li>
                <li>Ative <b>Repetir automaticamente</b> se quiser gerar uma série — nesse caso o
                  registro vai para <b>Recorrências</b> e as ocorrências futuras aparecem sozinhas.
                </li>
                <li>Para quitar depois, use <b>Pagar</b> na linha — aceita pagamentos parciais.</li>
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Estornar um lançamento</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              Nos status terminais (<i>pago</i>, <i>quitado</i>, <i>gimob</i>) aparece o botão
              <b> Estornar</b>. Ele volta o lançamento para <i>a vencer</i>, apaga os pagamentos
              vinculados e exige <b>justificativa com pelo menos 10 caracteres</b>, registrada em
              auditoria.
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recorrências */}
        <TabsContent value="recorrencias" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>O que a página faz</CardTitle>
              <CardDescription>
                Uma <b>recorrência</b> é um modelo que gera lançamentos automaticamente: aluguel
                mensal, seguro anual, IPTU parcelado, etc.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <div>
                Todo dia às <b>06:00 (BRT)</b>, o agendador materializa as ocorrências que faltam,
                marca vencidos como atrasados e dispara notificações.
              </div>
              <div>
                Ao editar uma ocorrência isolada, ela vira <b>editada</b> e deixa de ser
                sobrescrita pela série. Para encerrar, desative-a ou defina <b>data fim</b>.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Passo a passo — Nova recorrência</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <ol className="list-decimal pl-5 space-y-1">
                <li>Vá em <b>Recorrências → Nova recorrência</b> (ou marque "Repetir automaticamente" ao criar um lançamento no Calendário).</li>
                <li>
                  Preencha como um lançamento comum e defina <b>Periodicidade</b> (mensal,
                  bimestral, anual…) e <b>Data início</b>.
                </li>
                <li>
                  <b>Gerar com antecedência (meses)</b>: com quantos meses de antecedência as
                  ocorrências já aparecem no Calendário. Ex.: 3 = sempre vê os próximos 3 meses.
                  <i> Não confunda com o alerta do sino</i>, configurado na aba <b>Notificações</b>.
                </li>
                <li>Para encerrar: preencha <b>Data fim</b> ou <b>desative</b> a recorrência.</li>
                <li>
                  Séries encerradas ganham um botão <b>Renovar</b> que prorroga por mais N meses
                  sem duplicar as ocorrências já geradas.
                </li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notificações */}
        <TabsContent value="notificacoes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>O que a página faz</CardTitle>
              <CardDescription>
                Tem dois blocos: <b>Preferências</b> (como você quer ser avisado) e
                <b> Caixa de notificações</b> (mensagens já disparadas pelo agendador).
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <ul className="list-disc pl-5 space-y-1">
                <li>Em <b>Preferências</b>, informe os <b>dias de antecedência</b> (ex.: 7 e 1) e ligue/desligue o alerta de vencidos.</li>
                <li>As notificações aparecem no <b>sino</b> no topo do módulo e ficam listadas na caixa desta página.</li>
                <li>Cada usuário tem preferências próprias — o que você define aqui só afeta você.</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Imóveis */}
        <TabsContent value="imoveis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>O que a página faz</CardTitle>
              <CardDescription>
                Cadastro dos imóveis usados nos lançamentos e nos repasses. Cada imóvel tem
                identificação, situação, proprietário/inquilino, encargos e credenciais.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader><CardTitle>Passo a passo — Novo imóvel</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <ol className="list-decimal pl-5 space-y-1">
                <li>Clique em <b>Novo imóvel</b>.</li>
                <li>Preencha código interno, descrição, endereço, <b>RIP</b> e inscrição municipal.</li>
                <li>Escolha <b>Situação</b>: Alugado, Desocupado, Próprio, Em obra, <b>Em aquisição</b>, Gimob ou Quitado.</li>
                <li>Vincule <b>Proprietário</b> (obrigatório) e <b>Inquilino</b> (quando alugado).</li>
                <li>Aba <b>Encargos</b>: cadastre IPTU, TCR, SPU e outros — mensal ou anual.</li>
                <li>Aba <b>Credenciais</b>: dados sensíveis, com permissão à parte.</li>
                <li>Se houver <b>código</b> ou <b>inscrição municipal</b> igual a outro imóvel, aparece alerta de duplicidade com justificativa obrigatória (≥10 caracteres).</li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Repasses */}
        <TabsContent value="repasses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>O que a página faz</CardTitle>
              <CardDescription>
                Para imóveis de terceiros, o repasse pega o aluguel recebido no mês, desconta
                encargos e comissão, calcula o líquido e distribui entre beneficiários. Exporta
                em XLSX. É a <b>única</b> tela onde se monta repasse.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Passo a passo — Novo repasse (ex.: aluguel de R$ 30.000)</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <ol className="list-decimal pl-5 space-y-1">
                <li>Vá em <b>Repasses</b> e clique em <b>Montar repasse</b>.</li>
                <li>Escolha <b>Proprietário</b>, <b>Mês/Ano</b> e <b>Centro de custo</b>.</li>
                <li>
                  Vá para a aba <b>Itens</b> e adicione um <b>Crédito</b> com <b>Origem = Aluguel</b>,
                  Descrição (ex.: "Aluguel apto 302") e <b>Valor</b> (ex.: R$ 30.000). Pode vincular
                  ao imóvel. Adicione também <b>Débitos</b> quando houver: encargos, ajustes, etc.
                </li>
                <li>
                  O sistema calcula automaticamente: <b>Bruto − Taxa administração = Líquido</b>.
                </li>
                <li>
                  Aba <b>Beneficiários</b>: distribua o líquido entre uma ou mais pessoas
                  (proprietário, cônjuge, procurador, beneficiário indicado). Use o botão
                  <b> Usar valor restante</b> para preencher o saldo. A soma não pode ultrapassar o líquido.
                </li>
                <li>
                  Aba <b>Imóveis</b>: <i>informativa</i> — mostra os imóveis do proprietário e seus
                  inquilinos. Para alterar inquilino, edite o cadastro do imóvel.
                </li>
                <li>
                  Clique em <b>Marcar como pago</b>. O sistema registra a data da liquidação e
                  altera o status do repasse para <b>pago</b> (ele não é editável a partir daí; use
                  Excluir para refazer, se necessário).
                </li>
                <li>Use <b>Exportar XLSX</b> para gerar a planilha do repasse.</li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cadastros */}
        <TabsContent value="cadastros" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>O que a página faz</CardTitle>
              <CardDescription>
                Reúne as "peças" reutilizadas em cada lançamento, recorrência e repasse. Cadastre
                uma vez, use sempre.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <ul className="list-disc pl-5 space-y-1">
                <li><b>Plano de contas</b>: estrutura contábil (Receitas, Despesas Operacionais…).</li>
                <li><b>Categorias</b>: detalham o plano. <i>Subcategoria foi removida.</i></li>
                <li><b>Centros de custo</b>: unidades de negócio.</li>
                <li><b>Contas bancárias</b>: de onde o dinheiro sai ou entra.</li>
                <li>
                  <b>Pessoas</b>: cadastro único para todos os papéis — Proprietário, Inquilino,
                  Empresa (ex-"Loja"), Fornecedor, Prestador de Serviço, Beneficiário, Motorista
                  e <i>Outro</i> (com descrição livre). PF ou PJ. Duplicidade por CPF/CNPJ pede
                  justificativa (≥10 caracteres).
                </li>
                <li><b>Veículos</b>: com motorista, proprietário e centro de custo vinculados.</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Relatórios */}
        <TabsContent value="relatorios" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>O que a página faz</CardTitle>
              <CardDescription>
                Consolida os lançamentos em <b>KPIs</b> (Previsto a pagar, Previsto a receber,
                Pago no período, Atrasado), <b>curva mensal previsto × pago</b>, <b>Top 10 centros
                de custo</b>, <b>Top 10 pessoas</b> e <b>Encargos por imóvel</b> (IPTU, TCR, SPU,
                condomínio). Exporta em XLSX.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <ul className="list-disc pl-5 space-y-1">
                <li>Filtre por <b>período</b> e demais critérios expostos na página.</li>
                <li>Exporte a visão atual em <b>XLSX</b> para envio à contabilidade.</li>
                <li>Os totais respeitam as <b>permissões</b> — cada usuário só vê os centros a que tem acesso.</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Permissões & Auditoria */}
        <TabsContent value="permissoes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Permissões por aba + centros de custo</CardTitle>
              <CardDescription>O acesso funciona em <b>cascata</b>, em três camadas:</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <ol className="list-decimal pl-5 space-y-1">
                <li>
                  <b>Acesso ao módulo</b> (em <i>/usuarios</i>): o portão de entrada. Sem ele, o
                  usuário nem abre Despesas.
                </li>
                <li>
                  <b>Nível por aba</b> (em <i>Despesas → Permissões</i>): sem acesso, visualizar,
                  editar ou excluir. Salvo em <i>despesas_aba_permissoes</i>.
                </li>
                <li>
                  <b>Centros permitidos</b>: dizem <u>o que</u> ele enxerga. <b>Vazio = todos</b>.
                </li>
              </ol>
              <div className="pt-1">
                Se você tirar o acesso ao módulo em <i>/usuarios</i>, as permissões internas
                <b> não são apagadas</b> — voltam a valer ao reconceder o acesso.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Passo a passo — Gerenciar permissões (só Admin / Super Admin)</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <ol className="list-decimal pl-5 space-y-1">
                <li>
                  Vá em <b>Despesas → Permissões</b>. Navegue pelas abas (uma por área do módulo).
                </li>
                <li>
                  Marque um ou mais usuários e use as <b>ações em lote</b> para aplicar o mesmo
                  nível de uma vez.
                </li>
                <li>Defina os <b>centros permitidos</b> por usuário. <b>Vazio = todos</b>.</li>
                <li>
                  Lembre: o usuário precisa antes ter <b>acesso ao módulo Despesas</b> habilitado
                  em <i>Gerenciamento de usuários</i>.
                </li>
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Restrições do perfil Admin</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Perfis <b>Admin</b> só listam usuários com <b>os mesmos módulos habilitados</b>,
              <b> não podem desativar nem excluir</b> usuários e <b>não podem gerenciar Super Admins</b>
              — ações exclusivas do Super Admin.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Auditoria</CardTitle>
              <CardDescription>Em <i>Despesas → Auditoria</i> (Admin / Super Admin).</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Toda criação, edição ou exclusão fica registrada com autor, data e diff humanizado.
              Filtre por usuário, entidade ou período. Justificativas de duplicidade e estorno
              também ficam aqui.
            </CardContent>
          </Card>
        </TabsContent>

        {/* FAQ */}
        <TabsContent value="faq" className="space-y-4">
          <Card>
            <CardContent className="text-sm text-muted-foreground space-y-4 pt-6">
              <div>
                <b>Onde monto um repasse?</b><br />
                Só em <b>Repasses → Montar repasse</b>. O Calendário não tem esse botão.
              </div>
              <div>
                <b>Onde coloco o valor do aluguel no repasse?</b><br />
                Na aba <b>Itens</b> do diálogo do repasse, adicione um <b>Crédito</b> com
                <b> Origem = Aluguel</b> e o valor (ex.: R$ 30.000). O líquido é recalculado
                automaticamente e você distribui em <b>Beneficiários</b>.
              </div>
              <div>
                <b>Preciso preencher o valor total do lançamento?</b><br />
                Não. O <b>valor total é opcional</b>. Você pode registrar só o compromisso e
                informar os valores conforme paga.
              </div>
              <div>
                <b>Sumiu Subcategoria?</b><br />
                Sim, foi removida. Use categorias mais específicas quando precisar detalhar.
              </div>
              <div>
                <b>Salvei e apareceu alerta de duplicidade — e agora?</b><br />
                Confirme se realmente é diferente do registro apontado e escreva uma
                <b> justificativa com pelo menos 10 caracteres</b> para prosseguir. O motivo
                fica gravado na auditoria.
              </div>
              <div>
                <b>O que muda entre "Gerar com antecedência" e o aviso de notificação?</b><br />
                "Gerar com antecedência" cria as próximas ocorrências no Calendário. O aviso do
                sino é configurado separadamente na aba <b>Notificações</b>.
              </div>
              <div>
                <b>Marquei um lançamento como pago por engano. Como reverto?</b><br />
                Use o botão <b>Estornar</b> na linha do Calendário e informe uma justificativa
                de pelo menos 10 caracteres. Vale para <i>pago</i>, <i>quitado</i> e <i>gimob</i>.
              </div>
              <div>
                <b>A competência agora é mês/ano?</b><br />
                Sim. No diálogo de lançamento, o campo <b>Competência</b> mostra seletores de
                <b> Mês</b> e <b>Ano</b>.
              </div>
              <div>
                <b>Como referencio um lançamento a uma pasta, venda, imóvel ou pessoa?</b><br />
                No diálogo, logo abaixo da descrição, preencha um ou mais dos campos
                <b> Nº de Pasta</b>, <b>Cód. Venda</b>, <b>Imóvel</b> ou <b>Pessoa</b>. Pelo
                menos um é obrigatório e você pode combinar vários.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}