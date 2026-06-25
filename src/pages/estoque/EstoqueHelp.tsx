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
  PlayCircle,
  ListChecks,
  MessagesSquare,
} from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const Step = ({ children }: { children: React.ReactNode }) => (
  <ol className="list-decimal ml-6 space-y-2 text-sm leading-relaxed">{children}</ol>
);

const Bullets = ({ children }: { children: React.ReactNode }) => (
  <ul className="list-disc ml-6 space-y-1 text-sm leading-relaxed">{children}</ul>
);

const HowTo = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-md border border-border bg-muted/30 p-4 space-y-2">
    <div className="flex items-center gap-2 text-sm font-semibold">
      <ListChecks className="h-4 w-4 text-primary" />
      {title}
    </div>
    <Step>{children}</Step>
  </div>
);

const Scenario = ({
  title,
  context,
  children,
}: {
  title: string;
  context?: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-md border border-border p-4 space-y-2">
    <div className="flex items-center gap-2 text-sm font-semibold">
      <PlayCircle className="h-4 w-4 text-primary" />
      {title}
    </div>
    {context && <p className="text-xs text-muted-foreground italic">{context}</p>}
    <Step>{children}</Step>
  </div>
);

type FaqItem = { q: string; a: React.ReactNode };
const Faq = ({ items, idPrefix }: { items: FaqItem[]; idPrefix: string }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2 text-sm font-semibold">
      <MessagesSquare className="h-4 w-4 text-primary" />
      Perguntas frequentes
    </div>
    <Accordion type="single" collapsible className="w-full">
      {items.map((it, i) => (
        <AccordionItem key={i} value={`${idPrefix}-${i}`}>
          <AccordionTrigger className="text-sm text-left">{it.q}</AccordionTrigger>
          <AccordionContent className="text-sm leading-relaxed">{it.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  </div>
);

const topics = [
  { value: "visao-geral", label: "Visão Geral", keywords: "introdução, estoque, gestão, fluxo, permissões, papéis, primeiros passos, checklist, começar", description: "Conceitos gerais, fluxo recomendado e checklist inicial." },
  { value: "dashboard", label: "Dashboard", keywords: "dashboard, resumo, saldo total, itens mínimos, solicitações pendentes, placas, atalhos", description: "Visão consolidada com atalhos para cada área." },
  { value: "materiais", label: "Materiais", keywords: "material, cadastro, placa, unidade, estoque mínimo, categoria, ativar, inativar, excluir, recuperar", description: "Cadastro de itens e materiais do tipo placa." },
  { value: "categorias", label: "Categorias", keywords: "categoria, grupo, classificação, materiais, renomear", description: "Agrupamento de materiais para filtros e relatórios." },
  { value: "locais", label: "Locais", keywords: "local, depósito, armazenamento, unidade, saldo, transferência", description: "Pontos físicos de armazenamento vinculados a unidades." },
  { value: "saldos", label: "Saldos", keywords: "saldo, quantidade, estoque mínimo, entrada, ajuste, transferência, local, contagem, divergência, inventário, recebimento", description: "Controle de saldo por material e local." },
  { value: "placas", label: "Placas", keywords: "placa, venda, aluga, 1x1, 2x2, disponível, instalada, baixada, instalação, retirada, roubo, perda, devolução, extravio, imóvel", description: "Ciclo de vida de cada placa física." },
  { value: "solicitacoes", label: "Solicitações", keywords: "solicitação, pedido, aprovar, recusar, pendente, material, justificativa", description: "Fluxo de pedidos e aprovações." },
  { value: "movimentacoes", label: "Movimentações", keywords: "movimentação, entrada, saída, ajuste, transferência, histórico, exportar, csv, relatório, mês", description: "Todas as alterações de saldo." },
  { value: "notificacoes", label: "Notificações", keywords: "notificação, alerta, saldo mínimo, pendente, lida, contador", description: "Avisos automáticos do sistema." },
  { value: "gestores", label: "Gestores e Usuários", keywords: "gestor, usuário, papel, permissão, unidade, administrador, gerente, supervisor, colaborador, convidar, acesso", description: "Vínculo de gestores e permissões de acesso." },
  { value: "usuarios", label: "Perfil e Segurança", keywords: "perfil, senha, auditoria, histórico, segurança, sessão, recuperar, alterar", description: "Perfil do usuário, auditoria e boas práticas." },
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
          Guia completo para utilizar o sistema de Gestão de Estoques — com passo a passo, cenários práticos e perguntas frequentes.
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
                o fluxo de <strong>solicitações</strong> e <strong>movimentações</strong> e o controle individual de cada <strong>placa</strong> física.
              </p>
              <p>
                Notificações automáticas avisam quando algum saldo fica abaixo do mínimo e quando uma
                solicitação precisa de aprovação. Todas as ações ficam registradas na auditoria.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ArrowRight className="h-5 w-5" /> Guia rápido — primeiros passos</CardTitle>
              <CardDescription>Para quem nunca usou o sistema. Siga nesta ordem.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <HowTo title="Configuração inicial completa">
                <li>Abra <strong>Categorias</strong> no menu lateral e cadastre os grupos (ex.: Placas, EPIs, Material de escritório).</li>
                <li>Abra <strong>Locais</strong> e cadastre cada depósito/ponto de armazenamento, vinculando à unidade correspondente.</li>
                <li>Abra <strong>Materiais</strong>. Para itens comuns use <em>Novo material</em>; para placas use <em>Nova Placa</em> (escolha tipo Venda/Aluga e tamanho).</li>
                <li>Abra <strong>Saldos</strong> e registre a quantidade inicial de cada material em cada local.</li>
                <li>Configure os usuários em <strong>Gestores</strong> e <strong>Usuários</strong>, definindo papel e unidades.</li>
                <li>Pronto: colaboradores já podem abrir <strong>Solicitações</strong> e a equipe pode movimentar estoque.</li>
              </HowTo>
              <Alert>
                <Lightbulb className="h-4 w-4" />
                <AlertTitle>Dica</AlertTitle>
                <AlertDescription>Configure o <strong>estoque mínimo</strong> em cada material para receber alerta antes do estoque acabar.</AlertDescription>
              </Alert>
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

          <Card>
            <CardContent className="pt-6">
              <Faq idPrefix="vg" items={[
                { q: "Por onde devo começar?", a: <>Pelo guia rápido acima: <strong>Categorias → Locais → Materiais → Saldos</strong>. Sem essa base, as outras telas ficam vazias.</> },
                { q: "Posso pular o cadastro de Categorias?", a: "Tecnicamente sim, mas você perde os filtros e os relatórios por grupo. Recomendamos cadastrar ao menos as principais." },
                { q: "Qual a diferença entre Material e Placa?", a: <>Placa é um tipo especial de material. Ela é cadastrada em <strong>Materiais</strong> (como Placa Aluga 1x1), tem saldo em <strong>Saldos</strong> e cada unidade física é controlada em <strong>Placas</strong>.</> },
                { q: "Quem vê meus dados?", a: "Cada gestor vê apenas as unidades vinculadas a ele. Administradores e Super Admins veem tudo, incluindo a auditoria." },
              ]} />
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
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <Bullets>
                <li><strong>Total de materiais</strong> ativos cadastrados.</li>
                <li><strong>Saldo total</strong> somando todos os locais.</li>
                <li><strong>Itens abaixo do mínimo</strong> — clique para abrir a lista.</li>
                <li><strong>Solicitações pendentes</strong> aguardando aprovação.</li>
                <li><strong>Placas instaladas</strong> e disponíveis.</li>
              </Bullets>

              <HowTo title="Como usar o dashboard no dia a dia">
                <li>Ao entrar no sistema, comece pelo Dashboard.</li>
                <li>Olhe o card <strong>Itens abaixo do mínimo</strong> — se houver número &gt; 0, clique para resolver primeiro.</li>
                <li>Em seguida, verifique <strong>Solicitações pendentes</strong> e aprove/recuse as do dia.</li>
                <li>Use os cards de placas para checar quantas estão disponíveis antes de aceitar novas instalações.</li>
              </HowTo>

              <Scenario title="Cenário: começando o dia" context="Você é gestor e abriu o sistema agora">
                <li>Dashboard mostra 3 itens abaixo do mínimo e 5 solicitações pendentes.</li>
                <li>Clique no card de itens mínimos → você vai para Saldos já filtrado.</li>
                <li>Programe a reposição (compra ou transferência) para esses itens.</li>
                <li>Volte ao menu e abra Solicitações para resolver as pendências.</li>
              </Scenario>

              <Faq idPrefix="dash" items={[
                { q: "Por que meu Dashboard está zerado?", a: <>Provavelmente faltam dados. Verifique se há <strong>materiais ativos</strong>, <strong>locais ativos</strong> e <strong>saldos</strong> registrados.</> },
                { q: "Os números atualizam em tempo real?", a: "Sim. Cada movimentação ou solicitação reflete imediatamente nos cards ao recarregar a página." },
                { q: "Posso filtrar o Dashboard por unidade?", a: "O Dashboard já considera as unidades às quais você tem acesso. Gestores veem apenas as suas." },
              ]} />
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
                <li><strong>Material do tipo Placa</strong> — placas de Venda/Aluga em diferentes tamanhos (1x1, 2x2, outro).</li>
              </Bullets>

              <HowTo title="Cadastrar um material comum">
                <li>Abra <strong>Estoque → Materiais</strong>.</li>
                <li>Clique em <strong>Novo material</strong>.</li>
                <li>Preencha <strong>Nome</strong>, escolha a <strong>Categoria</strong> e a <strong>Unidade de medida</strong> (un, m, kg…).</li>
                <li>Informe o <strong>Estoque mínimo</strong> (gera alerta quando o saldo total cai abaixo).</li>
                <li>Opcionalmente adicione descrição. Deixe <strong>Ativo</strong> marcado.</li>
                <li>Clique em <strong>Salvar</strong>. O material já fica disponível para receber saldo.</li>
              </HowTo>

              <HowTo title="Cadastrar uma placa">
                <li>Em <strong>Materiais</strong>, clique em <strong>Nova Placa</strong>.</li>
                <li>Preencha o <strong>Nome</strong> (ex.: Placa Aluga 1x1 Lona).</li>
                <li>Escolha o <strong>Tipo</strong> (Venda ou Aluga) e o <strong>Tamanho</strong> (1x1, 2x2, Outro).</li>
                <li>Defina <strong>Categoria</strong>, <strong>Unidade</strong> (geralmente "un") e <strong>Estoque mínimo</strong>.</li>
                <li>Salve. Depois vá em <strong>Saldos</strong> para registrar quantas existem em cada local.</li>
              </HowTo>

              <Scenario title="Cenário: chegou um lote novo de placas" context="100 placas Aluga 1x1 entregues no depósito Matriz">
                <li>Confirme que a Placa Aluga 1x1 já existe em <strong>Materiais</strong>. Se não, cadastre.</li>
                <li>Vá em <strong>Saldos</strong>, clique em <strong>Nova entrada</strong>.</li>
                <li>Selecione o material e o local <em>Depósito Matriz</em>, informe quantidade 100 e justifique como "Recebimento fornecedor X".</li>
                <li>Salve. As 100 unidades aparecem como saldo e podem ser instaladas em imóveis pela página <strong>Placas</strong>.</li>
              </Scenario>

              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Atenção</AlertTitle>
                <AlertDescription>Não exclua materiais com saldo ou movimentações históricas — prefira <strong>inativar</strong> para preservar o histórico.</AlertDescription>
              </Alert>

              <Faq idPrefix="mat" items={[
                { q: "Por que não consigo excluir um material?", a: "Porque ele possui saldo ou movimentações registradas. A regra protege o histórico. Use Inativar para tirar de uso." },
                { q: "Qual a diferença entre inativar e excluir?", a: <>Inativar esconde o material das telas de uso, mas mantém o histórico. Excluir só funciona se nunca houve movimentação.</> },
                { q: "Apaguei um material por engano — recupero?", a: <>Não é possível restaurar automaticamente. Cadastre novamente. Para investigar quem apagou, peça ao administrador para consultar a <strong>Auditoria</strong>.</> },
                { q: "Posso mudar o estoque mínimo depois?", a: "Sim, basta editar o material. A alteração começa a valer imediatamente para os alertas." },
                { q: "Posso transformar um material comum em placa?", a: "Não. O tipo é definido no cadastro. Crie um novo material como placa." },
              ]} />
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
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <HowTo title="Criar uma categoria">
                <li>Abra <strong>Estoque → Categorias</strong>.</li>
                <li>Clique em <strong>Nova categoria</strong>.</li>
                <li>Informe <strong>Nome</strong> e, opcionalmente, <strong>Descrição</strong>.</li>
                <li>Salve. A categoria já aparece no cadastro de materiais.</li>
              </HowTo>

              <HowTo title="Editar ou inativar uma categoria">
                <li>Na lista, clique no ícone de <strong>editar</strong> para renomear.</li>
                <li>Para inativar, use a opção <strong>Inativar</strong>. Os materiais associados continuam funcionando.</li>
              </HowTo>

              <Scenario title="Cenário: reorganizando o estoque">
                <li>Você percebeu que tudo está em "Geral".</li>
                <li>Crie categorias específicas: Placas, EPIs, Papelaria, Limpeza.</li>
                <li>Edite cada material e selecione a nova categoria.</li>
                <li>Agora os filtros em Saldos e Movimentações ficam muito mais úteis.</li>
              </Scenario>

              <Faq idPrefix="cat" items={[
                { q: "Posso excluir uma categoria com materiais?", a: "Não. Mova ou inative os materiais antes, ou apenas inative a categoria." },
                { q: "Inativar a categoria afeta os materiais?", a: "Não. Eles continuam funcionando, mas a categoria deixa de aparecer em novos cadastros." },
              ]} />
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
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <HowTo title="Cadastrar um local">
                <li>Abra <strong>Estoque → Locais</strong>.</li>
                <li>Clique em <strong>Novo local</strong>.</li>
                <li>Informe <strong>Nome</strong> (ex.: Depósito Matriz) e selecione a <strong>Unidade</strong> da empresa.</li>
                <li>Salve. O local fica disponível em Saldos, Movimentações e Placas.</li>
              </HowTo>

              <Scenario title="Cenário: nova filial recebeu um depósito">
                <li>Crie a Unidade da filial (se ainda não existir).</li>
                <li>Cadastre o local <em>Depósito Filial Sul</em> vinculado a ela.</li>
                <li>Em <strong>Saldos</strong>, faça uma <strong>Transferência</strong> da Matriz para a Filial com a quantidade enviada.</li>
              </Scenario>

              <Faq idPrefix="loc" items={[
                { q: "Posso excluir um local?", a: "Apenas se ele nunca teve saldo nem movimentação. Caso contrário, inative." },
                { q: "Local inativo some do histórico?", a: "Não. O histórico é preservado; ele só não aparece em novos cadastros." },
                { q: "Preciso cadastrar um local por andar/sala?", a: "Depende do controle desejado. Quanto mais granular, mais preciso o saldo, mas mais trabalho operacional." },
              ]} />
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
              <HowTo title="Registrar uma entrada de material">
                <li>Abra <strong>Estoque → Saldos</strong>.</li>
                <li>Clique em <strong>Nova entrada</strong> (ou <strong>Nova movimentação → Entrada</strong>).</li>
                <li>Escolha o <strong>Material</strong> e o <strong>Local</strong>.</li>
                <li>Informe a <strong>Quantidade</strong> e uma <strong>Justificativa</strong> (ex.: recebimento NF 123).</li>
                <li>Confirme. O saldo é somado automaticamente.</li>
              </HowTo>

              <HowTo title="Fazer um ajuste após contagem">
                <li>Na lista de saldos, localize o material/local.</li>
                <li>Clique em <strong>Ajustar</strong>.</li>
                <li>Informe o novo valor real encontrado e justifique (ex.: contagem mensal).</li>
                <li>Confirme. O sistema registra a diferença na auditoria.</li>
              </HowTo>

              <HowTo title="Transferir material entre locais">
                <li>Clique em <strong>Nova transferência</strong>.</li>
                <li>Selecione o material, o <strong>local de origem</strong> e o <strong>local de destino</strong>.</li>
                <li>Informe a quantidade. Confirme. Sai do origem, entra no destino — em uma única operação.</li>
              </HowTo>

              <Scenario title="Cenário: o saldo físico não bate com o sistema" context="Contagem encontrou 87 unidades; sistema mostra 92">
                <li>Vá em <strong>Saldos</strong> e localize o item.</li>
                <li>Clique em <strong>Ajustar</strong> e informe 87.</li>
                <li>Justifique como "Ajuste de inventário — diferença de 5 un".</li>
                <li>Salve. A divergência fica registrada na auditoria para apuração.</li>
              </Scenario>

              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Placas</AlertTitle>
                <AlertDescription>
                  Para materiais do tipo placa, o saldo é controlado aqui em <strong>Saldos</strong> e cada unidade física aparece em <strong>Placas</strong>. Instalar uma placa em imóvel consome 1 do saldo do local.
                </AlertDescription>
              </Alert>

              <Faq idPrefix="sal" items={[
                { q: "Por que o saldo aparece em vermelho?", a: "Porque está abaixo do estoque mínimo definido no material. Programe uma reposição." },
                { q: "Posso ter saldo negativo?", a: "Não. O sistema bloqueia saídas que ultrapassem o saldo disponível." },
                { q: "Qual a diferença entre Ajuste e Entrada?", a: "Entrada é recebimento real (NF, compra, devolução). Ajuste é correção de divergência — usa apenas para conciliar." },
                { q: "Saldo de placa não bate com a lista de Placas. Por quê?", a: <>Verifique se há instalações registradas sem dar baixa no saldo, ou placas <strong>Baixadas</strong> que ainda contam no histórico. Cada instalação consome 1 do saldo do local.</> },
              ]} />
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
              <p><strong>Fluxo correto em 3 etapas:</strong></p>
              <Step>
                <li>Cadastre o material do tipo placa em <strong>Materiais</strong>.</li>
                <li>Registre o <strong>saldo</strong> dessa placa em <strong>Saldos</strong>, por local.</li>
                <li>Use a página <strong>Placas</strong> para acompanhar cada unidade física e seu status.</li>
              </Step>

              <Separator />

              <p><strong>Status:</strong></p>
              <Bullets>
                <li><Badge className="bg-green-500/20 text-green-400 border border-green-500/30 mr-1">Disponíveis</Badge> em depósito, prontas para instalação.</li>
                <li><Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 mr-1">Instaladas</Badge> em imóveis, com código do imóvel atual.</li>
                <li><Badge className="bg-gray-500/20 text-gray-400 border border-gray-500/30 mr-1">Baixadas</Badge> roubadas, perdidas ou descartadas.</li>
              </Bullets>
              <p><strong>Filtros dentro de cada aba:</strong> material, tipo (Venda/Aluga), tamanho (1x1, 2x2, outro) e local.</p>

              <HowTo title="Instalar uma placa em um imóvel">
                <li>Abra <strong>Estoque → Placas</strong>, aba <strong>Disponíveis</strong>.</li>
                <li>Filtre por tipo e tamanho desejados (ex.: Aluga 1x1).</li>
                <li>Clique em <strong>Nova saída</strong> (ou na placa específica → <strong>Instalar</strong>).</li>
                <li>Informe o <strong>código do imóvel</strong>, endereço e a data.</li>
                <li>Confirme. A placa muda para <strong>Instalada</strong> e 1 unidade é debitada do saldo do local.</li>
              </HowTo>

              <HowTo title="Retirar uma placa instalada (devolução)">
                <li>Abra a aba <strong>Instaladas</strong>.</li>
                <li>Localize a placa pelo imóvel ou material.</li>
                <li>Clique em <strong>Retirar</strong> e selecione o local para onde ela volta.</li>
                <li>Confirme. A placa volta para <strong>Disponíveis</strong> e o saldo do local destino é incrementado.</li>
              </HowTo>

              <HowTo title="Dar baixa por roubo, perda ou descarte">
                <li>Localize a placa (na aba Disponíveis ou Instaladas).</li>
                <li>Clique em <strong>Baixar</strong>.</li>
                <li>Selecione o motivo: <em>Roubo</em>, <em>Perda</em> ou <em>Descarte</em>.</li>
                <li>Preencha a <strong>observação obrigatória</strong> (ex.: BO nº 1234).</li>
                <li>Confirme no AlertDialog. A placa vai para <strong>Baixadas</strong> e <u>não volta mais</u> ao saldo.</li>
              </HowTo>

              <Scenario title="Cenário: instalei placa 2x2 de Venda no imóvel A-501">
                <li>Vá em Placas → Disponíveis → filtre Tipo: Venda, Tamanho: 2x2.</li>
                <li>Clique em <strong>Nova saída</strong>.</li>
                <li>Informe código do imóvel A-501 e a data de instalação.</li>
                <li>Confirme. Placa fica como Instalada vinculada a A-501; saldo do depósito cai em 1.</li>
              </Scenario>

              <Scenario title="Cenário: cliente cancelou e a placa de aluguel voltou">
                <li>Aba Instaladas → encontre a placa do imóvel.</li>
                <li>Clique em <strong>Retirar</strong>, selecione o depósito de retorno.</li>
                <li>A placa volta para Disponíveis e pode ser reinstalada em outro imóvel.</li>
              </Scenario>

              <Scenario title="Cenário: placa instalada foi roubada">
                <li>Aba Instaladas → localize a placa.</li>
                <li>Clique em <strong>Baixar</strong> e selecione motivo <em>Roubo</em>.</li>
                <li>Anote o número do Boletim de Ocorrência na observação.</li>
                <li>Confirme. Placa fica como Baixada definitivamente; histórico preservado.</li>
              </Scenario>

              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Baixa é definitiva</AlertTitle>
                <AlertDescription>Placas baixadas não voltam para o saldo. Confira o motivo antes de confirmar.</AlertDescription>
              </Alert>

              <Faq idPrefix="pla" items={[
                { q: "Cadastrei a placa em Materiais mas ela não aparece em Placas. Por quê?", a: <>Faltou o passo 2: registrar o <strong>saldo</strong> em <strong>Saldos</strong>. Sem saldo, não há unidades físicas para listar.</> },
                { q: "Uma placa Baixada pode voltar a Disponível?", a: "Não. A baixa é definitiva. Se a placa reaparecer (ex.: foi achada), cadastre uma nova entrada de saldo." },
                { q: "Como vejo o histórico de uma placa?", a: "Clique na placa para abrir os detalhes — você vê criação, instalações, retiradas e baixa, com datas e responsáveis. É possível gerar PDF." },
                { q: "Posso mudar a placa de imóvel sem retirar?", a: "Não. O fluxo correto é Retirar (volta ao depósito) e depois nova Saída para o novo imóvel — assim o histórico fica claro." },
                { q: "Posso instalar várias placas de uma vez?", a: "Cada saída é registrada individualmente para manter rastreabilidade. Repita o fluxo para cada placa." },
              ]} />
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
              <HowTo title="Abrir uma solicitação (colaborador)">
                <li>Abra <strong>Estoque → Solicitações</strong>.</li>
                <li>Clique em <strong>Nova solicitação</strong>.</li>
                <li>Escolha o <strong>Material</strong>, informe a <strong>Quantidade</strong> e o <strong>Local</strong> desejado.</li>
                <li>Escreva uma <strong>Justificativa</strong> objetiva.</li>
                <li>Envie. O status fica <Badge variant="outline">Pendente</Badge> e os gestores são notificados.</li>
              </HowTo>

              <HowTo title="Aprovar ou recusar (gestor)">
                <li>Abra Solicitações e filtre por <em>Pendente</em>.</li>
                <li>Clique na solicitação para ver detalhes.</li>
                <li>Clique em <Badge className="bg-green-600 text-white">Aprovar</Badge> ou <Badge className="bg-destructive text-destructive-foreground">Recusar</Badge>. Se recusar, escreva o motivo.</li>
                <li>Após aprovada, vá em <strong>Movimentações</strong> e registre a <strong>Saída</strong> para baixar o saldo.</li>
              </HowTo>

              <Scenario title="Cenário: colaborador pede 10 placas Aluga 1x1">
                <li>Colaborador abre Nova solicitação e envia.</li>
                <li>Gestor recebe notificação e abre a solicitação.</li>
                <li>Confirma saldo disponível e clica em Aprovar.</li>
                <li>Vai em Movimentações → Nova saída, atendendo a solicitação.</li>
              </Scenario>

              <Scenario title="Cenário: pedido sem saldo suficiente">
                <li>Gestor abre a solicitação e vê que faltam unidades.</li>
                <li>Recusa com motivo "sem saldo — repor primeiro" ou aprova parcialmente.</li>
                <li>Programa entrada/transferência e orienta o colaborador a reabrir o pedido depois.</li>
              </Scenario>

              <Faq idPrefix="sol" items={[
                { q: "Posso editar uma solicitação enviada?", a: "Apenas enquanto estiver Pendente. Depois de aprovada/recusada, abra uma nova." },
                { q: "Aprovar dá baixa automática no saldo?", a: <>Não. Aprovar autoriza a saída. A baixa real ocorre quando o gestor registra a <strong>Saída</strong> em Movimentações.</> },
                { q: "Posso cancelar uma solicitação minha?", a: "Sim, enquanto estiver Pendente, com o botão Cancelar." },
              ]} />
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
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <Bullets>
                <li><strong>Entrada</strong> — recebimento de material no depósito.</li>
                <li><strong>Saída</strong> — consumo, atendimento de solicitação, instalação de placa.</li>
                <li><strong>Ajuste</strong> — correção de divergência após inventário.</li>
                <li><strong>Transferência</strong> — move quantidade de um local para outro.</li>
              </Bullets>

              <HowTo title="Registrar uma saída avulsa">
                <li>Abra <strong>Estoque → Movimentações</strong>.</li>
                <li>Clique em <strong>Nova movimentação → Saída</strong>.</li>
                <li>Selecione material, local, quantidade e justificativa.</li>
                <li>Se for atendimento de solicitação, referencie o número dela.</li>
                <li>Salve. Saldo do local é debitado imediatamente.</li>
              </HowTo>

              <HowTo title="Exportar o histórico do mês">
                <li>Em Movimentações, ajuste o filtro de <strong>Período</strong> para o mês desejado.</li>
                <li>Refine por tipo, material ou local se necessário.</li>
                <li>Clique em <strong>Exportar</strong> para baixar o arquivo CSV.</li>
              </HowTo>

              <Scenario title="Cenário: fechamento mensal">
                <li>No último dia do mês, filtre Movimentações por todo o mês.</li>
                <li>Exporte para CSV e arquive.</li>
                <li>Faça uma contagem física amostral e registre Ajustes onde houver divergência.</li>
              </Scenario>

              <Faq idPrefix="mov" items={[
                { q: "Posso apagar uma movimentação?", a: "Não. O histórico é imutável para garantir rastreabilidade. Se houver erro, registre uma movimentação corretiva (entrada ou ajuste)." },
                { q: "Quem fez a movimentação?", a: "Cada linha mostra o usuário responsável e a data/hora. A auditoria guarda o detalhe completo." },
                { q: "Como filtrar apenas placas?", a: "Use o filtro por categoria ou material específico — ou filtre pelo local que armazena placas." },
              ]} />
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
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <Bullets>
                <li>Saldo abaixo do estoque mínimo.</li>
                <li>Nova solicitação aguardando aprovação.</li>
                <li>Solicitação aprovada/recusada (para o autor).</li>
              </Bullets>

              <HowTo title="Consultar e marcar como lida">
                <li>No menu lateral, clique em <strong>Notificações</strong>. O número ao lado mostra as não lidas.</li>
                <li>Clique na notificação para abrir o item relacionado (solicitação, saldo, placa) — ela é marcada como lida automaticamente.</li>
                <li>Use <strong>Marcar todas como lidas</strong> para zerar o contador.</li>
              </HowTo>

              <Faq idPrefix="not" items={[
                { q: "Recebo notificação por e-mail?", a: "As notificações ficam no sistema. Verifique sempre o sino/menu Notificações ao entrar." },
                { q: "Posso desativar notificações?", a: "Não individualmente. Você controla quais aparecem pelo seu papel — gestores recebem solicitações; todos recebem alertas de saldo mínimo." },
                { q: "Por que ainda recebo alerta de saldo mínimo mesmo após repor?", a: "Recarregue a tela. As notificações antigas permanecem no histórico até serem marcadas como lidas." },
              ]} />
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
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <HowTo title="Conceder acesso ao Estoque para um usuário">
                <li>Abra <strong>Usuários</strong> (menu principal).</li>
                <li>Localize ou convide o usuário.</li>
                <li>Ative o acesso ao módulo <strong>Estoque</strong> e selecione o <strong>papel</strong> (administrador, gerente, supervisor, colaborador).</li>
                <li>Salve.</li>
              </HowTo>

              <HowTo title="Vincular um gestor a unidades">
                <li>Abra <strong>Estoque → Gestores</strong>.</li>
                <li>Adicione o usuário como gestor e selecione as <strong>unidades</strong> que ele administra.</li>
                <li>Salve. Ele passa a ver apenas os locais e saldos dessas unidades.</li>
              </HowTo>

              <Scenario title="Cenário: novo gerente assumiu a filial">
                <li>Conceda acesso ao módulo Estoque com papel Gerente.</li>
                <li>Vincule-o à unidade da filial em Gestores.</li>
                <li>Ele já consegue aprovar solicitações e ajustar saldos somente da sua filial.</li>
              </Scenario>

              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Segurança</AlertTitle>
                <AlertDescription>Conceda Administrador apenas a quem realmente precisa — esses usuários veem todos os dados e a auditoria.</AlertDescription>
              </Alert>

              <Faq idPrefix="ges" items={[
                { q: "Removi o vínculo e o gestor ainda vê dados antigos?", a: "Peça para ele recarregar a página/fazer login novamente. Permissões são atualizadas a cada sessão." },
                { q: "Posso vincular um gestor a várias unidades?", a: "Sim, marque todas as unidades aplicáveis na tela de Gestores." },
                { q: "Qual a diferença entre Administrador e Gerente?", a: "Administrador vê tudo no sistema e acessa Auditoria. Gerente atua apenas nas unidades vinculadas." },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* PERFIL / SEGURANÇA */}
        <TabsContent value="usuarios" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Perfil e Segurança</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <HowTo title="Alterar seus dados e senha">
                <li>Clique no seu avatar/nome no canto superior e escolha <strong>Perfil</strong>.</li>
                <li>Atualize nome, e-mail e foto.</li>
                <li>Para trocar a senha, informe a senha atual e a nova duas vezes.</li>
                <li>Salve.</li>
              </HowTo>

              <HowTo title="Consultar a Auditoria (admin)">
                <li>No menu, abra <strong>Auditoria</strong> (<History className="inline h-4 w-4" />).</li>
                <li>Filtre por usuário, módulo, período ou tipo de ação.</li>
                <li>Clique em uma linha para ver o que mudou (valor anterior × novo).</li>
              </HowTo>

              <Scenario title="Cenário: alguém alterou um saldo e ninguém sabe quem">
                <li>Admin abre Auditoria e filtra por módulo Estoque e período suspeito.</li>
                <li>Localiza a alteração e o usuário responsável.</li>
                <li>Conversa com o usuário e, se for caso, registra um Ajuste corretivo em Saldos.</li>
              </Scenario>

              <Alert>
                <Lightbulb className="h-4 w-4" />
                <AlertTitle>Boas práticas</AlertTitle>
                <AlertDescription>Não compartilhe sua senha. Em caso de dúvida sobre uma movimentação, consulte a auditoria antes de corrigir.</AlertDescription>
              </Alert>

              <Faq idPrefix="usr" items={[
                { q: "Esqueci minha senha — como recupero?", a: <>Use a opção <strong>Esqueci minha senha</strong> na tela de login. Um link de redefinição será enviado ao seu e-mail cadastrado.</> },
                { q: "Posso ver minhas próprias ações?", a: "Sim, qualquer usuário vê seu histórico no Perfil. Ações em registros são visíveis em cada tela específica." },
                { q: "Por quanto tempo a sessão fica ativa?", a: "Até expirar por inatividade. Ao reabrir o sistema você pode precisar fazer login novamente." },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EstoqueHelp;
