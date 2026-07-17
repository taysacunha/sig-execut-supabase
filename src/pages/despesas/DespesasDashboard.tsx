import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Building2, ArrowLeftRight, Database } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDespesasPermissions } from "@/hooks/useDespesasPermissions";

export default function DespesasDashboard() {
  const navigate = useNavigate();
  const { podeVer } = useDespesasPermissions();

  const tiles = [
    { key: "calendario" as const, title: "Calendário", desc: "Contas a pagar e receber", icon: Wallet, url: "/despesas/calendario" },
    { key: "imoveis" as const, title: "Imóveis", desc: "IPTU, TCR e SPU", icon: Building2, url: "/despesas/imoveis" },
    { key: "repasses" as const, title: "Repasses", desc: "Aluguéis e proprietários", icon: ArrowLeftRight, url: "/despesas/repasses" },
    { key: "cadastros" as const, title: "Cadastros", desc: "Categorias, contas, pessoas, veículos", icon: Database, url: "/despesas/cadastros" },
  ].filter((t) => podeVer(t.key));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gestão de Despesas</h1>
        <p className="text-muted-foreground">Selecione uma aba para começar.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card
            key={t.key}
            className="cursor-pointer hover:border-primary/50 transition"
            onClick={() => navigate(t.url)}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <t.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">{t.title}</CardTitle>
              </div>
              <CardDescription>{t.desc}</CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
        {tiles.length === 0 && (
          <Card className="sm:col-span-2 lg:col-span-4">
            <CardHeader>
              <CardTitle>Sem abas disponíveis</CardTitle>
              <CardDescription>
                Solicite ao administrador acesso às abas do módulo Despesas em Permissões por Aba.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}