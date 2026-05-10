import {
  HelpCircle,
  Home,
  Users,
  Building2,
  Calendar,
  CalendarDays,
  CalendarRange,
  Cake,
  FileBarChart,
  CreditCard,
  Settings,
  Shield,
  History,
  UserCircle,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Pencil,
  Plus,
  Trash2,
  Filter,
  FileText,
  Printer,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const Step = ({ children }: { children: React.ReactNode }) => (
  <ol className="list-decimal ml-6 space-y-2 text-sm leading-relaxed">{children}</ol>
);

const Bullets = ({ children }: { children: React.ReactNode }) => (
  <ul className="list-disc ml-6 space-y-1 text-sm leading-relaxed">{children}</ul>
);

const FeriasHelp = () => {
  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <HelpCircle className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Central de Ajuda</h1>
        </div>
        <p className="text-muted-foreground">
          Guia completo para utilizar o sistema de Gestão de Férias e Folgas
        </p>
      </div>

      <Tabs defaultValue="visao-geral" className="space-y-6">
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

        {/* VISÃO GERAL */}
        <TabsContent value="visao-geral" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Home className="h-5 w-5" /> O que é o sistema de Gestão de Férias e Folgas?</CardTitle>
              <CardDescription>Plataforma para controlar férias, folgas de sábado, afastamentos e a estrutura organizacional da empresa.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <p>
                O sistema centraliza o cadastro de colaboradores, a estrutura da empresa
                (unidades, setores, cargos e equipes), o controle de períodos aquisitivos,
                o lançamento de férias e a gestão das folgas de sábado, com calendário,
                relatórios e créditos.
              </p>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Perfis de acesso</h4>
                <Bullets>
                  <li><Badge className="bg-purple-600 text-white mr-2">Super Admin</Badge> Acesso total, incluindo gestão de usuários e auditoria.</li>
                  <li><Badge className="bg-destructive/80 text-destructive-foreground mr-2">Administrador</Badge> Acesso total ao módulo, gestão de usuários e configurações.</li>
                  <li><Badge className="bg-primary/80 text-primary-foreground mr-2">Gerente</Badge> Cadastra e edita colaboradores, lança férias e folgas.</li>
                  <li><Badge className="bg-blue-600/80 text-white mr-2">Supervisor</Badge> Acompanha equipes e gera relatórios.</li>
                  <li><Badge variant="secondary" className="mr-2">Colaborador</Badge> Visualiza informações pertinentes ao seu vínculo.</li>
                </Bullets>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Fluxo recomendado para começar</h4>
                <Step>
                  <li>Configure a <b>Estrutura</b>: unidades, setores, cargos e equipes.</li>
                  <li>Cadastre os <b>Colaboradores</b> e vincule cada um à estrutura.</li>
                  <li>Ajuste as <b>Configurações</b> (quinzenas, feriados, regras).</li>
                  <li>Lance os <b>Períodos Aquisitivos</b> e as <b>Férias</b>.</li>
                  <li>Gere as <b>Folgas de Sábado</b> e acompanhe pelo <b>Calendário</b>.</li>
                  <li>Utilize <b>Relatórios</b> e <b>Créditos</b> para fechamentos.</li>
                </Step>
              </div>
            </CardContent>
          </Card>

          <Alert>
            <Lightbulb className="h-4 w-4" />
            <AlertTitle>Dica</AlertTitle>
            <AlertDescription>
              Em quase todas as listas existem três botões de ação: <Eye className="inline h-3 w-3" /> visualizar, <Pencil className="inline h-3 w-3" /> editar e <Trash2 className="inline h-3 w-3" /> inativar/excluir.
              Use sempre o botão de visualizar quando quiser apenas consultar — ele não altera nada.
            </AlertDescription>
          </Alert>
        </TabsContent>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileBarChart className="h-5 w-5" /> Dashboard</CardTitle>
              <CardDescription>Página inicial do módulo, com indicadores rápidos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed">
              <p>O Dashboard exibe contadores e listas resumidas para acompanhamento diário:</p>
              <Bullets>
                <li>Total de colaboradores ativos por unidade/setor.</li>
                <li>Colaboradores em férias no período atual.</li>
                <li>Próximas férias agendadas.</li>
                <li>Aniversariantes do mês.</li>
                <li>Pendências de períodos aquisitivos vencendo.</li>
              </Bullets>
              <Alert>
                <Lightbulb className="h-4 w-4" />
                <AlertTitle>Como usar</AlertTitle>
                <AlertDescription>
                  Clique nos cards para ser direcionado à listagem completa do indicador correspondente.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* COLABORADORES */}
        <TabsContent value="colaboradores" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Colaboradores</CardTitle>
              <CardDescription>Cadastro e manutenção das pessoas da empresa.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2"><Plus className="h-4 w-4" /> Como cadastrar</h4>
                <Step>
                  <li>Acesse <b>Colaboradores</b> no menu lateral.</li>
                  <li>Clique em <b>Novo Colaborador</b>.</li>
                  <li>Preencha os dados pessoais: nome, CPF, data de nascimento, data de admissão, email e telefone.</li>
                  <li>Vincule o colaborador a uma <b>Unidade</b>, <b>Setor</b>, <b>Cargo</b> e (opcionalmente) <b>Equipe</b>.</li>
                  <li>Defina se ele participa do esquema de <b>Folgas de Sábado</b>.</li>
                  <li>Clique em <b>Salvar</b>. O sistema cria automaticamente os períodos aquisitivos com base na data de admissão.</li>
                </Step>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2"><Eye className="h-4 w-4" /> Como visualizar</h4>
                <p>Clique no botão <Eye className="inline h-3 w-3" /> na linha do colaborador. Abre uma janela com todos os dados, vínculos, períodos aquisitivos, férias gozadas e afastamentos — sem permitir alteração.</p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2"><Pencil className="h-4 w-4" /> Como editar</h4>
                <Step>
                  <li>Clique no botão <Pencil className="inline h-3 w-3" /> na linha desejada.</li>
                  <li>Atualize os campos necessários.</li>
                  <li>Clique em <b>Salvar</b>. Alterações de unidade/setor afetam relatórios futuros.</li>
                </Step>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Inativação</h4>
                <p>Use o botão de <Trash2 className="inline h-3 w-3" /> para inativar. O sistema pede confirmação. Colaboradores inativos deixam de aparecer nas listas operacionais, mas continuam disponíveis em relatórios históricos.</p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Afastamentos</h4>
                <p>Dentro do diálogo do colaborador existe a seção <b>Afastamentos</b> para registrar licenças (médica, maternidade, etc.) com data de início e fim. Afastamentos suspendem a contagem do período aquisitivo conforme as regras configuradas.</p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2"><Filter className="h-4 w-4" /> Filtros e busca</h4>
                <p>Use os filtros no topo da página para combinar unidade, setor, cargo, status (ativo/inativo) e busca por nome.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ESTRUTURA */}
        <TabsContent value="estrutura" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Estrutura organizacional</CardTitle>
              <CardDescription>Define como a empresa é organizada — base para todo o restante do sistema.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <p>A página de Estrutura possui quatro abas: <b>Unidades</b>, <b>Setores</b>, <b>Cargos</b> e <b>Equipes</b>. Em todas elas você encontra os mesmos botões de ação: <Eye className="inline h-3 w-3" /> visualizar, <Pencil className="inline h-3 w-3" /> editar e <Trash2 className="inline h-3 w-3" /> inativar.</p>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Unidades</h4>
                <Bullets>
                  <li><b>Cadastrar:</b> clique em <b>Nova Unidade</b>, informe nome e descrição.</li>
                  <li><b>Visualizar:</b> mostra setores e colaboradores vinculados, com badge de ativo/inativo.</li>
                  <li><b>Editar:</b> permite renomear ou inativar a unidade.</li>
                </Bullets>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Setores</h4>
                <Bullets>
                  <li><b>Cadastrar:</b> selecione a unidade pai, defina nome e chefes.</li>
                  <li><b>Visualizar:</b> exibe chefes do setor e colaboradores associados.</li>
                  <li><b>Editar:</b> altera vínculo de unidade, chefes ou nome.</li>
                </Bullets>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Cargos</h4>
                <Bullets>
                  <li><b>Cadastrar:</b> nome e descrição.</li>
                  <li><b>Visualizar:</b> lista todos os colaboradores que ocupam o cargo, com setor e unidade.</li>
                </Bullets>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Equipes</h4>
                <Bullets>
                  <li><b>Cadastrar:</b> defina nome, líder e membros.</li>
                  <li><b>Editar:</b> adicione/remova membros.</li>
                </Bullets>
              </div>
              <Alert variant="default">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Atenção</AlertTitle>
                <AlertDescription>
                  Inativar uma unidade/setor/cargo não remove o histórico, mas impede novos vínculos. Antes de inativar, mova os colaboradores ativos para outra estrutura.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FÉRIAS */}
        <TabsContent value="ferias" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Períodos aquisitivos e Férias</CardTitle>
              <CardDescription>Gestão completa do ciclo aquisitivo/concessivo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <div>
                <h4 className="font-semibold mb-2">Como funciona</h4>
                <p>Cada colaborador tem <b>períodos aquisitivos</b> de 12 meses gerados a partir da data de admissão. Para cada período, o colaborador acumula direito a férias que devem ser gozadas no <b>período concessivo</b> seguinte.</p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2"><Plus className="h-4 w-4" /> Como lançar uma férias</h4>
                <Step>
                  <li>Acesse <b>Férias</b> no menu lateral.</li>
                  <li>Clique em <b>Nova Férias</b>.</li>
                  <li>Selecione o colaborador e o <b>período aquisitivo</b> a ser usado.</li>
                  <li>Informe a quinzena ou data de início e fim.</li>
                  <li>O sistema valida sobreposição com outras férias, folgas e afastamentos. Conflitos aparecem em destaque.</li>
                  <li>Clique em <b>Salvar</b>.</li>
                </Step>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Conflitos detectados</h4>
                <p>Ao abrir o diálogo de edição, a área <b>Conflitos Detectados</b> mostra apenas conflitos relevantes (sobreposição com outras férias, folgas e afastamentos). A informação é atualizada toda vez que o diálogo é aberto.</p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Redução de férias</h4>
                <p>Use o botão <b>Reduzir Férias</b> para registrar o abono pecuniário (até 1/3 do período). O sistema recalcula a quantidade de dias gozados automaticamente.</p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Exceções de períodos</h4>
                <p>Permite ajustar manualmente o período aquisitivo de um colaborador (ex.: afastamentos que reiniciam o ciclo). Disponível dentro do diálogo do colaborador, na seção <b>Períodos Aquisitivos</b>.</p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Quitar período</h4>
                <p>Quando todas as férias de um período aquisitivo foram gozadas/abonadas, use <b>Quitar Período</b> para fechar o ciclo. Períodos quitados não recebem novos lançamentos.</p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Gerador em lote</h4>
                <p>Use o <b>Gerador de Férias</b> para sugerir lançamentos automáticos por unidade/setor, com prévia antes da confirmação.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FOLGAS */}
        <TabsContent value="folgas" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" /> Folgas de Sábado</CardTitle>
              <CardDescription>Distribuição e movimentação das folgas semanais.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <div>
                <h4 className="font-semibold mb-2">Gerar folgas</h4>
                <Step>
                  <li>Clique em <b>Gerar Folgas</b>.</li>
                  <li>Selecione o período (mês/ano) e os setores envolvidos.</li>
                  <li>Confirme — o sistema distribui as folgas seguindo a fila e as regras configuradas.</li>
                </Step>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Movimentações disponíveis</h4>
                <Bullets>
                  <li><b>Mover folga:</b> altera a data de uma folga já atribuída.</li>
                  <li><b>Mover em lote:</b> reposiciona várias folgas de uma vez.</li>
                  <li><b>Trocar folga:</b> dois colaboradores trocam datas entre si.</li>
                  <li><b>Perda de folga:</b> registra que o colaborador perdeu o direito (ex.: falta).</li>
                  <li><b>Remover folga:</b> exclui uma folga lançada erroneamente — exige confirmação.</li>
                </Bullets>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2"><Printer className="h-4 w-4" /> Impressão</h4>
                <p>Use os botões <b>PDF</b> ou <b>Imprimir</b> para gerar a escala de folgas no formato oficial. O <b>Quadro de Setores nos Sábados</b> mostra a cobertura por setor em cada sábado.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CALENDÁRIO */}
        <TabsContent value="calendario" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CalendarRange className="h-5 w-5" /> Calendário</CardTitle>
              <CardDescription>Visão consolidada de férias, folgas e aniversariantes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed">
              <p>A página possui três abas:</p>
              <Bullets>
                <li><b>Férias:</b> visão Gantt com todos os lançamentos do período. Filtre por unidade/setor.</li>
                <li><b>Folgas:</b> calendário mensal com as folgas de sábado.</li>
                <li><b>Aniversariantes:</b> calendário com aniversários do mês.</li>
              </Bullets>
              <Alert>
                <Lightbulb className="h-4 w-4" />
                <AlertTitle>Dica</AlertTitle>
                <AlertDescription>
                  Passe o mouse sobre as barras do Gantt para ver detalhes do colaborador e do período de férias.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ANIVERSARIANTES */}
        <TabsContent value="aniversariantes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Cake className="h-5 w-5" /> Aniversariantes</CardTitle>
              <CardDescription>Listagem mensal e geração de PDFs.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed">
              <Step>
                <li>Selecione o mês desejado.</li>
                <li>Aplique filtros de unidade/setor se necessário.</li>
                <li>Clique em <b>PDF</b> para a versão padrão ou em <b>Celebre</b> para a versão decorada.</li>
              </Step>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RELATÓRIOS */}
        <TabsContent value="relatorios" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Relatórios</CardTitle>
              <CardDescription>Documentos oficiais e consultas analíticas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <Bullets>
                <li><b>Consulta Geral:</b> filtra colaboradores por status, unidade, setor e exporta a lista.</li>
                <li><b>Contador:</b> relatório consolidado por período para envio ao contador, em PDF.</li>
                <li><b>Exceções:</b> lista situações fora do padrão (períodos atrasados, sobreposições resolvidas).</li>
                <li><b>Formulário Anual:</b> formulário de programação anual de férias por colaborador, gerado em PDF.</li>
              </Bullets>
              <Alert>
                <Lightbulb className="h-4 w-4" />
                <AlertTitle>Como gerar</AlertTitle>
                <AlertDescription>
                  Em todas as abas, defina os filtros, clique em <b>Pesquisar</b> e depois em <b>PDF</b> para exportar.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CRÉDITOS */}
        <TabsContent value="creditos" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Créditos</CardTitle>
              <CardDescription>Saldos remanescentes de férias e folgas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed">
              <p>A página exibe o saldo de cada colaborador em duas categorias:</p>
              <Bullets>
                <li><b>Crédito de Férias:</b> dias ainda não usufruídos de períodos abertos.</li>
                <li><b>Crédito de Folgas:</b> folgas de sábado pendentes.</li>
              </Bullets>
              <h4 className="font-semibold mt-2">Como utilizar um crédito</h4>
              <Step>
                <li>Clique em <b>Utilizar</b> na linha desejada.</li>
                <li>Escolha a data e a quantidade.</li>
                <li>Confirme — o sistema lança automaticamente como férias/folga e abate do saldo.</li>
              </Step>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Atenção</AlertTitle>
                <AlertDescription>
                  Períodos aquisitivos próximos do vencimento aparecem destacados. Programe o uso antes da data limite para evitar pagamento em dobro.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONFIGURAÇÕES */}
        <TabsContent value="configuracoes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Configurações</CardTitle>
              <CardDescription>Parâmetros que regem todo o módulo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <div>
                <h4 className="font-semibold mb-1">Quinzenas</h4>
                <p>Define como as datas de férias são organizadas em quinzenas (1ª e 2ª de cada mês). Usado pelo gerador automático.</p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-1">Feriados</h4>
                <p>Cadastro de feriados nacionais, estaduais e municipais que afetam o cálculo de dias úteis e folgas.</p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-1">Folgas</h4>
                <p>Regras de geração das folgas de sábado: setores participantes, ordem da fila e exceções.</p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-1">Regras</h4>
                <p>Limites como mínimo de dias por férias, antecedência mínima para lançamento e tratamento de afastamentos.</p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-1">Avançado</h4>
                <p>Ações sensíveis: recálculo de períodos aquisitivos, limpeza de cache e diagnóstico. Use com cautela e somente quando orientado.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PERFIL E USUÁRIOS */}
        <TabsContent value="usuarios" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><UserCircle className="h-5 w-5" /> Perfil</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm leading-relaxed">
              <p>Em <b>Perfil</b> você atualiza nome, email e troca de senha. A troca de senha pede confirmação dupla por segurança.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Usuários (admin)</CardTitle>
              <CardDescription>Disponível para Super Admin e Administrador.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed">
              <Bullets>
                <li><b>Convidar usuário:</b> envia email com link para definição de senha.</li>
                <li><b>Atribuir papel:</b> defina o perfil (admin, manager, supervisor, etc.).</li>
                <li><b>Acesso a sistemas:</b> marque quais módulos (Escalas, Vendas, Férias, Estoque) o usuário pode acessar.</li>
                <li><b>Vincular unidades:</b> restrinja a visão por unidade quando aplicável.</li>
                <li><b>Inativar:</b> bloqueia o acesso sem apagar o histórico — exige confirmação.</li>
              </Bullets>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Auditoria</CardTitle>
              <CardDescription>Histórico de todas as ações realizadas no módulo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed">
              <p>Cada criação, edição ou exclusão é registrada com usuário, data/hora e dados antes/depois.</p>
              <h4 className="font-semibold">Filtros disponíveis</h4>
              <Bullets>
                <li><b>Período (De/Até):</b> seleciona a faixa de datas exata. Permite consultar dias anteriores sem limite de registros do dia.</li>
                <li><b>Carregar últimos:</b> escolha quantos registros buscar (200, 500, 1000, 2000 ou 5000).</li>
                <li><b>Módulo:</b> aplica o filtro diretamente no banco, garantindo que registros de outros módulos não ocupem espaço da consulta.</li>
              </Bullets>
              <Alert>
                <Lightbulb className="h-4 w-4" />
                <AlertTitle>Dica</AlertTitle>
                <AlertDescription>
                  Para investigar uma ação de ontem, defina <b>De</b> = ontem e <b>Até</b> = hoje, e mantenha o filtro de módulo em <b>Férias</b>.
                </AlertDescription>
              </Alert>
              <div className="flex items-center gap-2 mt-3 text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>O contador "Carregados: N" indica quantos registros estão na consulta atual.</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FeriasHelp;