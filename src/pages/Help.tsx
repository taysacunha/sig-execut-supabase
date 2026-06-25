import {
  HelpCircle, Home, Users, MapPin, CalendarDays, Calendar, Search, PieChart, Shield,
  BarChart3, ArrowRight, Lightbulb, AlertTriangle, ListChecks, PlayCircle, MessagesSquare,
  History, FileText, Clock, Shuffle,
} from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const Step = ({ children }: { children: React.ReactNode }) => (
  <ol className="list-decimal ml-6 space-y-2 text-sm leading-relaxed">{children}</ol>
);
const Bullets = ({ children }: { children: React.ReactNode }) => (
  <ul className="list-disc ml-6 space-y-1 text-sm leading-relaxed">{children}</ul>
);
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
  { value: "visao-geral", label: "Visão Geral", keywords: "introdução, plantões, escalas, fluxo, papéis, primeiros passos", description: "Conceitos gerais e fluxo recomendado." },
  { value: "dashboard", label: "Dashboard", keywords: "dashboard, estatísticas, mês, histórico, ranking, top, turno", description: "Estatísticas das escalas por mês." },
  { value: "corretores", label: "Corretores", keywords: "corretor, cadastro, creci, disponibilidade, ativar, inativar, dia, turno", description: "Cadastro da equipe e disponibilidade." },
  { value: "locais", label: "Locais", keywords: "local, stand, escritório, externo, interno, vínculo, ativo", description: "Cadastro de pontos de trabalho." },
  { value: "periodos", label: "Períodos", keywords: "período, turno, manhã, tarde, horário, vigência, dias da semana", description: "Configuração de turnos e vigência por local." },
  { value: "escalas", label: "Escalas", keywords: "escala, gerar, alocar, automático, conflito, manual, limpar, mês, rodízio", description: "Geração e ajuste das alocações." },
  { value: "consultas", label: "Consultas", keywords: "consulta, busca, filtro, corretor, local, dia, exportar", description: "Buscas pontuais sobre escalas existentes." },
  { value: "relatorios", label: "Relatórios", keywords: "relatório, desempenho, ranking, exportar, csv, pdf, mês", description: "Análises de desempenho e exportação." },
  { value: "usuarios", label: "Perfil e Usuários", keywords: "perfil, senha, usuário, papel, permissão, auditoria, segurança", description: "Perfil, gestão de acesso e auditoria." },
];

