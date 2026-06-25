import {
  HelpCircle, Home, Users, Building2, Calendar, CalendarDays, CalendarRange, Cake,
  FileBarChart, CreditCard, Settings, Shield, History, Search, Lightbulb, AlertTriangle,
  ArrowRight, ListChecks, PlayCircle, MessagesSquare, FileText,
} from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  { value: "visao-geral", label: "Visão Geral", keywords: "introdução, férias, folgas, fluxo, papéis, primeiros passos", description: "Conceitos gerais e fluxo recomendado." },
  { value: "dashboard", label: "Dashboard", keywords: "dashboard, resumo, indicadores, pendências", description: "Visão consolidada de férias e folgas." },
  { value: "colaboradores", label: "Colaboradores", keywords: "colaborador, cadastro, admissão, demissão, vínculo, unidade, setor, cargo, equipe", description: "Cadastro e vínculos do colaborador." },
  { value: "estrutura", label: "Estrutura", keywords: "estrutura, unidade, setor, cargo, equipe, organograma", description: "Estrutura organizacional." },
  { value: "ferias", label: "Férias", keywords: "férias, período aquisitivo, vesting, solicitação, aprovar, recusar, abono, divisão, dias", description: "Lançamento e acompanhamento de férias." },
  { value: "folgas", label: "Folgas", keywords: "folga, sábado, escala, troca, crédito", description: "Folgas de sábado e trocas." },
  { value: "calendario", label: "Calendário", keywords: "calendário, mês, visualizar, evento, férias, folga", description: "Visão de calendário com férias e folgas." },
  { value: "aniversariantes", label: "Aniversariantes", keywords: "aniversário, mês, lista, colaborador", description: "Aniversariantes do mês." },
  { value: "relatorios", label: "Relatórios", keywords: "relatório, exportar, csv, pdf, período, colaborador", description: "Exportações e relatórios." },
  { value: "creditos", label: "Créditos", keywords: "crédito, saldo, folga, banco, débito", description: "Banco de créditos de folgas." },
  { value: "configuracoes", label: "Configurações", keywords: "configuração, regra, parâmetro, vesting", description: "Parâmetros do sistema." },
  { value: "usuarios", label: "Perfil e Usuários", keywords: "perfil, senha, usuário, papel, permissão, auditoria, segurança", description: "Perfil, usuários e auditoria." },
];

