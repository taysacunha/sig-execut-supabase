import {
  HelpCircle, Home, Users, UserPlus, ClipboardList, TrendingUp, FileText, BarChart3,
  FileSpreadsheet, Shield, History, Search, Lightbulb, AlertTriangle, ArrowRight,
  ListChecks, PlayCircle, MessagesSquare,
} from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const Step = ({ children }: { children: React.ReactNode }) => (<ol className="list-decimal ml-6 space-y-2 text-sm leading-relaxed">{children}</ol>);
const Bullets = ({ children }: { children: React.ReactNode }) => (<ul className="list-disc ml-6 space-y-1 text-sm leading-relaxed">{children}</ul>);
const HowTo = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-md border border-border bg-muted/30 p-4 space-y-2">
    <div className="flex items-center gap-2 text-sm font-semibold"><ListChecks className="h-4 w-4 text-primary" />{title}</div>
    <Step>{children}</Step>
  </div>
);
const Scenario = ({ title, context, children }: { title: string; context?: string; children: React.ReactNode }) => (
  <div className="rounded-md border border-border p-4 space-y-2">
    <div className="flex items-center gap-2 text-sm font-semibold"><PlayCircle className="h-4 w-4 text-primary" />{title}</div>
    {context && <p className="text-xs text-muted-foreground italic">{context}</p>}
    <Step>{children}</Step>
  </div>
);
type FaqItem = { q: string; a: React.ReactNode };
const Faq = ({ items, idPrefix }: { items: FaqItem[]; idPrefix: string }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2 text-sm font-semibold"><MessagesSquare className="h-4 w-4 text-primary" />Perguntas frequentes</div>
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
  { value: "visao-geral", label: "Visão Geral", keywords: "introdução, vendas, fluxo, papéis, primeiros passos, vgv", description: "Conceitos gerais e fluxo recomendado." },
  { value: "dashboard", label: "Dashboard", keywords: "dashboard, vgv, metas, ranking, vendas, mês", description: "Indicadores comerciais consolidados." },
  { value: "equipes", label: "Equipes", keywords: "equipe, time, supervisor, gerente, corretor, vínculo", description: "Equipes de venda e seus integrantes." },
  { value: "corretores", label: "Corretores", keywords: "corretor, cadastro, creci, equipe, comissão, ativar, inativar", description: "Corretores e vínculos com equipes." },
  { value: "leads", label: "Leads", keywords: "lead, captação, origem, status, atribuição, follow-up", description: "Funil de leads e atribuição." },
  { value: "vendas", label: "Vendas", keywords: "venda, registrar, fechamento, vgv, comissão, status, contrato, distrato", description: "Registro de vendas e distratos." },
  { value: "propostas", label: "Propostas", keywords: "proposta, valor, condições, aprovar, recusar", description: "Propostas enviadas a clientes." },
  { value: "avaliacoes", label: "Avaliações", keywords: "avaliação, desempenho, corretor, score", description: "Avaliações de desempenho." },
  { value: "relatorios", label: "Relatórios", keywords: "relatório, vgv, conversão, exportar, csv, pdf, período", description: "Análises e exportações." },
  { value: "usuarios", label: "Perfil e Usuários", keywords: "perfil, senha, usuário, papel, permissão, auditoria, segurança", description: "Perfil, usuários e auditoria." },
];

