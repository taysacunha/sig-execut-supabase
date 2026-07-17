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
          <CardTitle>Como funcionam as permissões</CardTitle>
          <CardDescription>
            Cada usuário recebe um nível por aba (Calendário, Imóveis, Repasses, Cadastros):
            <b> sem acesso</b> (não vê a aba), <b>visualizar</b>, <b>editar</b> ou <b>excluir</b>.
            Além disso, um administrador pode restringir a quais centros de custo cada usuário tem acesso.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Abas do módulo</CardTitle>
          <CardDescription>
            <b>Calendário</b>: contas a pagar/receber, com múltiplas formas de pagamento. <br />
            <b>Imóveis</b>: IPTU, TCR, SPU e situação de cada imóvel. <br />
            <b>Repasses</b>: repasses mensais aos proprietários. <br />
            <b>Cadastros</b>: categorias, planos de conta, contas bancárias, pessoas, veículos.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}