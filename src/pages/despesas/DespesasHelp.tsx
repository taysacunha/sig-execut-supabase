import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DespesasHelp() {
  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ajuda — Despesas</h1>
        <p className="text-muted-foreground">
          Manual do módulo em três partes: <b>como funciona</b> (conceito), <b>passo a passo</b>
          (o que clicar para cada tarefa) e <b>perguntas frequentes</b>.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Parte 1 — Como o módulo funciona</h2>

      <Card>
        <CardHeader>
          <CardTitle>Como o módulo funciona</CardTitle>
          <CardDescription>
            O fluxo é sempre o mesmo: você monta os <b>cadastros</b> (planos, categorias, centros
            de custo, contas, pessoas, imóveis, veículos), lança contas a pagar/receber no
            <b> Calendário</b>, opcionalmente cria <b>Recorrências</b> que geram lançamentos
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
            <b>Exemplo prático.</b> Você tem três centros: "Sede Administrativa", "Imóvel
            Nammos" e "Frota". A mesma conta de energia pode gerar dois lançamentos no mesmo
            mês — um no centro Sede e outro no centro Nammos — porque o gasto pertence a
            unidades diferentes, mesmo tendo o mesmo fornecedor.
          </div>
          <div>
            <b>Onde ele aparece:</b>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>Campo obrigatório em cada lançamento e recorrência.</li>
              <li>Filtro no Calendário e nos Relatórios.</li>
              <li>Base das permissões: você pode limitar um usuário a ver só os centros dele.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cadastros (a base)</CardTitle>
          <CardDescription>
            São as "peças" que você usa depois em cada lançamento. Cadastre-as uma vez e
            reutilize sempre.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li><b>Plano de contas</b>: estrutura contábil (Receitas, Despesas Operacionais…). Define se é entrada ou saída.</li>
            <li><b>Categorias</b>: detalham o plano (ex.: Despesas → Manutenção). Obs.: <i>Subcategoria foi removida</i>; use categorias mais específicas quando precisar de detalhe.</li>
            <li><b>Centros de custo</b>: as unidades de negócio (ver card acima).</li>
            <li><b>Contas bancárias</b>: de onde o dinheiro sai ou entra de fato.</li>
            <li>
              <b>Pessoas</b>: um cadastro único para todos os papéis — Proprietário, Inquilino,
              Empresa (ex-"Loja"), Fornecedor, Prestador de Serviço, Beneficiário, Motorista e
              <i> Outro</i> (com descrição livre). Duplicidade por CPF/CNPJ é detectada e você
              pode prosseguir mediante justificativa.
            </li>
            <li>
              <b>Imóveis</b>: ativos com <b>RIP</b> (ex-"Matrícula"), inscrição municipal, endereço,
              proprietário, inquilino, encargos (IPTU, TCR, SPU e outros) e <b>situação</b>:
              Alugado, Desocupado (ex-"Vago"), Próprio, Em obra, <b>Em aquisição</b>, Gimob e
              Quitado. Credenciais de acesso ficam em área isolada com permissão à parte.
              Duplicidade por código ou inscrição municipal pede justificativa.
            </li>
            <li><b>Veículos</b>: com motorista, proprietário e centro de custo vinculados.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lançamentos e Calendário</CardTitle>
          <CardDescription>
            Cada conta a pagar ou receber é um <b>lançamento</b> com descrição, valor,
            vencimento, plano/categoria, <b>centro de custo</b>, conta bancária e pessoa.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <div>
            O status é automático: nasce como <b>previsto</b>, vira <b>pago</b> quando você
            registra pagamento (total ou parcial) e vira <b>atrasado</b> quando passa do
            vencimento sem quitação.
          </div>
          <div>
            Um mesmo lançamento aceita <b>múltiplos pagamentos</b> — útil para parcelas ou
            quitações parciais. O Calendário mostra tudo por dia, com KPIs de previsto, pago
            e em atraso.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recorrências e o agendador diário</CardTitle>
          <CardDescription>
            Uma <b>recorrência</b> é um modelo que gera lançamentos automaticamente: aluguel
            mensal, seguro anual, IPTU parcelado, etc. Você define descrição, valor, centro de
            custo, periodicidade e horizonte (padrão 12 meses).
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <div>
            Todo dia às <b>06:00 (BRT)</b>, o agendador materializa as ocorrências que faltam,
            marca vencidos como atrasados e dispara notificações — sem custo por acesso.
          </div>
          <div>
            Se você editar uma ocorrência isolada, ela vira <b>editada</b> e deixa de ser
            sobrescrita pela série. Para encerrar uma recorrência, basta desativá-la ou
            definir <b>data fim</b>.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Imóveis e Repasses</CardTitle>
          <CardDescription>
            Em <b>Imóveis</b> você cadastra o ativo, os encargos (IPTU, TCR, SPU) e a
            situação atual (alugado, desocupado, próprio, em obra).
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Em <b>Repasses</b>, para imóveis de terceiros, o sistema pega o aluguel recebido no
          mês, desconta encargos e comissão, e calcula o líquido a repassar ao proprietário —
          com liquidação registrada e exportação em XLSX.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permissões por aba + centros de custo</CardTitle>
          <CardDescription>
            O acesso funciona em <b>cascata</b>, em três camadas:
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <ol className="list-decimal pl-5 space-y-1">
            <li>
              <b>Acesso ao módulo</b> (definido em <i>/usuarios</i>): o portão de entrada. Sem
              ele, o usuário nem abre Despesas.
            </li>
            <li>
              <b>Nível por aba</b> (em <i>Despesas → Permissões</i>): diz <u>o que</u> ele
              faz em cada aba — sem acesso, visualizar, editar ou excluir. Esse nível é salvo
              na tabela <i>despesas_aba_permissoes</i>.
            </li>
            <li>
              <b>Centros permitidos</b>: dizem <u>o que</u> ele enxerga. <b>Vazio = todos</b>.
              Se você marcar apenas "Imóvel Nammos", o usuário só vê lançamentos, recorrências
              e repasses desse centro, mesmo tendo nível "editar" no Calendário.
            </li>
          </ol>
          <div className="pt-1">
            Se você tirar o acesso ao módulo em <i>/usuarios</i>, as permissões internas
            <b> não são apagadas</b> — ficam guardadas e voltam a valer assim que você
            reconceder o acesso.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Perfis de acesso</CardTitle>
          <CardDescription>
            A aba "Perfis de acesso" que existia em <i>Cadastros</i> era um cadastro auxiliar
            (tabela <i>despesas_perfis_acesso</i>) e <b>não influenciava</b> quem podia acessar
            o módulo ou cada aba.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <div>
            O controle de acesso real é feito por três mecanismos independentes:
          </div>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <b>Perfil do usuário</b> (Super Admin, Admin, Gerente, Supervisor, Colaborador,
              Corretor): definido em <i>Gerenciamento de usuários → Perfil</i> e salvo na tabela
              <i>user_roles</i>.
            </li>
            <li>
              <b>Acesso ao sistema</b>: em <i>Gerenciamento de usuários</i> você habilita ou
              desabilita o módulo Despesas para cada usuário. Perfis <b>Admin</b> só enxergam
              usuários com os mesmos módulos habilitados e não podem desativar nem excluir
              usuários — essas ações são exclusivas do Super Admin.
            </li>
            <li>
              <b>Permissões por aba</b>: em <i>Despesas → Permissões</i> você define, para cada
              aba, se o usuário pode ver, editar ou excluir.
            </li>
          </ul>
          <div>
            Por isso a aba foi removida da tela. Os dados antigos permanecem no banco, mas não
            têm efeito nas permissões.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notificações, Duplicidade e Auditoria</CardTitle>
          <CardDescription>
            Três recursos transversais que apoiam o dia a dia.
          </CardDescription>
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
              justificativa (mínimo 10 caracteres) para prosseguir. Não bloqueia — você decide,
              mas o motivo fica registrado na auditoria.
            </li>
            <li>
              <b>Auditoria</b>: toda criação, edição ou exclusão em cadastros, lançamentos,
              imóveis, repasses, recorrências, pessoas e permissões fica registrada com autor,
              data e diff humanizado (mostra o valor antigo e o novo em português).
            </li>
          </ul>
        </CardContent>
      </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Parte 2 — Passo a passo</h2>
        <p className="text-sm text-muted-foreground">
          Guia prático para as tarefas mais comuns. Siga a ordem dos cliques.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>1. Cadastrar uma pessoa</CardTitle>
            <CardDescription>Proprietários, inquilinos, fornecedores, beneficiários…</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <ol className="list-decimal pl-5 space-y-1">
              <li>Vá em <b>Despesas → Cadastros → Pessoas → Nova pessoa</b>.</li>
              <li>Escolha <b>Tipo</b> (PF ou PJ) e preencha CPF ou CNPJ.</li>
              <li>Marque um ou mais <b>Papéis</b>: Proprietário, Inquilino, Empresa, Fornecedor, Prestador de Serviço, Beneficiário, Motorista ou <i>Outro</i> (aqui aparece um campo de texto para descrever).</li>
              <li>Se o sistema encontrar alguém com CPF/CNPJ parecido, aparece um <b>alerta de duplicidade</b> listando os semelhantes. Confirme que é uma pessoa diferente e escreva uma <b>justificativa (≥10 caracteres)</b> para salvar.</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Cadastrar um imóvel</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <ol className="list-decimal pl-5 space-y-1">
              <li>Vá em <b>Despesas → Imóveis → Novo imóvel</b>.</li>
              <li>Preencha código interno, descrição, endereço, <b>RIP</b> (antes chamado "Matrícula") e inscrição municipal.</li>
              <li>Escolha <b>Situação</b>: Alugado, Desocupado, Próprio, Em obra, <b>Em aquisição</b>, Gimob ou Quitado.</li>
              <li>Vincule <b>Proprietário</b> (obrigatório) e <b>Inquilino</b> (quando alugado).</li>
              <li>Aba <b>Encargos</b>: cadastre IPTU, TCR, SPU e outros — cada um com valor mensal ou anual.</li>
              <li>Aba <b>Credenciais</b>: dados sensíveis ficam nesta área isolada e só quem tem permissão específica vê.</li>
              <li>Duplicidade por <b>código do imóvel</b> ou <b>inscrição municipal</b> dispara alerta com justificativa obrigatória.</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. Lançar uma conta a pagar ou receber</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <ol className="list-decimal pl-5 space-y-1">
              <li>Vá em <b>Despesas → Calendário</b> e clique em <b>Novo lançamento</b> (ou nos cards "A pagar"/"A receber").</li>
              <li>Escolha <b>Tipo</b> (pagar/receber), <b>Descrição</b>, <b>Centro de custo</b>, <b>Categoria</b> e <b>Conta bancária</b>.</li>
              <li><b>Competência</b>: selecione <b>Mês e Ano</b> (não é mais data completa).</li>
              <li><b>Vencimento</b>: a data em que a conta deve ser paga.</li>
              <li><b>Valor total é opcional</b>: se ainda não sabe, deixe em branco e informe no pagamento. O status trata o compromisso mesmo sem valor.</li>
              <li><b>Referências</b> (obrigatório escolher pelo menos uma; pode preencher várias): <b>Nº de Pasta</b>, <b>Cód. Venda</b>, <b>Imóvel</b> ou <b>Pessoa</b>. Cada campo tem busca por popover.</li>
              <li>Salve. Para quitar, use <b>Registrar pagamento</b> — aceita pagamentos parciais. O status vira <b>pago</b> só quando quitar tudo; vira <b>atrasado</b> se passar do vencimento sem quitação.</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. Criar uma recorrência</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <ol className="list-decimal pl-5 space-y-1">
              <li>Vá em <b>Despesas → Recorrências → Nova recorrência</b>.</li>
              <li>Preencha como um lançamento comum e defina <b>Periodicidade</b> (mensal, bimestral, anual…) e <b>Data início</b>.</li>
              <li>
                <b>Gerar com antecedência (meses)</b>: com quantos meses de antecedência as próximas
                ocorrências já aparecem no Calendário. Ex.: valor 3 = você sempre vê os próximos
                3 meses da série. <i>Não confunda com o alerta de notificação</i>, que é configurado
                separadamente em Notificações → Preferências.
              </li>
              <li>Para encerrar: preencha <b>Data fim</b> ou <b>desative</b> a recorrência.</li>
              <li>Séries encerradas ganham um botão <b>Renovar</b> que prorroga por mais N meses sem duplicar as ocorrências já geradas.</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>5. Fazer um repasse ao proprietário</CardTitle>
            <CardDescription>Onde entra o aluguel de R$ 30.000, por exemplo.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <ol className="list-decimal pl-5 space-y-1">
              <li>
                Vá em <b>Despesas → Repasses → Novo repasse</b>. Alternativa: no <b>Calendário</b>,
                use <b>Montar repasse</b> para consolidar automaticamente os lançamentos do mês
                daquele proprietário.
              </li>
              <li>Escolha <b>Proprietário</b>, <b>Mês/Ano</b> e <b>Centro de custo</b>.</li>
              <li>
                Vá para a aba <b>Itens</b> e adicione um <b>Crédito</b> com <b>Origem = Aluguel</b>,
                Descrição (ex.: "Aluguel apto 302") e <b>Valor</b> (ex.: R$ 30.000). Pode vincular
                ao imóvel. Adicione também <b>Débitos</b> quando houver: encargos, ajustes, etc.
              </li>
              <li>
                O sistema calcula automaticamente: <b>Bruto − Taxa administração = Líquido</b>.
                Os três aparecem nos cards no topo do dialog.
              </li>
              <li>
                Vá para a aba <b>Beneficiários</b> e distribua o líquido entre uma ou mais pessoas
                (proprietário, cônjuge, procurador, beneficiário indicado). Use o botão
                <b> Restante</b> para preencher o saldo. A soma não pode ultrapassar o líquido.
              </li>
              <li>
                A aba <b>Imóveis</b> é informativa — mostra os imóveis do proprietário e seus
                inquilinos vinculados. Para alterar inquilino, edite o cadastro do imóvel.
              </li>
              <li>
                Clique em <b>Marcar como pago</b>. O sistema registra a data de pagamento e cria
                automaticamente o lançamento correspondente no Calendário.
              </li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>6. Configurar suas notificações</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <ol className="list-decimal pl-5 space-y-1">
              <li>Vá em <b>Despesas → Notificações → Preferências</b>.</li>
              <li>Informe os dias de antecedência (pode ser mais de um, ex.: 7 e 1).</li>
              <li>Marque se quer receber alerta de <b>vencidos</b>.</li>
              <li>As notificações aparecem no <b>sino no topo</b> do módulo e são disparadas todos os dias às 06:00 (BRT) pelo agendador.</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>7. Consultar auditoria</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Vá em <b>Despesas → Auditoria</b>. Você vê quem fez, o quê, quando e a diferença
            (antes/depois) em linguagem humanizada. Filtre por usuário, entidade ou período.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>8. Gerenciar permissões por aba</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <ol className="list-decimal pl-5 space-y-1">
              <li>Vá em <b>Despesas → Permissões</b>. Navegue pelas abas (uma por área do módulo).</li>
              <li>Marque um ou mais usuários e use as <b>ações em lote</b> para aplicar o mesmo nível (sem acesso, visualizar, editar, excluir) de uma vez.</li>
              <li>Defina os <b>centros permitidos</b> por usuário. <b>Vazio = todos</b>.</li>
              <li>Lembre: o usuário precisa antes ter <b>acesso ao módulo Despesas</b> habilitado em <i>Gerenciamento de usuários</i>.</li>
            </ol>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Parte 3 — Perguntas frequentes</h2>

        <Card>
          <CardContent className="text-sm text-muted-foreground space-y-4 pt-6">
            <div>
              <b>Onde coloco o valor do aluguel no repasse?</b><br />
              Na aba <b>Itens</b> do dialog do repasse, adicione um <b>Crédito</b> com
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
              <b> justificativa com pelo menos 10 caracteres</b> para prosseguir. O motivo fica
              gravado na auditoria.
            </div>
            <div>
              <b>O que muda entre "Gerar com antecedência" e o aviso de notificação?</b><br />
              "Gerar com antecedência" cria as próximas ocorrências no Calendário. O aviso do
              sino é configurado separadamente em <i>Notificações → Preferências</i>.
            </div>
            <div>
              <b>Como o Admin enxerga só os usuários dele?</b><br />
              Perfis <b>Admin</b> só listam usuários que tenham <b>os mesmos módulos habilitados</b>
              que ele. Além disso, o Admin <b>não pode desativar nem excluir</b> usuários —
              essas ações são exclusivas do Super Admin.
            </div>
            <div>
              <b>A competência agora é mês/ano?</b><br />
              Sim. No dialog de lançamento, o campo <b>Competência</b> mostra seletores de
              <b> Mês</b> e <b>Ano</b>, e não mais uma data completa.
            </div>
            <div>
              <b>Como referencio um lançamento a uma pasta, venda, imóvel ou pessoa?</b><br />
              No dialog do lançamento, logo abaixo da descrição, preencha um ou mais dos campos
              <b> Nº de Pasta</b>, <b>Cód. Venda</b>, <b>Imóvel</b> ou <b>Pessoa</b>. Pelo menos
              um é obrigatório e você pode combinar vários.
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}