const normalize = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const VendasHelp = () => {
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [searchQuery, setSearchQuery] = useState("");
  const q = normalize(searchQuery).trim();
  const results = q ? topics.filter(t => {
    const h = normalize(`${t.label} ${t.keywords} ${t.description}`);
    return q.split(/\s+/).every(term => h.includes(term));
  }) : [];

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2"><HelpCircle className="h-8 w-8 text-primary" /><h1 className="text-3xl font-bold">Central de Ajuda</h1></div>
        <p className="text-muted-foreground">Guia completo para utilizar o sistema de Vendas — com passo a passo, cenários práticos e perguntas frequentes.</p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input type="text" placeholder="Buscar tópicos como Vendas, Leads, Equipes..." className="pl-10" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        {results.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
            <ul className="py-1 max-h-60 overflow-auto">
              {results.map(t => (
                <li key={t.value}>
                  <button type="button" onClick={() => { setActiveTab(t.value); setSearchQuery(""); }} className="w-full text-left px-4 py-2 hover:bg-accent hover:text-accent-foreground">
                    <div className="font-medium text-sm">{t.label}</div>
                    <div className="text-xs text-muted-foreground">{t.description}</div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {q && results.length === 0 && (<div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md px-4 py-2 text-sm text-muted-foreground">Nenhum tópico encontrado.</div>)}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-2 justify-start">
          <TabsTrigger value="visao-geral" className="flex items-center gap-2"><Home className="h-4 w-4" /><span className="hidden sm:inline">Visão Geral</span></TabsTrigger>
          <TabsTrigger value="dashboard" className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /><span className="hidden sm:inline">Dashboard</span></TabsTrigger>
          <TabsTrigger value="equipes" className="flex items-center gap-2"><Users className="h-4 w-4" /><span className="hidden sm:inline">Equipes</span></TabsTrigger>
          <TabsTrigger value="corretores" className="flex items-center gap-2"><UserPlus className="h-4 w-4" /><span className="hidden sm:inline">Corretores</span></TabsTrigger>
          <TabsTrigger value="leads" className="flex items-center gap-2"><ClipboardList className="h-4 w-4" /><span className="hidden sm:inline">Leads</span></TabsTrigger>
          <TabsTrigger value="vendas" className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /><span className="hidden sm:inline">Vendas</span></TabsTrigger>
          <TabsTrigger value="propostas" className="flex items-center gap-2"><FileText className="h-4 w-4" /><span className="hidden sm:inline">Propostas</span></TabsTrigger>
          <TabsTrigger value="avaliacoes" className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /><span className="hidden sm:inline">Avaliações</span></TabsTrigger>
          <TabsTrigger value="relatorios" className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /><span className="hidden sm:inline">Relatórios</span></TabsTrigger>
          <TabsTrigger value="usuarios" className="flex items-center gap-2"><Shield className="h-4 w-4" /><span className="hidden sm:inline">Perfil e Usuários</span></TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Home className="h-5 w-5" /> O que é o sistema de Vendas?</CardTitle>
              <CardDescription>Controla equipes, corretores, leads, propostas e o registro de vendas — com indicadores de VGV e conversão.</CardDescription></CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <p>Centraliza a operação comercial: captação de leads, qualificação, envio de propostas, fechamento da venda e acompanhamento de metas e ranking de corretores.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ArrowRight className="h-5 w-5" /> Guia rápido — primeiros passos</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <HowTo title="Configuração inicial completa">
                <li>Cadastre as <strong>Equipes</strong> com seus supervisores.</li>
                <li>Cadastre os <strong>Corretores</strong> e vincule cada um a uma equipe.</li>
                <li>Comece a registrar <strong>Leads</strong> e atribua-os aos corretores.</li>
                <li>À medida que os leads avançam, gere <strong>Propostas</strong>.</li>
                <li>Quando fechar, registre a <strong>Venda</strong> com valor (VGV) e comissão.</li>
                <li>Acompanhe o desempenho em <strong>Dashboard</strong> e <strong>Relatórios</strong>.</li>
              </HowTo>
              <Alert><Lightbulb className="h-4 w-4" /><AlertTitle>Dica</AlertTitle>
                <AlertDescription>Atribua cada lead a um único corretor para evitar disputa de comissão.</AlertDescription></Alert>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Papéis</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed">
              <Bullets>
                <li><Badge className="bg-purple-600 text-white mr-1">Super Admin</Badge> acesso total + usuários + auditoria.</li>
                <li><Badge className="bg-destructive/80 text-destructive-foreground mr-1">Administrador</Badge> acesso total ao módulo, vê VGV global.</li>
                <li><Badge className="bg-primary/80 text-primary-foreground mr-1">Gerente</Badge> gerencia equipes, leads e vendas; vê VGV das suas equipes.</li>
                <li><Badge className="bg-blue-600/80 text-white mr-1">Supervisor</Badge> acompanha sua equipe.</li>
                <li><Badge className="bg-secondary text-secondary-foreground mr-1">Corretor</Badge> trabalha seus leads e vê suas próprias vendas.</li>
              </Bullets>
            </CardContent>
          </Card>
          <Card><CardContent className="pt-6"><Faq idPrefix="vg" items={[
            { q: "Por onde começar?", a: "Equipes → Corretores → Leads → Propostas → Vendas." },
            { q: "Por que não vejo o VGV total?", a: "A visibilidade do VGV depende do papel. Corretores veem apenas o próprio; gerentes veem da sua equipe; administradores veem tudo." },
          ]} /></CardContent></Card>
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Dashboard</CardTitle>
              <CardDescription>Indicadores comerciais do mês selecionado.</CardDescription></CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <Bullets>
                <li><strong>VGV</strong> total do mês (Valor Geral de Vendas).</li>
                <li>Quantidade de vendas, taxa de conversão de leads.</li>
                <li>Top corretores e top equipes.</li>
                <li>Distribuição por status (em proposta, fechadas, distratadas).</li>
              </Bullets>
              <Alert><Lightbulb className="h-4 w-4" /><AlertTitle>Dica</AlertTitle>
                <AlertDescription>Use o seletor de mês no topo para comparar com meses anteriores.</AlertDescription></Alert>
              <Faq idPrefix="dash" items={[
                { q: "Por que vejo valores diferentes dos do gerente?", a: "Seu papel restringe a visibilidade ao seu escopo (você mesmo ou sua equipe)." },
                { q: "Distratos entram no VGV?", a: "Não. Vendas com status Distratada são excluídas do VGV consolidado." },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equipes" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Equipes</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <HowTo title="Criar uma equipe">
                <li>Abra <strong>Equipes</strong> e clique em <strong>+ Nova equipe</strong>.</li>
                <li>Informe nome e selecione o <strong>supervisor/gerente</strong>.</li>
                <li>Salve. Em seguida vincule os corretores em <strong>Corretores</strong>.</li>
              </HowTo>
              <Faq idPrefix="eq" items={[
                { q: "Um corretor pode estar em duas equipes?", a: "Não. Cada corretor pertence a uma única equipe ativa." },
                { q: "Posso renomear uma equipe?", a: "Sim — editar não afeta vendas/leads já vinculados." },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="corretores" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Corretores</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <HowTo title="Cadastrar um corretor">
                <li>Abra <strong>Corretores</strong> e clique em <strong>+ Novo</strong>.</li>
                <li>Preencha nome, CRECI e contato.</li>
                <li>Vincule a uma <strong>equipe</strong> e defina percentual de comissão padrão.</li>
                <li>Salve.</li>
              </HowTo>
              <HowTo title="Inativar um corretor">
                <li>Localize o corretor e clique em <strong>Inativar</strong>.</li>
                <li>Confirme. Ele deixa de receber novos leads, mas o histórico de vendas permanece.</li>
              </HowTo>
              <Faq idPrefix="cor" items={[
                { q: "Posso transferir leads de um corretor inativado?", a: "Sim — reatribua manualmente em Leads antes ou depois da inativação." },
                { q: "Comissão é calculada automaticamente?", a: "O percentual padrão é sugerido na venda; pode ser ajustado caso a caso." },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" /> Leads</CardTitle>
              <CardDescription>Captação e qualificação do potencial cliente.</CardDescription></CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <HowTo title="Cadastrar e atribuir um lead">
                <li>Abra <strong>Leads</strong> e clique em <strong>+ Novo lead</strong>.</li>
                <li>Informe nome, contato e <strong>origem</strong> (site, indicação, etc.).</li>
                <li>Atribua a um <strong>corretor</strong> responsável.</li>
                <li>Salve. O corretor recebe a tarefa em sua lista.</li>
              </HowTo>
              <HowTo title="Atualizar status do lead">
                <li>Abra o lead na lista.</li>
                <li>Mude o <strong>status</strong> conforme avança (Novo → Em contato → Qualificado → Proposta → Ganho/Perdido).</li>
                <li>Registre observações de follow-up.</li>
              </HowTo>
              <Scenario title="Cenário: lead virou venda">
                <li>Atualize o status para <strong>Proposta</strong> e gere a proposta em <strong>Propostas</strong>.</li>
                <li>Quando o cliente aceitar, vá em <strong>Vendas</strong> e clique em <strong>+ Nova venda</strong>, vinculando ao lead.</li>
                <li>O status do lead muda para <strong>Ganho</strong> automaticamente.</li>
              </Scenario>
              <Faq idPrefix="lea" items={[
                { q: "Posso reatribuir um lead?", a: "Sim — abra o lead e mude o corretor responsável. A troca fica na auditoria." },
                { q: "Lead perdido pode voltar a ser trabalhado?", a: "Sim — reabra mudando o status novamente." },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vendas" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Vendas</CardTitle>
              <CardDescription>Registro do fechamento e acompanhamento da venda.</CardDescription></CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <HowTo title="Registrar uma nova venda">
                <li>Abra <strong>Vendas</strong> e clique em <strong>+ Nova venda</strong>.</li>
                <li>Selecione o <strong>cliente/lead</strong>, o imóvel/empreendimento e o <strong>corretor</strong>.</li>
                <li>Informe o <strong>valor (VGV)</strong>, condições de pagamento e percentual de comissão.</li>
                <li>Anexe o contrato se necessário e salve.</li>
              </HowTo>
              <HowTo title="Registrar um distrato">
                <li>Localize a venda e abra os detalhes.</li>
                <li>Mude o status para <strong>Distratada</strong> e informe a data e motivo.</li>
                <li>Confirme no AlertDialog. A venda sai do VGV do mês.</li>
              </HowTo>
              <Scenario title="Cenário: venda com dois corretores (compartilhada)">
                <li>Registre a venda com o corretor principal.</li>
                <li>Use o campo de <strong>participantes</strong> para incluir o segundo corretor e definir a divisão de comissão.</li>
              </Scenario>
              <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Distrato</AlertTitle>
                <AlertDescription>Distrato impacta VGV, comissão e ranking. Confirme o motivo antes de registrar.</AlertDescription></Alert>
              <Faq idPrefix="ven" items={[
                { q: "Como funciona o VGV?", a: "VGV (Valor Geral de Vendas) é a soma dos valores das vendas fechadas no período. Distratadas não entram." },
                { q: "Posso editar o valor depois de salvar?", a: "Sim, enquanto não estiver bloqueada pelo fechamento mensal. Toda alteração fica registrada na auditoria." },
                { q: "A comissão é paga pelo sistema?", a: "Não. O sistema apenas calcula e exibe — o pagamento é feito pelo financeiro." },
                { q: "Cliente desistiu antes do contrato — devo registrar venda?", a: "Não. Mantenha como Lead com status Perdido. Registre Venda só após contrato assinado." },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="propostas" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Propostas</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <HowTo title="Criar uma proposta">
                <li>Abra <strong>Propostas</strong> e clique em <strong>+ Nova proposta</strong>.</li>
                <li>Vincule ao lead, informe valor e condições.</li>
                <li>Salve e envie ao cliente.</li>
                <li>Atualize o status conforme retorno (Em análise → Aceita → Recusada).</li>
              </HowTo>
              <Faq idPrefix="pro" items={[
                { q: "Aceitar proposta cria a venda automaticamente?", a: "Não. Após aceite, vá em Vendas e crie a venda vinculada à proposta." },
                { q: "Posso ter várias propostas pro mesmo lead?", a: "Sim — útil para comparar diferentes empreendimentos ou condições." },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="avaliacoes" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Avaliações</CardTitle>
              <CardDescription>Avaliações de desempenho dos corretores.</CardDescription></CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <HowTo title="Registrar uma avaliação">
                <li>Abra <strong>Avaliações</strong> e clique em <strong>+ Nova</strong>.</li>
                <li>Selecione o corretor, o período e atribua a nota/comentário.</li>
                <li>Salve. O histórico fica disponível para o corretor e supervisor.</li>
              </HowTo>
              <Faq idPrefix="ava" items={[
                { q: "Quem pode avaliar?", a: "Gerentes/supervisores avaliam os corretores da própria equipe." },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="relatorios" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> Relatórios</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <Bullets>
                <li>VGV por período, corretor e equipe.</li>
                <li>Conversão do funil (Leads → Propostas → Vendas).</li>
                <li>Ranking de corretores e equipes.</li>
                <li>Exportação CSV/PDF.</li>
              </Bullets>
              <HowTo title="Exportar relatório do mês">
                <li>Abra <strong>Relatórios</strong>.</li>
                <li>Escolha tipo e período.</li>
                <li>Clique em <strong>Exportar</strong>.</li>
              </HowTo>
              <Faq idPrefix="rel" items={[
                { q: "Posso filtrar por equipe?", a: "Sim — combine equipe + período + tipo de relatório." },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usuarios" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Perfil e Usuários</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <HowTo title="Alterar seus dados e senha">
                <li>Clique no seu nome → <strong>Perfil</strong>.</li>
                <li>Atualize nome, e-mail e foto.</li>
                <li>Para trocar a senha, informe a atual e a nova.</li>
              </HowTo>
              <HowTo title="Conceder acesso ao módulo (admin)">
                <li>Abra <strong>Usuários</strong>.</li>
                <li>Convide ou edite o usuário.</li>
                <li>Ative o acesso ao módulo <strong>Vendas</strong> e selecione o papel.</li>
              </HowTo>
              <HowTo title="Consultar Auditoria (admin)">
                <li>Abra <strong>Auditoria</strong> (<History className="inline h-4 w-4" />).</li>
                <li>Filtre por usuário, período ou tipo de ação.</li>
                <li>Veja o detalhe completo da alteração.</li>
              </HowTo>
              <Alert><Lightbulb className="h-4 w-4" /><AlertTitle>Boas práticas</AlertTitle>
                <AlertDescription>Não compartilhe sua senha. Em caso de dúvida em uma venda, consulte a auditoria.</AlertDescription></Alert>
              <Faq idPrefix="usr" items={[
                { q: "Esqueci minha senha", a: "Use 'Esqueci minha senha' na tela de login." },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VendasHelp;
