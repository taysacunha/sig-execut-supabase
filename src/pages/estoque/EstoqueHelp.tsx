import {
  HelpCircle,
  Home,
  Package,
  Tag,
  MapPin,
  PackageOpen,
  Flag,
  ClipboardList,
  ArrowDownUp,
  Bell,
  Users,
  Shield,
  History,
  ArrowRight,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Search,
} from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";


const Step = ({ children }: { children: React.ReactNode }) => (
  <ol className="list-decimal ml-6 space-y-2 text-sm leading-relaxed">{children}</ol>
);

const Bullets = ({ children }: { children: React.ReactNode }) => (
  <ul className="list-disc ml-6 space-y-1 text-sm leading-relaxed">{children}</ul>
);

const topics = [
  { value: "visao-geral", label: "Visão Geral", keywords: "introdução, estoque, gestão, fluxo, permissões, papéis", description: "Conceitos gerais do sistema e fluxo de trabalho recomendado." },
  { value: "dashboard", label: "Dashboard", keywords: "dashboard, resumo, saldo total, itens mínimos, solicitações pendentes, placas", description: "Visão consolidada com atalhos para cada área." },
  { value: "materiais", label: "Materiais", keywords: "material, cadastro, placa, unidade, estoque mínimo, categoria, ativar, inativar, excluir", description: "Cadastro de itens e materiais do tipo placa." },
  { value: "categorias", label: "Categorias", keywords: "categoria, grupo, classificação, materiais", description: "Agrupamento de materiais para filtros e relatórios." },
  { value: "locais", label: "Locais", keywords: "local, depósito, armazenamento, unidade, saldo", description: "Pontos físicos de armazenamento vinculados a unidades." },
  { value: "saldos", label: "Saldos", keywords: "saldo, quantidade, estoque mínimo, entrada, ajuste, transferência, local", description: "Controle de saldo por material e local." },
  { value: "placas", label: "Placas", keywords: "placa, venda, aluga, 1x1, 2x2, disponível, instalada, baixada, instalação, retirada, roubo, perda", description: "Ciclo de vida de cada placa física." },
  { value: "solicitacoes", label: "Solicitações", keywords: "solicitação, pedido, aprovar, recusar, pendente, material", description: "Fluxo de pedidos e aprovações." },
  { value: "movimentacoes", label: "Movimentações", keywords: "movimentação, entrada, saída, ajuste, transferência, histórico, exportar", description: "Todas as alterações de saldo." },
  { value: "notificacoes", label: "Notificações", keywords: "notificação, alerta, saldo mínimo, pendente", description: "Avisos automáticos do sistema." },
  { value: "gestores", label: "Gestores e Usuários", keywords: "gestor, usuário, papel, permissão, unidade, administrador, gerente, supervisor, colaborador", description: "Vínculo de gestores e permissões de acesso." },
  { value: "usuarios", label: "Perfil e Segurança", keywords: "perfil, senha, auditoria, histórico, segurança, sessão", description: "Perfil do usuário, auditoria e boas práticas." },
];

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const EstoqueHelp = () => {
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [searchQuery, setSearchQuery] = useState("");

  const normalizedQuery = normalize(searchQuery).trim();
  const results = normalizedQuery
    ? topics.filter((t) => {
        const haystack = normalize(`${t.label} ${t.keywords} ${t.description}`);
        return normalizedQuery.split(/\s+/).every((term) => haystack.includes(term));
      })
    : [];

  const handleResultClick = (value: string) => {
    setActiveTab(value);
    setSearchQuery("");
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <HelpCircle className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Central de Ajuda</h1>
        </div>
        <p className="text-muted-foreground">
          Guia completo para utilizar o sistema de Gestão de Estoques
        </p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Buscar tópicos como Placas, Saldos, Movimentações..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {results.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
            <ul className="py-1 max-h-60 overflow-auto">
              {results.map((t) => (
                <li key={t.value}>
                  <button
                    type="button"
                    onClick={() => handleResultClick(t.value)}
                    className="w-full text-left px-4 py-2 hover:bg-accent hover:text-accent-foreground focus:outline-none focus:bg-accent focus:text-accent-foreground"
                  >
                    <div className="font-medium text-sm">{t.label}</div>
                    <div className="text-xs text-muted-foreground">{t.description}</div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {normalizedQuery && results.length === 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md px-4 py-2 text-sm text-muted-foreground">
            Nenhum tópico encontrado.
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-2 justify-start">
          <TabsTrigger value="visao-geral" className="flex items-center gap-2"><Home className="h-4 w-4" /><span className="hidden sm:inline">Visão Geral</span></TabsTrigger>
          <TabsTrigger value="dashboard" className="flex items-center gap-2"><FileText className="h-4 w-4" /><span className="hidden sm:inline">Dashboard</span></TabsTrigger>
          <TabsTrigger value="materiais" className="flex items-center gap-2"><Package className="h-4 w-4" /><span className="hidden sm:inline">Materiais</span></TabsTrigger>
          <TabsTrigger value="categorias" className="flex items-center gap-2"><Tag className="h-4 w-4" /><span className="hidden sm:inline">Categorias</span></TabsTrigger>
          <TabsTrigger value="locais" className="flex items-center gap-2"><MapPin className="h-4 w-4" /><span className="hidden sm:inline">Locais</span></TabsTrigger>
          <TabsTrigger value="saldos" className="flex items-center gap-2"><PackageOpen className="h-4 w-4" /><span className="hidden sm:inline">Saldos</span></TabsTrigger>
          <TabsTrigger value="placas" className="flex items-center gap-2"><Flag className="h-4 w-4" /><span className="hidden sm:inline">Placas</span></TabsTrigger>
          <TabsTrigger value="solicitacoes" className="flex items-center gap-2"><ClipboardList className="h-4 w-4" /><span className="hidden sm:inline">Solicitações</span></TabsTrigger>
          <TabsTrigger value="movimentacoes" className="flex items-center gap-2"><ArrowDownUp className="h-4 w-4" /><span className="hidden sm:inline">Movimentações</span></TabsTrigger>
          <TabsTrigger value="notificacoes" className="flex items-center gap-2"><Bell className="h-4 w-4" /><span className="hidden sm:inline">Notificações</span></TabsTrigger>
          <TabsTrigger value="gestores" className="flex items-center gap-2"><Users className="h-4 w-4" /><span className="hidden sm:inline">Gestores</span></TabsTrigger>
          <TabsTrigger value="usuarios" className="flex items-center gap-2"><Shield className="h-4 w-4" /><span className="hidden sm:inline">Perfil e Segurança</span></TabsTrigger>
        </TabsList>

        {/* VISÃO GERAL */}
        <TabsContent value="visao-geral" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Home className="h-5 w-5" /> O que é o sistema de Gestão de Estoques?</CardTitle>
              <CardDescription>Plataforma para controlar materiais, saldos por local, solicitações, movimentações e o ciclo de vida das placas de venda/aluguel.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <p>
                O sistema centraliza o cadastro de <strong>materiais</strong> e <strong>categorias</strong>,
                os <strong>locais</strong> de armazenamento, os <strong>saldos</strong> por material × local,
                o fluxo de <strong>solicitações</strong> e <strong>movimentações</strong> (entradas, saídas, ajustes e transferências)
                e o controle individual de cada <strong>placa</strong> física instalada em imóveis.
              </p>
              <p>
                Notificações automáticas avisam quando algum saldo fica abaixo do mínimo e quando uma
                solicitação precisa de aprovação. Todas as ações ficam registradas na auditoria.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ArrowRight className="h-5 w-5" /> Fluxo de trabalho recomendado</CardTitle>
              <CardDescription>Configure o sistema seguindo esta ordem.</CardDescription>
            </CardHeader>
            <CardContent>
              <Step>
                <li><strong>Categorias</strong> — cadastre os grupos (ex.: Placas, EPIs, Material de escritório).</li>
                <li><strong>Locais</strong> — cadastre depósitos e pontos de armazenamento, vinculados a unidades.</li>
                <li><strong>Materiais</strong> — cadastre cada item, definindo unidade de medida, estoque mínimo e se é do tipo placa.</li>
                <li><strong>Saldos</strong> — registre o saldo inicial de cada material por local.</li>
                <li><strong>Solicitações</strong> — colaboradores solicitam materiais; gestores aprovam.</li>
                <li><strong>Movimentações</strong> — entradas, saídas, ajustes e transferências atualizam o saldo.</li>
                <li><strong>Placas</strong> — para materiais do tipo placa, acompanhe cada unidade física e seu status.</li>
                <li><strong>Notificações</strong> — acompanhe alertas de estoque mínimo e solicitações pendentes.</li>
              </Step>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Papéis e permissões</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed">
              <Bullets>
                <li><Badge className="bg-purple-600 text-white mr-1">Super Admin</Badge> acesso total, incluindo auditoria e gestão de usuários.</li>
                <li><Badge className="bg-destructive/80 text-destructive-foreground mr-1">Administrador</Badge> mesma autonomia operacional, com acesso à auditoria.</li>
                <li><Badge className="bg-primary/80 text-primary-foreground mr-1">Gerente</Badge> aprova solicitações e gerencia saldos das unidades/locais vinculados.</li>
                <li><Badge className="bg-blue-600/80 text-white mr-1">Supervisor</Badge> acompanha saldos e movimentações de sua área.</li>
                <li><Badge className="bg-secondary text-secondary-foreground mr-1">Colaborador</Badge> abre solicitações e consulta saldos permitidos.</li>
              </Bullets>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Dashboard</CardTitle>
              <CardDescription>Visão consolidada do estoque.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed">
              <Bullets>
                <li><strong>Total de materiais</strong> ativos cadastrados.</li>
                <li><strong>Saldo total</strong> somando todos os locais.</li>
                <li><strong>Itens abaixo do mínimo</strong> — clique para abrir a lista.</li>
                <li><strong>Solicitações pendentes</strong> aguardando aprovação.</li>
                <li><strong>Placas instaladas</strong> e disponíveis.</li>
              </Bullets>
              <Alert>
                <Lightbulb className="h-4 w-4" />
                <AlertTitle>Dica</AlertTitle>
                <AlertDescription>Cada card é um atalho para a página correspondente já filtrada.</AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MATERIAIS */}
        <TabsContent value="materiais" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Materiais</CardTitle>
              <CardDescription>Cadastro de itens controlados pelo estoque.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <p>Existem dois tipos de cadastro:</p>
              <Bullets>
                <li><strong>Material comum</strong> — qualquer item de consumo (EPI, papelaria, etc.).</li>
                <li><strong>Material do tipo Placa</strong> — placas físicas de Venda/Aluga em diferentes tamanhos (1x1, 2x2, outro). Use o botão <em>Nova Placa</em>.</li>
              </Bullets>
              <p><strong>Campos principais:</strong></p>
              <Bullets>
                <li>Nome, categoria, unidade de medida (un, m, kg…).</li>
                <li>Estoque mínimo — dispara alerta quando o saldo total cai abaixo.</li>
                <li>Descrição opcional e status ativo/inativo.</li>
              </Bullets>
              <Separator />
              <p><strong>Ações:</strong> editar, ativar/inativar e excluir. A exclusão exige confirmação por <em>AlertDialog</em>.</p>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Atenção</AlertTitle>
                <AlertDescription>
                  Não exclua materiais com saldo ou movimentações históricas — prefira inativar para preservar o histórico.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CATEGORIAS */}
        <TabsContent value="categorias" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5" /> Categorias</CardTitle>
              <CardDescription>Agrupam materiais para filtros e relatórios.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed">
              <Step>
                <li>Clique em <strong>Nova categoria</strong>.</li>
                <li>Informe nome e descrição.</li>
                <li>Salve. A categoria já fica disponível no cadastro de materiais.</li>
              </Step>
              <Alert>
                <Lightbulb className="h-4 w-4" />
                <AlertTitle>Dica</AlertTitle>
                <AlertDescription>Inativar uma categoria não remove os materiais já associados — eles continuam funcionando normalmente.</AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LOCAIS */}
        <TabsContent value="locais" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Locais</CardTitle>
              <CardDescription>Pontos físicos onde os materiais ficam armazenados.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed">
              <Bullets>
                <li>Cada local pode estar vinculado a uma <strong>unidade</strong> da empresa.</li>
                <li>O saldo é sempre por <strong>material × local</strong>, então cadastre os depósitos antes de registrar saldos.</li>
                <li>Locais inativos não aparecem em novas movimentações, mas preservam o histórico.</li>
              </Bullets>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SALDOS */}
        <TabsContent value="saldos" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><PackageOpen className="h-5 w-5" /> Saldos</CardTitle>
              <CardDescription>Saldo atual por material e local.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <Step>
                <li>Selecione o material e o local.</li>
                <li>Informe a quantidade (entrada, ajuste ou transferência).</li>
                <li>Confirme. O saldo é recalculado automaticamente.</li>
              </Step>
              <Bullets>
                <li>Itens abaixo do <strong>estoque mínimo</strong> aparecem destacados.</li>
                <li>Filtros por categoria, material e local ajudam a localizar rapidamente.</li>
              </Bullets>
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Placas</AlertTitle>
                <AlertDescription>
                  Para materiais do tipo placa, o saldo é controlado aqui em <strong>Saldos</strong> e
                  cada unidade física aparece em <strong>/estoque/placas</strong>.
                  A baixa de uma unidade só ocorre quando ela é instalada/baixada na página Placas.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PLACAS */}
        <TabsContent value="placas" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Flag className="h-5 w-5" /> Placas</CardTitle>
              <CardDescription>Controle individual de cada placa física.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <p><strong>Fluxo correto:</strong></p>
              <Step>
                <li>Cadastre o material do tipo placa em <strong>Materiais</strong> (ex.: Placa Aluga 1x1 Lona).</li>
                <li>Registre o <strong>saldo</strong> dessa placa em <strong>Saldos</strong>, por local.</li>
                <li>Em <strong>Placas</strong> acompanhe cada unidade física, com código atribuído na entrada/saída.</li>
              </Step>
              <Separator />
              <p><strong>Abas:</strong></p>
              <Bullets>
                <li><Badge className="bg-green-500/20 text-green-400 border border-green-500/30 mr-1">Disponíveis</Badge> em depósito, prontas para instalação.</li>
                <li><Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 mr-1">Instaladas</Badge> em imóveis, com código do imóvel atual.</li>
                <li><Badge className="bg-gray-500/20 text-gray-400 border border-gray-500/30 mr-1">Baixadas</Badge> roubadas, perdidas ou descartadas.</li>
              </Bullets>
              <p><strong>Filtros:</strong> material, tipo (venda/aluga), tamanho (1x1, 2x2, outro) e local.</p>
              <Separator />
              <p><strong>Ações disponíveis:</strong></p>
              <Bullets>
                <li><strong>Nova saída</strong> — instala uma placa em um imóvel e consome 1 unidade do saldo do material/local.</li>
                <li><strong>Retirada</strong> — devolve a placa ao depósito.</li>
                <li><strong>Roubo / Perda / Baixa</strong> — registra fim do ciclo de vida com observação obrigatória.</li>
              </Bullets>
              <p>Cada placa tem <strong>histórico</strong> completo de eventos (criação, instalações, retiradas, baixa) e é possível gerar PDF.</p>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Baixa é definitiva</AlertTitle>
                <AlertDescription>Placas baixadas não voltam para o saldo. Confira antes de confirmar.</AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SOLICITAÇÕES */}
        <TabsContent value="solicitacoes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" /> Solicitações</CardTitle>
              <CardDescription>Pedido formal de material por um colaborador.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <Step>
                <li>O colaborador clica em <strong>Nova solicitação</strong>, escolhe o material, quantidade e justificativa.</li>
                <li>A solicitação fica <Badge variant="outline">Pendente</Badge> e gera notificação para os gestores.</li>
                <li>O gestor <Badge className="bg-green-600 text-white">Aprova</Badge> ou <Badge className="bg-destructive text-destructive-foreground">Recusa</Badge>.</li>
                <li>Após aprovada, registre a saída em <strong>Movimentações</strong> para baixar o saldo.</li>
              </Step>
              <Alert>
                <Lightbulb className="h-4 w-4" />
                <AlertTitle>Dica</AlertTitle>
                <AlertDescription>Use filtros por status e período para acompanhar pendências.</AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MOVIMENTAÇÕES */}
        <TabsContent value="movimentacoes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ArrowDownUp className="h-5 w-5" /> Movimentações</CardTitle>
              <CardDescription>Toda alteração de saldo é uma movimentação.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed">
              <Bullets>
                <li><strong>Entrada</strong> — recebimento de material no depósito.</li>
                <li><strong>Saída</strong> — consumo, atendimento de solicitação, instalação de placa.</li>
                <li><strong>Ajuste</strong> — correção de divergência após inventário.</li>
                <li><strong>Transferência</strong> — move quantidade de um local para outro.</li>
              </Bullets>
              <p>É possível filtrar por tipo, material, local, usuário e período, e exportar a lista.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* NOTIFICAÇÕES */}
        <TabsContent value="notificacoes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Notificações</CardTitle>
              <CardDescription>Avisos automáticos do sistema.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed">
              <Bullets>
                <li>Saldo abaixo do estoque mínimo.</li>
                <li>Nova solicitação aguardando aprovação.</li>
                <li>Solicitação aprovada/recusada (para o autor).</li>
              </Bullets>
              <p>O <Badge className="bg-destructive text-destructive-foreground">contador</Badge> ao lado do item <strong>Notificações</strong> no menu mostra o total de não lidas. Clique em uma notificação para abrir o item relacionado e marcá-la como lida.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* GESTORES */}
        <TabsContent value="gestores" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Gestores e Usuários</CardTitle>
              <CardDescription>Quem pode acessar o módulo e o que pode fazer.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed">
              <Bullets>
                <li>Vincule cada gestor às <strong>unidades</strong> que ele administra — ele só verá os locais e saldos dessas unidades.</li>
                <li>Conceda acesso ao módulo Estoque ao usuário em <strong>Usuários</strong>.</li>
                <li>Defina o papel (administrador, gerente, supervisor, colaborador) conforme a responsabilidade.</li>
              </Bullets>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Segurança</AlertTitle>
                <AlertDescription>Conceda perfil de administrador apenas para quem realmente precisa — esses usuários enxergam todos os dados e a auditoria.</AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PERFIL / SEGURANÇA */}
        <TabsContent value="usuarios" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Perfil e Segurança</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed">
              <Bullets>
                <li>Em <strong>Perfil</strong> atualize nome, e-mail e senha.</li>
                <li>Administradores acessam <strong>Auditoria</strong> (<History className="inline h-4 w-4" />) com todas as ações registradas (quem, quando, o que mudou).</li>
                <li>Sessões expiram após inatividade — faça login novamente quando necessário.</li>
              </Bullets>
              <Alert>
                <Lightbulb className="h-4 w-4" />
                <AlertTitle>Boas práticas</AlertTitle>
                <AlertDescription>Não compartilhe sua senha. Em caso de dúvida sobre uma movimentação, consulte a auditoria antes de corrigir.</AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EstoqueHelp;