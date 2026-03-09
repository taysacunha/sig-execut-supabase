import { useState } from "react";
import { PostValidationResult, BrokerValidationReport, PostValidationViolation } from "@/lib/schedulePostValidation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ChevronDown, 
  ChevronRight,
  User,
  Calendar,
  MapPin
} from "lucide-react";

interface ValidationReportPanelProps {
  result: PostValidationResult | null;
  onClose: () => void;
}

export function ValidationReportPanel({ result, onClose }: ValidationReportPanelProps) {
  const [expandedBrokers, setExpandedBrokers] = useState<Set<string>>(new Set());

  if (!result) return null;

  const toggleBroker = (brokerId: string) => {
    const newExpanded = new Set(expandedBrokers);
    if (newExpanded.has(brokerId)) {
      newExpanded.delete(brokerId);
    } else {
      newExpanded.add(brokerId);
    }
    setExpandedBrokers(newExpanded);
  };

  const expandAll = () => {
    setExpandedBrokers(new Set(result.brokerReports.map(r => r.brokerId)));
  };

  const collapseAll = () => {
    setExpandedBrokers(new Set());
  };

  // Ordenar: brokers com erros primeiro
  const sortedReports = [...result.brokerReports].sort((a, b) => {
    const aHasErrors = a.violations.some(v => v.severity === "error");
    const bHasErrors = b.violations.some(v => v.severity === "error");
    if (aHasErrors && !bHasErrors) return -1;
    if (!aHasErrors && bHasErrors) return 1;
    return a.brokerName.localeCompare(b.brokerName);
  });

  const brokersWithErrors = result.brokerReports.filter(r => 
    r.violations.some(v => v.severity === "error")
  );

  // Verificar se é um resultado de falha (sem brokerReports mas com violations)
  const isFailureResult = result.brokerReports.length === 0 && result.violations.length > 0;

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="gap-1">
          <User className="h-3 w-3" />
          {result.summary.totalBrokers} corretores
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Calendar className="h-3 w-3" />
          {result.summary.totalAssignments} alocações
        </Badge>
        {result.summary.unallocatedCount > 0 && (
          <Badge variant="destructive" className="gap-1">
            <MapPin className="h-3 w-3" />
            {result.summary.unallocatedCount} turno(s) sem corretor
          </Badge>
        )}
        {(result.summary.errorCount - result.summary.unallocatedCount) > 0 && (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            {result.summary.errorCount - result.summary.unallocatedCount} erros de regras
          </Badge>
        )}
        {result.summary.warningCount > 0 && (
          <Badge variant="secondary" className="gap-1 bg-yellow-100 text-yellow-800">
            <AlertTriangle className="h-3 w-3" />
            {result.summary.warningCount} avisos
          </Badge>
        )}
        {result.isValid && (
          <Badge className="gap-1 bg-green-100 text-green-800">
            <CheckCircle2 className="h-3 w-3" />
            Todas regras OK
          </Badge>
        )}
      </div>

      {/* Failure explanation when no broker reports */}
      {isFailureResult && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <h4 className="font-semibold text-destructive mb-2 flex items-center gap-2">
            <XCircle className="h-5 w-5" />
            Geração Falhou - Motivos:
          </h4>
          <p className="text-sm text-muted-foreground mb-3">
            A escala não pôde ser gerada porque as regras abaixo não podem ser satisfeitas com os corretores configurados.
          </p>
          <ul className="space-y-2 text-sm">
            {result.violations.map((v, i) => (
              <li key={i} className="flex items-start gap-2 p-2 bg-background rounded border">
                <span className="text-destructive mt-0.5">
                  {v.severity === "error" ? <XCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                </span>
                <div>
                  <div className="font-medium">{v.rule}</div>
                  <div className="text-muted-foreground">
                    <strong>{v.brokerName}</strong>: {v.details}
                  </div>
                  {/* Explicação da regra */}
                  <RuleExplanation rule={v.rule} />
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
            <strong className="text-yellow-800">💡 Sugestões para resolver:</strong>
            <ul className="text-yellow-700 mt-1 list-disc list-inside space-y-1">
              <li>Verificar se há corretores suficientes configurados nos locais afetados</li>
              <li>Verificar se a disponibilidade dos corretores está correta</li>
              <li>Considerar adicionar mais corretores aos locais com poucos elegíveis</li>
            </ul>
          </div>
        </div>
      )}

      {/* Unallocated demands section */}
      {result.unallocatedDemands && result.unallocatedDemands.length > 0 && !isFailureResult && (
        <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
          <h4 className="font-semibold text-orange-800 mb-2 flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Turnos Não Alocados ({result.unallocatedDemands.length})
          </h4>
          <p className="text-sm text-orange-700 mb-3">
            Os seguintes turnos não receberam corretor. Isso pode indicar falta de corretores configurados ou conflitos de regras.
          </p>
          <ul className="space-y-1 text-sm">
            {result.unallocatedDemands.map((d, i) => (
              <li key={i} className="flex items-center gap-2 p-2 bg-background rounded border">
                <span className="text-orange-600">⚠️</span>
                <span>
                  <strong>{d.locationName}</strong> - {d.date} ({d.shift === "morning" ? "Manhã" : "Tarde"})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Quick actions - only show if there are broker reports */}
      {result.brokerReports.length > 0 && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expandir Todos
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Recolher Todos
          </Button>
        </div>
      )}

      {/* Violations summary - only show if not failure result */}
      {!isFailureResult && result.violations.length > 0 && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <h4 className="font-semibold text-destructive mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Violações Encontradas ({result.violations.length})
          </h4>
          <ul className="space-y-1 text-sm">
            {result.violations.slice(0, 10).map((v, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={v.severity === "error" ? "text-destructive" : "text-yellow-600"}>
                  {v.severity === "error" ? "❌" : "⚠️"}
                </span>
                <span>
                  <strong>{v.brokerName}</strong>: {v.details}
                </span>
              </li>
            ))}
            {result.violations.length > 10 && (
              <li className="text-muted-foreground italic">
                ... e mais {result.violations.length - 10} violações
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Broker reports */}
      {result.brokerReports.length > 0 && (
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-2">
            {sortedReports.map((report) => (
              <BrokerReportCard
                key={report.brokerId}
                report={report}
                isExpanded={expandedBrokers.has(report.brokerId)}
                onToggle={() => toggleBroker(report.brokerId)}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

interface BrokerReportCardProps {
  report: BrokerValidationReport;
  isExpanded: boolean;
  onToggle: () => void;
}

function BrokerReportCard({ report, isExpanded, onToggle }: BrokerReportCardProps) {
  const hasErrors = report.violations.some(v => v.severity === "error");
  const hasWarnings = report.violations.some(v => v.severity === "warning");

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <div 
          className={`
            flex items-center justify-between p-3 rounded-lg cursor-pointer
            hover:bg-muted/50 transition-colors
            ${hasErrors ? 'bg-destructive/5 border border-destructive/20' : 
              hasWarnings ? 'bg-yellow-50 border border-yellow-200' : 
              'bg-muted/30 border border-transparent'}
          `}
        >
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            
            {hasErrors ? (
              <XCircle className="h-5 w-5 text-destructive" />
            ) : hasWarnings ? (
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            )}
            
            <span className="font-medium">{report.brokerName}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="text-xs">
              {report.externalCount} ext
            </Badge>
            <Badge variant="outline" className="text-xs">
              {report.internalCount} int
            </Badge>
            <Badge variant="outline" className="text-xs">
              {report.saturdayCount} sáb
            </Badge>
            {report.violations.length > 0 && (
              <Badge variant={hasErrors ? "destructive" : "secondary"} className="text-xs">
                {report.violations.length} violação(ões)
              </Badge>
            )}
          </div>
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="ml-8 mt-2 space-y-3 pb-3">
          {/* Weekly breakdown */}
          <div className="text-sm">
            <h5 className="font-medium mb-2 text-muted-foreground">Distribuição Semanal:</h5>
            <div className="grid gap-2">
              {report.weeklyBreakdown.map((week, i) => (
                <div 
                  key={i} 
                  className="flex items-center justify-between p-2 bg-muted/30 rounded text-xs"
                >
                  <span className="font-medium">{week.weekLabel}</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {week.externalCount} ext / {week.internalCount} int
                    </span>
                    <span className="text-muted-foreground">
                      {week.locations.slice(0, 3).join(", ")}
                      {week.locations.length > 3 && `... +${week.locations.length - 3}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Violations for this broker */}
          {report.violations.length > 0 && (
            <div className="text-sm">
              <h5 className="font-medium mb-2 text-destructive">Violações:</h5>
              <ul className="space-y-1">
                {report.violations.map((v, i) => (
                  <li 
                    key={i} 
                    className={`
                      p-2 rounded text-xs
                      ${v.severity === "error" ? 'bg-destructive/10 text-destructive' : 'bg-yellow-50 text-yellow-800'}
                    `}
                  >
                    <div className="font-medium">{v.rule}</div>
                    <div>{v.details}</div>
                    {v.dates && v.dates.length > 0 && (
                      <div className="text-muted-foreground mt-1">
                        Datas: {v.dates.join(", ")}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* No violations */}
          {report.violations.length === 0 && (
            <div className="text-sm text-green-600 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Todas as regras foram respeitadas
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ═══════════════════════════════════════════════════════════
// COMPONENTE DE EXPLICAÇÃO DE REGRAS
// Exibe uma explicação clara e didática do que cada regra significa
// ═══════════════════════════════════════════════════════════
function RuleExplanation({ rule }: { rule: string }) {
  const ruleExplanations: Record<string, string> = {
    "REGRA 4": "Um corretor não pode estar em dois locais externos diferentes no mesmo dia. É fisicamente impossível.",
    "REGRA 4: Múltiplos locais externos no mesmo dia": "Um corretor não pode estar em dois locais externos diferentes no mesmo dia. É fisicamente impossível.",
    "REGRA 4: Externo em múltiplos locais no mesmo dia": "Um corretor não pode estar em dois locais externos diferentes no mesmo dia. É fisicamente impossível.",
    "REGRA 6": "Corretores não podem atender construtoras concorrentes no mesmo dia (acordo comercial).",
    "REGRA 6: Conflito de construtora": "Corretores não podem atender construtoras concorrentes no mesmo dia (acordo comercial).",
    "REGRA 8": "Corretores não podem trabalhar em locais externos em dias consecutivos (evita sobrecarga).",
    "REGRA 8: Dias consecutivos": "Corretores não podem trabalhar em locais externos em dias consecutivos (evita sobrecarga).",
    "REGRA 9": "Corretor não pode ter externos no sábado E domingo da mesma semana (folga garantida).",
    "REGRA 9: Sábado E Domingo": "Corretor não pode ter externos no sábado E domingo da mesma semana (folga garantida).",
    "REGRA 10": "Corretor não deve repetir no mesmo local externo em semanas consecutivas (rotação justa).",
    "REGRA 10: Rotação entre semanas": "Corretor não deve repetir no mesmo local externo em semanas consecutivas (rotação justa).",
    "MAX_2_EXTERNOS_SEMANA": "Limite de 2 dias externos por semana. Pode ser excedido quando a demanda exige e todos já têm 2.",
    "SEM_EXTERNOS_CONSECUTIVOS": "Corretores não podem trabalhar em locais externos em dias seguidos (evita sobrecarga).",
    "SEM_REPETICAO_LOCAL_SEMANAS_SEGUIDAS": "Corretor não deve ir ao mesmo local externo em semanas consecutivas.",
    "SEM_SABADO_DOMINGO_EXTERNOS": "Corretor não pode ter externos no sábado E domingo da mesma semana.",
    "RODIZIO_EXTERNOS_NAO_ALTERNADO": "Corretores Seg-Dom devem alternar entre 1 e 2 externos por semana para equidade.",
    "TURNO_NAO_ALOCADO": "Um turno ficou sem corretor designado. Verifique se há corretores elegíveis suficientes.",
    "DISTRIBUICAO_2_ANTES_3": "Nenhum corretor pode ter 3+ plantões externos enquanto outro corretor elegível tiver menos de 2. Distribuição deve ser equilibrada.",
    "CONCENTRACAO_DOMINGOS": "Um corretor está recebendo muitos domingos no mesmo local. A rotação FIFO deve garantir distribuição equitativa.",
    "FORA_DISPONIBILIDADE": "Corretor foi alocado em um dia que não está na sua disponibilidade global. Verifique o cadastro do corretor em Corretores > Disponibilidade.",
    "INTERNO_EXTERNO_MESMO_DIA": "Interno e externo no mesmo dia: permitido seg-sex em turnos diferentes (manhã/tarde), mas proibido aos sábados ou no mesmo turno.",
    "TURNO_NAO_CONFIGURADO": "Um turno foi gerado para um horário que não está configurado no local. Verifique a configuração de períodos do local em Locais > Períodos.",
  };

  // Procurar explicação que contenha a regra
  let explanation = "";
  for (const [key, value] of Object.entries(ruleExplanations)) {
    if (rule.includes(key) || key.includes(rule.split(":")[0])) {
      explanation = value;
      break;
    }
  }

  if (!explanation) return null;

  return (
    <div className="mt-1 text-xs text-blue-600 bg-blue-50 p-1.5 rounded border border-blue-100">
      💡 {explanation}
    </div>
  );
}
