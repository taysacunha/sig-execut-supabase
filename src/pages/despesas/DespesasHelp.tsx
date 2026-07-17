import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DespesasHelp() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ajuda — Despesas</h1>
        <p className="text-muted-foreground">Guia rápido do módulo.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Abas do módulo</CardTitle>
          <CardDescription className="space-y-1">
            <div><b>Calendário</b>: contas a pagar e receber, com múltiplos pagamentos por lançamento.</div>
            <div><b>Recorrências</b>: séries que geram lançamentos automaticamente (mensal, anual, meses fixos, intercalada).</div>
            <div><b>Imóveis</b>: cadastro de imóveis, IPTU/TCR/SPU e situação atual.</div>
            <div><b>Repasses</b>: repasses mensais aos proprietários com liquidação.</div>
            <div><b>Cadastros</b>: categorias, planos de conta, contas bancárias, pessoas e veículos.</div>
            <div><b>Notificações</b>: alertas de vencimento e preferências por usuário.</div>
            <div><b>Auditoria</b>: histórico completo de alterações.</div>
            <div><b>Permissões</b>: quem vê e edita cada aba.</div>
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permissões</CardTitle>
          <CardDescription>
            O acesso é definido <b>por aba</b>: um usuário pode ver apenas Veículos, outro apenas
            IPTU, outro tudo. Cada aba tem quatro níveis: <b>sem acesso</b>, <b>visualizar</b>,
            <b> editar</b> e <b>excluir</b>. Além disso, administradores podem restringir os
            <b> centros de custo</b> que o usuário enxerga, filtrando automaticamente todos os
            lançamentos, repasses e recorrências.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Configure em <b>Despesas → Permissões</b> (visível apenas para admins).
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recorrências</CardTitle>
          <CardDescription className="space-y-1">
            <div>Crie uma série informando descrição, valor, centro de custo e periodicidade. Os
              lançamentos são gerados automaticamente pelo agendador diário até o horizonte
              configurado (padrão: 12 meses).
            </div>
            <div>Se você editar uma ocorrência isolada, ela é marcada como <b>editada</b> e
              deixa de ser sobrescrita pela série. As demais ocorrências continuam sendo geradas
              normalmente.
            </div>
            <div>Para encerrar uma série basta desativá-la ou definir <b>data fim</b>.</div>
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notificações</CardTitle>
          <CardDescription>
            Cada usuário define em <b>Notificações → Preferências</b> com quantos dias de
            antecedência quer ser avisado (ex.: 7 e 1) e se deve receber avisos de vencidos.
            Os alertas aparecem no sino ao topo do módulo. A geração roda uma vez por dia via
            agendamento no banco (pg_cron) — não há custo por acesso.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Duplicidade</CardTitle>
          <CardDescription>
            Ao salvar um lançamento, o sistema procura lançamentos semelhantes (mesmo valor,
            pessoa, centro de custo e vencimento próximo) e mostra um alerta. O salvamento
            <b> não é bloqueado</b>: você decide se é duplicado ou não.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auditoria</CardTitle>
          <CardDescription>
            Toda criação, edição ou exclusão em cadastros, lançamentos, imóveis, repasses e
            recorrências fica registrada em <b>Auditoria</b>, com autor, data e diff dos campos.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}