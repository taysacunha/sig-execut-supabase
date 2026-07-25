import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DespesasHelp() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ajuda — Despesas</h1>
        <p className="text-muted-foreground">
          Manual do módulo dividido por área do sistema. Cada aba explica o conceito, o passo a
          passo e as regras importantes daquela página.
        </p>
      </div>

      <Tabs defaultValue="visao" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto justify-start">
          <TabsTrigger value="visao">Visão geral</TabsTrigger>
          <TabsTrigger value="cadastros">Cadastros</TabsTrigger>
          <TabsTrigger value="calendario">Calendário / Lançamentos</TabsTrigger>
          <TabsTrigger value="recorrencias">Recorrências</TabsTrigger>
          <TabsTrigger value="repasses">Repasses</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
          <TabsTrigger value="permissoes">Permissões & Auditoria</TabsTrigger>
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
                automaticamente todo dia às 06:00, registra pagamentos (que mudam o status de
                previsto para pago ou atrasado), acompanha o resultado por <b>Relatórios</b> e
                <b> Repasses</b>, e tem tudo registrado em <b>Auditoria</b>. As <b>Permissões</b>
                controlam quem vê e edita cada aba, e por quais centros de custo.
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
              <CardTitle>Perfis de acesso</CardTitle>
              <CardDescription>
                O controle de acesso real é feito por três mecanismos independentes.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <b>Perfil do usuário</b> (Super Admin, Admin, Gerente, Supervisor, Colaborador,
                  Corretor): definido em <i>Gerenciamento de usuários → Perfil</i>.
                </li>
                <li>
                  <b>Acesso ao sistema</b>: em <i>Gerenciamento de usuários</i>, habilita/desabilita
                  o módulo Despesas. Perfis <b>Admin</b> só enxergam usuários com os mesmos módulos
                  habilitados e não podem desativar nem excluir usuários — ações exclusivas do
                  Super Admin.
                </li>
                <li>
                  <b>Permissões por aba</b>: em <i>Despesas → Permissões</i>, define por aba se o
                  usuário pode ver, editar ou excluir.
                </li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cadastros */}
        <TabsContent value="cadastros" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>O que a página faz</CardTitle>
              <CardDescription>
                São as "peças" que você usa depois em cada lançamento. Cadastre uma vez e
                reutilize sempre.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <ul className="list-disc pl-5 space-y-1">
                <li><b>Plano de contas</b>: estrutura contábil (Receitas, Despesas Operacionais…).</li>
                <li><b>Categorias</b>: detalham o plano. Obs.: <i>Subcategoria foi removida</i>.</li>
                <li><b>Centros de custo</b>: unidades de negócio.</li>
                <li><b>Contas bancárias</b>: de onde o dinheiro sai ou entra.</li>
                <li>
                  <b>Pessoas</b>: cadastro único para todos os papéis — Proprietário, Inquilino,
                  Empresa (ex-"Loja"), Fornecedor, Prestador de Serviço, Beneficiário, Motorista
                  e <i>Outro</i> (com descrição livre).
                </li>
                <li>
                  <b>Imóveis</b>: com <b>RIP</b> (ex-"Matrícula"), inscrição municipal, endereço,
                  proprietário, inquilino, encargos (IPTU, TCR, SPU e outros) e <b>situação</b>:
                  Alugado, Desocupado (ex-"Vago"), Próprio, Em obra, <b>Em aquisição</b>, Gimob e
                  Quitado. Credenciais ficam em área isolada com permissão à parte.
                </li>
                <li><b>Veículos</b>: com motorista, proprietário e centro de custo vinculados.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Passo a passo — Cadastrar uma pessoa</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <ol className="list-decimal pl-5 space-y-1">
                <li>Vá em <b>Despesas → Cadastros → Pessoas → Nova pessoa</b>.</li>
                <li>Escolha <b>Tipo</b> (PF ou PJ) e preencha CPF ou CNPJ.</li>
                <li>
                  Marque um ou mais <b>Papéis</b>. Se escolher <i>Outro</i>, aparece um campo de
                  texto para descrever.
                </li>
                <li>
                  Se houver CPF/CNPJ parecido, aparece <b>alerta de duplicidade</b>. Para prosseguir
                  escreva uma <b>justificativa (≥10 caracteres)</b>.
                </li>
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Passo a passo — Cadastrar um imóvel</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <ol className="list-decimal pl-5 space-y-1">
                <li>Vá em <b>Despesas → Imóveis → Novo imóvel</b>.</li>
                <li>Preencha código interno, descrição, endereço, <b>RIP</b> e inscrição municipal.</li>
                <li>
                  Escolha <b>Situação</b>: Alugado, Desocupado, Próprio, Em obra, <b>Em aquisição</b>,
                  Gimob ou Quitado.
                </li>
                <li>Vincule <b>Proprietário</b> (obrigatório) e <b>Inquilino</b> (quando alugado).</li>
                <li>Aba <b>Encargos</b>: cadastre IPTU, TCR, SPU e outros — mensal ou anual.</li>
                <li>Aba <b>Credenciais</b>: dados sensíveis com permissão específica.</li>
                <li>
                  Duplicidade por <b>código do imóvel</b> ou <b>inscrição municipal</b> dispara
                  alerta com justificativa obrigatória.
                </li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calendário */}
        <TabsContent value="calendario" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>O que a página faz</CardTitle>
              <CardDescription>
                O <b>Calendário</b> concentra os lançamentos por dia com KPIs de previsto, pago e
                em atraso, além dos cards "A pagar" e "A receber".
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <div>
                Cada conta a pagar ou receber é um <b>lançamento</b> com descrição, valor,
                vencimento, plano/categoria, <b>centro de custo</b>, conta bancária e pessoa.
              </div>
              <div>
                O status é automático: nasce como <b>previsto</b>, vira <b>pago</b> quando você
                registra pagamento (total ou parcial) e vira <b>atrasado</b> quando passa do
                vencimento sem quitação. Um mesmo lançamento aceita <b>múltiplos pagamentos</b>.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Passo a passo — Novo lançamento</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <ol className="list-decimal pl-5 space-y-1">
                <li>
                  Em <b>Despesas → Calendário</b>, clique em <b>Novo lançamento</b> (ou nos cards
                  "A pagar"/"A receber").
                </li>
                <li>
                  Escolha <b>Tipo</b> (pagar/receber), <b>Descrição</b>, <b>Centro de custo</b>,
                  <b> Categoria</b> e <b>Conta bancária</b>.
                </li>
                <li><b>Competência</b>: selecione <b>Mês e Ano</b> (não é mais data completa).</li>
                <li><b>Vencimento</b>: a data em que a conta deve ser paga.</li>
                <li>
                  <b>Valor total é opcional</b>: se ainda não sabe, deixe em branco e informe no
                  pagamento.
                </li>
                <li>
                  <b>Referências</b> (obrigatório escolher pelo menos uma; pode combinar várias):
                  <b> Nº de Pasta</b>, <b>Cód. Venda</b>, <b>Imóvel</b> ou <b>Pessoa</b>. Cada
                  campo tem busca por popover.
                </li>
                <li>
                  Para quitar, use <b>Registrar pagamento</b> — aceita pagamentos parciais.
                </li>
              </ol>
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
                <li>Vá em <b>Despesas → Recorrências → Nova recorrência</b>.</li>
                <li>
                  Preencha como um lançamento comum e defina <b>Periodicidade</b> (mensal,
                  bimestral, anual…) e <b>Data início</b>.
                </li>
                <li>
                  <b>Gerar com antecedência (meses)</b>: com quantos meses de antecedência as
                  ocorrências já aparecem no Calendário. Ex.: 3 = sempre vê os próximos 3 meses.
                  <i> Não confunda com o alerta de notificação</i>, configurado em
                  <i> Notificações → Preferências</i>.
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

        {/* Repasses */}
        <TabsContent value="repasses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>O que a página faz</CardTitle>
              <CardDescription>
                Para imóveis de terceiros, o repasse pega o aluguel recebido no mês, desconta
                encargos e comissão, calcula o líquido e distribui entre beneficiários — com
                liquidação registrada e exportação em XLSX.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Passo a passo — Novo repasse (ex.: aluguel de R$ 30.000)</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <ol className="list-decimal pl-5 space-y-1">
                <li>
                  Vá em <b>Despesas → Repasses → Novo repasse</b>. Alternativa: no
                  <b> Calendário</b>, use <b>Montar repasse</b> para consolidar automaticamente os
                  lançamentos do mês daquele proprietário.
                </li>
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
                  <b> Restante</b> para preencher o saldo. A soma não pode ultrapassar o líquido.
                </li>
                <li>
                  Aba <b>Imóveis</b>: informativa — mostra os imóveis do proprietário e seus
                  inquilinos. Para alterar inquilino, edite o cadastro do imóvel.
                </li>
                <li>
                  Clique em <b>Marcar como pago</b>. O sistema registra a data e cria o
                  lançamento correspondente no Calendário.
                </li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Relatórios */}
        <TabsContent value="relatorios" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>O que a página faz</CardTitle>
              <CardDescription>
                Consolidação analítica de lançamentos, pagamentos e repasses com gráficos
                (Recharts) e exportação em Excel.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <ul className="list-disc pl-5 space-y-1">
                <li>Filtre por período, centro de custo, plano/categoria, conta e status.</li>
                <li>Compare previsto × realizado, entradas × saídas e evolução mensal.</li>
                <li>Exporte a visão atual em <b>XLSX</b> para envio à contabilidade.</li>
                <li>
                  Os totais respeitam as <b>permissões</b> — cada usuário só vê os centros a que
                  tem acesso.
                </li>
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
              <CardTitle>Passo a passo — Gerenciar permissões</CardTitle>
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
              <CardTitle>Notificações, Duplicidade e Auditoria</CardTitle>
              <CardDescription>Três recursos transversais que apoiam o dia a dia.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <b>Notificações</b>: cada usuário define em <i>Notificações → Preferências</i>
                  com quantos dias de antecedência quer ser avisado (ex.: 7 e 1) e se recebe
                  alertas de vencidos. Aparecem no sino ao topo do módulo.
                </li>
                <li>
                  <b>Duplicidade</b>: ao salvar Pessoas (CPF/CNPJ), Imóveis (código ou inscrição
                  municipal) e Lançamentos semelhantes, o sistema lista os conflitos e pede
                  justificativa (mín. 10 caracteres) para prosseguir. Não bloqueia — o motivo
                  fica registrado.
                </li>
                <li>
                  <b>Auditoria</b>: toda criação, edição ou exclusão fica registrada com autor,
                  data e diff humanizado. Filtre por usuário, entidade ou período em
                  <b> Despesas → Auditoria</b>.
                </li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FAQ */}
        <TabsContent value="faq" className="space-y-4">
          <Card>
            <CardContent className="text-sm text-muted-foreground space-y-4 pt-6">
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
                sino é configurado separadamente em <i>Notificações → Preferências</i>.
              </div>
              <div>
                <b>Como o Admin enxerga só os usuários dele?</b><br />
                Perfis <b>Admin</b> só listam usuários com <b>os mesmos módulos habilitados</b>
                e <b>não podem desativar nem excluir</b> — ações exclusivas do Super Admin.
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