const normalize = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const FeriasHelp = () => {
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
        <p className="text-muted-foreground">Guia completo para utilizar o sistema de Gestão de Férias e Folgas — com passo a passo, cenários práticos e perguntas frequentes.</p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input type="text" placeholder="Buscar tópicos como Férias, Folgas, Colaboradores..." className="pl-10" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
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
          <TabsTrigger value="dashboard" className="flex items-center gap-2"><FileBarChart className="h-4 w-4" /><span className="hidden sm:inline">Dashboard</span></TabsTrigger>
          <TabsTrigger value="colaboradores" className="flex items-center gap-2"><Users className="h-4 w-4" /><span className="hidden sm:inline">Colaboradores</span></TabsTrigger>
          <TabsTrigger value="estrutura" className="flex items-center gap-2"><Building2 className="h-4 w-4" /><span className="hidden sm:inline">Estrutura</span></TabsTrigger>
          <TabsTrigger value="ferias" className="flex items-center gap-2"><Calendar className="h-4 w-4" /><span className="hidden sm:inline">Férias</span></TabsTrigger>
          <TabsTrigger value="folgas" className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /><span className="hidden sm:inline">Folgas</span></TabsTrigger>
          <TabsTrigger value="calendario" className="flex items-center gap-2"><CalendarRange className="h-4 w-4" /><span className="hidden sm:inline">Calendário</span></TabsTrigger>
          <TabsTrigger value="aniversariantes" className="flex items-center gap-2"><Cake className="h-4 w-4" /><span className="hidden sm:inline">Aniversariantes</span></TabsTrigger>
          <TabsTrigger value="relatorios" className="flex items-center gap-2"><FileText className="h-4 w-4" /><span className="hidden sm:inline">Relatórios</span></TabsTrigger>
          <TabsTrigger value="creditos" className="flex items-center gap-2"><CreditCard className="h-4 w-4" /><span className="hidden sm:inline">Créditos</span></TabsTrigger>
          <TabsTrigger value="configuracoes" className="flex items-center gap-2"><Settings className="h-4 w-4" /><span className="hidden sm:inline">Configurações</span></TabsTrigger>
          <TabsTrigger value="usuarios" className="flex items-center gap-2"><Shield className="h-4 w-4" /><span className="hidden sm:inline">Perfil e Usuários</span></TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Home className="h-5 w-5" /> O que é o sistema de Gestão de Férias e Folgas?</CardTitle>
              <CardDescription>Controla férias, folgas de sábado, afastamentos e a estrutura organizacional.</CardDescription></CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <p>Centraliza o cadastro de colaboradores, períodos aquisitivos, lançamento de férias e escala de folgas — com calendário, relatórios e banco de créditos.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ArrowRight className="h-5 w-5" /> Guia rápido — primeiros passos</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <HowTo title="Configuração inicial completa">
                <li>Em <strong>Estrutura</strong>, cadastre Unidades, Setores, Cargos e Equipes.</li>
                <li>Em <strong>Colaboradores</strong>, cadastre cada pessoa com data de admissão e vincule à estrutura.</li>
                <li>Em <strong>Configurações</strong>, revise regras de período aquisitivo.</li>
                <li>Comece a lançar <strong>Férias</strong> e <strong>Folgas</strong> conforme as solicitações.</li>
                <li>Use <strong>Calendário</strong> e <strong>Relatórios</strong> para acompanhar.</li>
              </HowTo>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Papéis</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed">
              <Bullets>
                <li><Badge className="bg-purple-600 text-white mr-1">Super Admin</Badge> acesso total + usuários + auditoria.</li>
                <li><Badge className="bg-destructive/80 text-destructive-foreground mr-1">Administrador</Badge> acesso total ao módulo.</li>
                <li><Badge className="bg-primary/80 text-primary-foreground mr-1">Gerente</Badge> lança e edita férias/folgas.</li>
                <li><Badge className="bg-blue-600/80 text-white mr-1">Supervisor</Badge> acompanha equipes.</li>
                <li><Badge className="bg-secondary text-secondary-foreground mr-1">Colaborador</Badge> visualiza seus dados.</li>
              </Bullets>
            </CardContent>
          </Card>
          <Card><CardContent className="pt-6"><Faq idPrefix="vg" items={[
            { q: "Por onde começar?", a: "Estrutura → Colaboradores → Configurações → Férias/Folgas." },
            { q: "Posso lançar férias sem cadastrar a estrutura?", a: "Tecnicamente sim, mas você perde filtros e relatórios por setor/unidade/cargo." },
          ]} /></CardContent></Card>
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileBarChart className="h-5 w-5" /> Dashboard</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <Bullets>
                <li>Colaboradores em férias agora.</li>
                <li>Períodos aquisitivos vencendo nos próximos meses.</li>
                <li>Folgas pendentes de marcação.</li>
                <li>Aniversariantes do mês.</li>
              </Bullets>
              <Faq idPrefix="dash" items={[
                { q: "Por que aparece colaborador com período vencendo?", a: "São colaboradores que precisam tirar férias antes do limite legal (concessivo). Trate como prioridade." },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="colaboradores" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Colaboradores</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <HowTo title="Cadastrar um colaborador">
                <li>Abra <strong>Colaboradores</strong> e clique em <strong>+ Novo</strong>.</li>
                <li>Preencha dados pessoais, <strong>data de admissão</strong> e CPF.</li>
                <li>Vincule Unidade, Setor, Cargo e Equipe.</li>
                <li>Salve. O sistema calcula automaticamente o primeiro período aquisitivo.</li>
              </HowTo>
              <HowTo title="Registrar uma demissão">
                <li>Abra o colaborador.</li>
                <li>Informe a <strong>data de desligamento</strong>.</li>
                <li>Salve. Ele deixa de aparecer em novas escalas, mas o histórico fica preservado.</li>
              </HowTo>
              <Scenario title="Cenário: colaborador transferido de setor">
                <li>Abra o cadastro, atualize a estrutura (novo setor/equipe).</li>
                <li>Salve. Períodos aquisitivos e férias já lançadas permanecem.</li>
              </Scenario>
              <Faq idPrefix="col" items={[
                { q: "Mudei a data de admissão — afeta as férias já lançadas?", a: "Recalcula os períodos aquisitivos. Confira os lançamentos para evitar inconsistência." },
                { q: "Posso ter dois colaboradores com mesmo CPF?", a: "Não. CPF é único." },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="estrutura" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Estrutura</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <HowTo title="Montar a estrutura da empresa">
                <li>Cadastre <strong>Unidades</strong> (filiais).</li>
                <li>Em cada unidade, cadastre os <strong>Setores</strong>.</li>
                <li>Cadastre os <strong>Cargos</strong> e as <strong>Equipes</strong>.</li>
                <li>Volte em Colaboradores e vincule cada um à estrutura correta.</li>
              </HowTo>
              <Faq idPrefix="est" items={[
                { q: "Posso excluir uma unidade com colaboradores?", a: "Não. Mova/inative os colaboradores antes." },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ferias" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Férias</CardTitle>
              <CardDescription>Lançamento e acompanhamento de férias por período aquisitivo.</CardDescription></CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <p><strong>Conceitos:</strong></p>
              <Bullets>
                <li><strong>Período aquisitivo</strong> — 12 meses trabalhados que dão direito a 30 dias de férias.</li>
                <li><strong>Período concessivo</strong> — os 12 meses seguintes em que as férias devem ser usadas.</li>
                <li><strong>Divisão</strong> — férias podem ser divididas (1 período ≥ 14 dias e os demais ≥ 5).</li>
                <li><strong>Abono pecuniário</strong> — até 10 dias podem ser vendidos.</li>
              </Bullets>

              <HowTo title="Lançar férias de um colaborador">
                <li>Abra <strong>Férias</strong> e clique em <strong>+ Lançar férias</strong>.</li>
                <li>Selecione o <strong>colaborador</strong> e o <strong>período aquisitivo</strong>.</li>
                <li>Informe data de início, quantidade de dias e abono (se houver).</li>
                <li>Salve. O sistema valida ordem cronológica e sobreposição.</li>
              </HowTo>

              <HowTo title="Dividir as férias em dois períodos">
                <li>Lance o 1º período com pelo menos 14 dias.</li>
                <li>Lance o 2º período (e 3º, se for o caso) com mínimo de 5 dias cada.</li>
                <li>Some sempre 30 dias (ou 20 com abono de 10).</li>
              </HowTo>

              <Scenario title="Cenário: férias em dois períodos com abono">
                <li>Colaborador quer 20 dias + 10 vendidos.</li>
                <li>Lance um único período de 20 dias com <strong>abono = 10</strong>.</li>
                <li>O período aquisitivo é quitado.</li>
              </Scenario>

              <Scenario title="Cenário: corrigir lançamento errado">
                <li>Abra o lançamento na lista.</li>
                <li>Clique em <strong>Editar</strong>, ajuste data/dias.</li>
                <li>Salve. A alteração fica na auditoria.</li>
              </Scenario>

              <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Validação cronológica</AlertTitle>
                <AlertDescription>O sistema bloqueia férias antes da admissão, antes do término do período aquisitivo ou sobrepondo a outro lançamento.</AlertDescription></Alert>

              <Faq idPrefix="fer" items={[
                { q: "Por que apareceu 'período não vencido'?", a: "Você está tentando lançar férias antes do colaborador completar o período aquisitivo correspondente." },
                { q: "Posso lançar férias retroativas?", a: "Sim, desde que dentro do período concessivo e sem sobreposição com outro lançamento." },
                { q: "O sistema avisa quando vence o concessivo?", a: "Sim — aparece no Dashboard e nos alertas de pendências." },
                { q: "Excluí um lançamento — afeta o aquisitivo?", a: "Sim. O saldo de dias volta a ficar disponível no período correspondente." },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="folgas" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" /> Folgas de Sábado</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <HowTo title="Marcar folga de sábado">
                <li>Abra <strong>Folgas</strong>.</li>
                <li>Selecione o sábado no calendário.</li>
                <li>Escolha o colaborador e confirme.</li>
                <li>O saldo de créditos é debitado conforme regra.</li>
              </HowTo>
              <Scenario title="Cenário: troca de folga entre colegas">
                <li>Desmarque a folga do colaborador A.</li>
                <li>Marque o mesmo sábado para o colaborador B.</li>
                <li>Justifique a troca para registro na auditoria.</li>
              </Scenario>
              <Faq idPrefix="fol" items={[
                { q: "O sistema impede marcar dois colaboradores no mesmo sábado?", a: "Não diretamente. Verifique a escala antes de marcar." },
                { q: "De onde vem o saldo de folgas?", a: "Do banco de Créditos — veja a aba Créditos." },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendario" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CalendarRange className="h-5 w-5" /> Calendário</CardTitle>
              <CardDescription>Visão mensal com férias e folgas marcadas.</CardDescription></CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <HowTo title="Filtrar o calendário">
                <li>Use os filtros de unidade, setor, equipe.</li>
                <li>Passe o mouse sobre um evento para ver detalhes.</li>
                <li>Clique para abrir o lançamento.</li>
              </HowTo>
              <Faq idPrefix="cal" items={[
                { q: "Posso imprimir o calendário?", a: "Sim — use a opção de impressão do navegador ou exporte via Relatórios." },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aniversariantes" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Cake className="h-5 w-5" /> Aniversariantes</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <Bullets>
                <li>Lista aniversariantes do mês selecionado, ordenados por dia.</li>
                <li>Inclui data, unidade e setor.</li>
              </Bullets>
              <Faq idPrefix="ani" items={[
                { q: "Como mudar o mês exibido?", a: "Use o seletor de mês no topo da página." },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="relatorios" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Relatórios</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <HowTo title="Exportar férias do período">
                <li>Abra <strong>Relatórios</strong>.</li>
                <li>Selecione o tipo (Férias / Folgas / Períodos vencendo).</li>
                <li>Defina o período e filtros.</li>
                <li>Clique em <strong>Exportar</strong>.</li>
              </HowTo>
              <Faq idPrefix="rel" items={[
                { q: "Qual relatório usar para fechar a folha?", a: "Use o relatório de Férias do período da folha, filtrando por unidade/setor." },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="creditos" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Créditos</CardTitle>
              <CardDescription>Banco de créditos de folgas por colaborador.</CardDescription></CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <HowTo title="Ajustar créditos manualmente">
                <li>Localize o colaborador.</li>
                <li>Clique em <strong>Ajustar</strong> e informe valor + justificativa.</li>
                <li>Salve. O ajuste fica registrado na auditoria.</li>
              </HowTo>
              <Faq idPrefix="cre" items={[
                { q: "Crédito pode ficar negativo?", a: "Depende da regra configurada. Sem permissão, o sistema bloqueia a marcação." },
                { q: "Como zero o banco no início do ano?", a: "Faça um ajuste manual para cada colaborador com justificativa 'Zeragem anual'." },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuracoes" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Configurações</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <Bullets>
                <li>Regras de período aquisitivo/concessivo.</li>
                <li>Parâmetros de divisão de férias.</li>
                <li>Comportamento do banco de créditos.</li>
              </Bullets>
              <Alert><Lightbulb className="h-4 w-4" /><AlertTitle>Atenção</AlertTitle>
                <AlertDescription>Mudanças aqui afetam todos os cálculos futuros. Documente cada alteração.</AlertDescription></Alert>
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
              <HowTo title="Consultar Auditoria (admin)">
                <li>Abra <strong>Auditoria</strong> (<History className="inline h-4 w-4" />).</li>
                <li>Filtre por usuário, período ou tipo de ação.</li>
                <li>Veja o detalhe da alteração.</li>
              </HowTo>
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

export default FeriasHelp;
