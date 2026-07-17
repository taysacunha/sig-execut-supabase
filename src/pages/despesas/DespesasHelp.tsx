import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DespesasHelp() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ajuda — Despesas</h1>
        <p className="text-muted-foreground">
          Manual do módulo: como as peças se encaixam, o papel dos centros de custo e o que
          cada aba faz.
        </p>
      </div>

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
            <li><b>Categorias / Subcategorias</b>: detalham o plano (ex.: Despesas → Manutenção → Elétrica).</li>
            <li><b>Centros de custo</b>: as unidades de negócio (ver card acima).</li>
            <li><b>Contas bancárias</b>: de onde o dinheiro sai ou entra de fato.</li>
            <li><b>Pessoas</b>: fornecedores, clientes, locatários, motoristas, proprietários — tudo em um só lugar.</li>
            <li><b>Imóveis</b>: ativos que geram encargos próprios (IPTU, TCR, SPU) e podem entrar em repasses.</li>
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
            situação atual (alugado, vago, próprio, em obra).
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
              faz em cada aba — sem acesso, visualizar, editar ou excluir.
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
              <b>Duplicidade</b>: ao salvar um lançamento, o sistema procura outros semelhantes
              (mesmo valor, pessoa, centro e vencimento próximo) e avisa. Não bloqueia — você
              decide.
            </li>
            <li>
              <b>Auditoria</b>: toda criação, edição ou exclusão em cadastros, lançamentos,
              imóveis, repasses e recorrências fica registrada com autor, data e diff.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}