const normalize = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const Help = () => {
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
        <p className="text-muted-foreground">Guia completo para utilizar o sistema de Gestão de Plantões — com passo a passo, cenários práticos e perguntas frequentes.</p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input type="text" placeholder="Buscar tópicos como Escalas, Corretores, Períodos..." className="pl-10" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
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
        {q && results.length === 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md px-4 py-2 text-sm text-muted-foreground">Nenhum tópico encontrado.</div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-2 justify-start">
          <TabsTrigger value="visao-geral" className="flex items-center gap-2"><Home className="h-4 w-4" /><span className="hidden sm:inline">Visão Geral</span></TabsTrigger>
          <TabsTrigger value="dashboard" className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /><span className="hidden sm:inline">Dashboard</span></TabsTrigger>
          <TabsTrigger value="corretores" className="flex items-center gap-2"><Users className="h-4 w-4" /><span className="hidden sm:inline">Corretores</span></TabsTrigger>
          <TabsTrigger value="locais" className="flex items-center gap-2"><MapPin className="h-4 w-4" /><span className="hidden sm:inline">Locais</span></TabsTrigger>
          <TabsTrigger value="periodos" className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /><span className="hidden sm:inline">Períodos</span></TabsTrigger>
          <TabsTrigger value="escalas" className="flex items-center gap-2"><Calendar className="h-4 w-4" /><span className="hidden sm:inline">Escalas</span></TabsTrigger>
          <TabsTrigger value="consultas" className="flex items-center gap-2"><Search className="h-4 w-4" /><span className="hidden sm:inline">Consultas</span></TabsTrigger>
          <TabsTrigger value="relatorios" className="flex items-center gap-2"><PieChart className="h-4 w-4" /><span className="hidden sm:inline">Relatórios</span></TabsTrigger>
          <TabsTrigger value="usuarios" className="flex items-center gap-2"><Shield className="h-4 w-4" /><span className="hidden sm:inline">Perfil e Usuários</span></TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Home className="h-5 w-5" /> O que é o sistema de Gestão de Plantões?</CardTitle>
              <CardDescription>Organiza a alocação de corretores em stands externos e escritórios internos.</CardDescription></CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <p>Cadastre corretores, configure locais e seus períodos/turnos, defina vigência e gere escalas mensais automaticamente — com histórico preservado mês a mês.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ArrowRight className="h-5 w-5" /> Guia rápido — primeiros passos</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <HowTo title="Configuração inicial completa">
                <li>Em <strong>Corretores</strong>, cadastre toda a equipe (nome, CRECI, disponibilidade por dia/turno).</li>
                <li>Em <strong>Locais</strong>, cadastre os pontos de trabalho (externo/interno) e ative.</li>
                <li>Em <strong>Locais → Períodos</strong>, defina turnos (manhã/tarde), horários e dias da semana de funcionamento.</li>
                <li>Associe os corretores aos locais onde eles podem trabalhar.</li>
                <li>Em <strong>Escalas</strong>, escolha o mês e clique em <strong>Gerar escalas</strong>.</li>
                <li>Revise conflitos, ajuste manualmente quando necessário e publique.</li>
              </HowTo>
              <Alert><Lightbulb className="h-4 w-4" /><AlertTitle>Dica</AlertTitle>
                <AlertDescription>Sem corretores associados ao local e sem períodos válidos, o gerador não consegue alocar ninguém naquele ponto.</AlertDescription></Alert>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Papéis e permissões</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed">
              <Bullets>
                <li><Badge className="bg-purple-600 text-white mr-1">Super Admin</Badge> acesso total + auditoria + usuários.</li>
                <li><Badge className="bg-destructive/80 text-destructive-foreground mr-1">Administrador</Badge> mesma autonomia operacional, com auditoria.</li>
                <li><Badge className="bg-primary/80 text-primary-foreground mr-1">Gerente</Badge> cadastra corretores/locais e gera escalas.</li>
                <li><Badge className="bg-blue-600/80 text-white mr-1">Supervisor</Badge> acompanha e consulta.</li>
                <li><Badge className="bg-secondary text-secondary-foreground mr-1">Colaborador</Badge> visualiza a própria escala.</li>
              </Bullets>
            </CardContent>
          </Card>
          <Card><CardContent className="pt-6"><Faq idPrefix="vg" items={[
            { q: "Por onde começar?", a: <>Corretores → Locais → Períodos → Escalas. Sem essa base o gerador não funciona.</> },
            { q: "Posso editar uma escala já gerada?", a: "Sim. Em Escalas, abra o dia/turno e troque o corretor manualmente. A alteração fica registrada na auditoria." },
            { q: "Cada gestor vê o sistema todo?", a: "Administradores veem tudo. Demais papéis veem conforme as permissões do seu cadastro." },
          ]} /></CardContent></Card>
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Dashboard</CardTitle>
              <CardDescription>Estatísticas do mês selecionado.</CardDescription></CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <Bullets>
                <li>Total de alocações, plantões da manhã e tarde, média diária.</li>
                <li>Top 5 corretores e top 5 locais mais utilizados.</li>
                <li>Distribuição manhã × tarde e taxa de participação.</li>
              </Bullets>
              <HowTo title="Visualizar outro mês">
                <li>Use o seletor de mês no canto superior direito.</li>
                <li>Escolha qualquer mês dos últimos 12 meses.</li>
                <li>Os dados são atualizados automaticamente.</li>
              </HowTo>
              <Alert><History className="h-4 w-4" /><AlertTitle>Dados históricos</AlertTitle>
                <AlertDescription>Quando aparecer o badge "Dados históricos", os números vêm do histórico agregado — preservado mesmo após limpar escalas.</AlertDescription></Alert>
              <Faq idPrefix="dash" items={[
                { q: "Por que o Dashboard está zerado?", a: "Não há escalas geradas para o mês selecionado. Vá em Escalas e gere." },
                { q: "Posso recuperar dados de meses antigos?", a: "Sim — o histórico fica salvo automaticamente quando você limpa escalas ou gera novas." },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="corretores" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Corretores</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <HowTo title="Cadastrar um corretor">
                <li>Abra <strong>Corretores</strong> no menu.</li>
                <li>Clique em <strong>+ Novo corretor</strong>.</li>
                <li>Preencha <strong>Nome</strong> e <strong>CRECI</strong>.</li>
                <li>Configure a disponibilidade por dia/turno (opcional).</li>
                <li>Salve.</li>
              </HowTo>
              <HowTo title="Inativar um corretor">
                <li>Localize o corretor na lista.</li>
                <li>Use o botão <strong>Inativar</strong>.</li>
                <li>Confirme no AlertDialog. Ele deixa de aparecer nas próximas alocações; o histórico é preservado.</li>
              </HowTo>
              <Scenario title="Cenário: corretor só trabalha de manhã, seg–sex">
                <li>No cadastro, marque apenas Manhã em seg, ter, qua, qui, sex.</li>
                <li>Salve. O gerador de escalas vai respeitar essa disponibilidade.</li>
              </Scenario>
              <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Importante</AlertTitle>
                <AlertDescription>Prefira inativar a excluir — exclusão remove o histórico de plantões.</AlertDescription></Alert>
              <Faq idPrefix="cor" items={[
                { q: "Posso ter dois corretores com o mesmo CRECI?", a: "Não. O CRECI é único." },
                { q: "Corretor inativo aparece em relatórios passados?", a: "Sim. A inativação só afeta novas alocações." },
                { q: "Como vinculo um corretor a um local?", a: "Em Locais, abra o local e associe os corretores que podem atuar nele." },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locais" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Locais</CardTitle>
              <CardDescription>Pontos de trabalho — stands externos ou escritórios internos.</CardDescription></CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <HowTo title="Cadastrar um local">
                <li>Abra <strong>Locais</strong>.</li>
                <li>Clique em <strong>+ Novo local</strong>.</li>
                <li>Informe nome, tipo (Externo/Interno) e endereço.</li>
                <li>Salve. Em seguida configure os <strong>Períodos</strong> e associe os <strong>corretores</strong>.</li>
              </HowTo>
              <Faq idPrefix="loc" items={[
                { q: "Qual a diferença entre externo e interno?", a: "Externo = stand de vendas em empreendimento. Interno = escritório/sede. Aparecem separados em relatórios." },
                { q: "Local sem período é alocado?", a: "Não. Sem período definido, o gerador ignora o local." },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="periodos" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" /> Períodos</CardTitle>
              <CardDescription>Turnos e dias de funcionamento por local.</CardDescription></CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <HowTo title="Adicionar um período a um local">
                <li>Abra o local em <strong>Locais</strong>.</li>
                <li>Vá na aba <strong>Períodos</strong>.</li>
                <li>Clique em <strong>+ Novo período</strong>.</li>
                <li>Selecione <strong>Turno</strong> (Manhã/Tarde), defina horário e os dias da semana ativos.</li>
                <li>Salve. O período passa a valer no próximo geração de escala.</li>
              </HowTo>
              <Scenario title="Cenário: stand abre só fim de semana">
                <li>No local, crie períodos Manhã e Tarde marcando apenas sábado e domingo.</li>
                <li>Gere a escala — o local só recebe corretores nesses dias.</li>
              </Scenario>
              <Faq idPrefix="per" items={[
                { q: "Posso ter mais de um período por turno?", a: "Sim, cada combinação turno × dias é um período distinto." },
                { q: "Mudei o horário e a escala antiga continua com o antigo. Por quê?", a: "Períodos não alteram escalas já geradas. Regenere a escala para aplicar." },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="escalas" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Escalas</CardTitle>
              <CardDescription>Alocação mensal de corretores nos locais.</CardDescription></CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <HowTo title="Gerar a escala do mês">
                <li>Abra <strong>Escalas</strong>.</li>
                <li>Selecione o <strong>mês</strong>.</li>
                <li>Clique em <strong>Gerar escalas</strong>.</li>
                <li>O sistema respeita disponibilidade, vínculos local↔corretor e tenta distribuir de forma equilibrada (rodízio).</li>
                <li>Revise conflitos destacados em vermelho e ajuste manualmente clicando na célula.</li>
              </HowTo>
              <HowTo title="Trocar um corretor de plantão">
                <li>Clique na célula do dia/turno/local.</li>
                <li>Escolha outro corretor disponível na lista.</li>
                <li>Confirme. A troca fica registrada na auditoria.</li>
              </HowTo>
              <HowTo title="Limpar escalas de um mês">
                <li>Selecione o mês.</li>
                <li>Clique em <strong>Limpar escalas</strong> e confirme.</li>
                <li>Os dados agregados são preservados no histórico antes da limpeza.</li>
              </HowTo>
              <Scenario title="Cenário: corretor pediu férias depois da escala gerada" context="Escala de outubro já publicada">
                <li>Em Escalas, filtre pelo corretor.</li>
                <li>Em cada plantão dele, clique e troque por outro corretor disponível.</li>
                <li>Avise os afetados — não há notificação automática para troca manual.</li>
              </Scenario>
              <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Atenção</AlertTitle>
                <AlertDescription>Limpar uma escala não tem volta — só o agregado fica no histórico, não cada plantão individual.</AlertDescription></Alert>
              <Faq idPrefix="esc" items={[
                { q: "Por que ficou um local sem corretor?", a: "Não há corretor disponível naquele dia/turno — sem associação ao local ou sem disponibilidade no dia. Ajuste cadastros e regenere, ou aloque manualmente." },
                { q: "Posso regenerar sem perder os ajustes manuais?", a: "Não. Regenerar sobrescreve. Se já fez ajustes, prefira corrigir pontualmente." },
                { q: "Como funciona o rodízio?", a: "O gerador tenta equilibrar a quantidade de plantões entre corretores elegíveis no período." },
                { q: "Há limite de plantões por corretor no mês?", a: "Não há limite rígido — o equilíbrio é dado pelo rodízio e pela disponibilidade configurada." },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consultas" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" /> Consultas</CardTitle>
              <CardDescription>Busca rápida em escalas existentes.</CardDescription></CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <HowTo title="Consultar plantões de um corretor">
                <li>Abra <strong>Consultas</strong>.</li>
                <li>Filtre por <strong>corretor</strong> e <strong>período</strong>.</li>
                <li>Visualize todos os plantões e exporte se necessário.</li>
              </HowTo>
              <Faq idPrefix="con" items={[
                { q: "Posso combinar filtros?", a: "Sim — corretor + local + dia + turno funcionam juntos." },
                { q: "Onde apareceu este corretor em fevereiro?", a: "Filtre corretor + período fev/aaaa e o sistema lista local, dia e turno." },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="relatorios" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><PieChart className="h-5 w-5" /> Relatórios</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <Bullets>
                <li>Desempenho por corretor (quantidade de plantões, distribuição manhã/tarde).</li>
                <li>Ocupação por local.</li>
                <li>Exportação em CSV/PDF.</li>
              </Bullets>
              <HowTo title="Exportar relatório do mês">
                <li>Abra <strong>Relatórios</strong>.</li>
                <li>Selecione o tipo, o período e os filtros.</li>
                <li>Clique em <strong>Exportar</strong>.</li>
              </HowTo>
              <Faq idPrefix="rel" items={[
                { q: "Relatórios usam o histórico?", a: "Sim. Meses já limpos aparecem com os dados agregados preservados." },
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
                <li>Para trocar a senha, informe a atual e a nova duas vezes.</li>
              </HowTo>
              <HowTo title="Conceder acesso ao módulo (admin)">
                <li>Abra <strong>Usuários</strong>.</li>
                <li>Convide ou edite o usuário.</li>
                <li>Ative o acesso ao módulo <strong>Plantões</strong> e selecione o papel.</li>
              </HowTo>
              <HowTo title="Consultar Auditoria (admin)">
                <li>Abra <strong>Auditoria</strong> (<History className="inline h-4 w-4" />).</li>
                <li>Filtre por usuário, período ou tipo de ação.</li>
                <li>Clique em uma linha para ver o que mudou.</li>
              </HowTo>
              <Alert><Lightbulb className="h-4 w-4" /><AlertTitle>Boas práticas</AlertTitle>
                <AlertDescription>Conceda Administrador apenas a quem realmente precisa. Não compartilhe sua senha.</AlertDescription></Alert>
              <Faq idPrefix="usr" items={[
                { q: "Esqueci minha senha", a: "Use 'Esqueci minha senha' na tela de login para receber o link de redefinição." },
                { q: "Quanto tempo dura a sessão?", a: "A sessão expira após inatividade prolongada — faça login novamente." },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Help;
