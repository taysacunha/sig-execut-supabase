import { useState, useMemo } from "react";
import { PostValidationResult, BrokerValidationReport, PostValidationViolation, UnallocatedDemand } from "@/lib/schedulePostValidation";
import { BrokerAllocationDiagnostic, EligibilityExclusion, BrokerExternalEligibility } from "@/lib/generationTrace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ChevronDown, 
  ChevronRight,
  User,
  Calendar,
  MapPin,
  Search,
  Filter,
  LayoutList,
  Layers,
  HelpCircle,
  Link2
} from "lucide-react";

interface ValidationReportPanelProps {
  result: PostValidationResult | null;
  onClose: () => void;
  brokerDiagnostics?: BrokerAllocationDiagnostic[];
  eligibilityExclusions?: EligibilityExclusion[];
  brokerEligibilityMap?: BrokerExternalEligibility[];
}

type SeverityFilter = "all" | "error" | "warning";
type ViewMode = "broker" | "rule" | "diagnostic" | "eligibility";

// ═══════════════════════════════════════════════════════════
// RULE EXPLANATIONS MAP
// ═══════════════════════════════════════════════════════════
const ruleExplanations: Record<string, string> = {
  "REGRA 4": "Um corretor não pode estar em dois locais externos diferentes no mesmo dia.",
  "REGRA 6": "Corretores não podem atender construtoras concorrentes no mesmo dia.",
  "REGRA 8": "Corretores não podem trabalhar em locais externos em dias consecutivos.",
  "REGRA 9": "Corretor não pode ter externos no sábado E domingo da mesma semana.",
  "REGRA 10": "Corretor não deve repetir no mesmo local externo em semanas consecutivas.",
  "MAX_2_EXTERNOS_SEMANA": "Limite de 2 dias externos por semana.",
  "SEM_EXTERNOS_CONSECUTIVOS": "Corretores não podem trabalhar em locais externos em dias seguidos.",
  "SEM_REPETICAO_LOCAL_SEMANAS_SEGUIDAS": "Corretor não deve ir ao mesmo local externo em semanas consecutivas.",
  "SEM_SABADO_DOMINGO_EXTERNOS": "Corretor não pode ter externos no sábado E domingo da mesma semana.",
  "RODIZIO_EXTERNOS_NAO_ALTERNADO": "Corretores Seg-Dom devem alternar entre 1 e 2 externos por semana.",
  "TURNO_NAO_ALOCADO": "Um turno ficou sem corretor designado.",
  "DISTRIBUICAO_2_ANTES_3": "A distribuição de plantões externos deve ser equilibrada: todos os corretores devem ter pelo menos 2 externos antes que qualquer um receba um 3º. Se alguém tem 3+ enquanto outro tem menos de 2, a distribuição está desbalanceada.",
  "CONCENTRACAO_DOMINGOS": "Um corretor recebe muitos domingos no mesmo local.",
  "FORA_DISPONIBILIDADE": "Corretor alocado em dia fora da sua disponibilidade.",
  "INTERNO_EXTERNO_MESMO_DIA": "Interno e externo no mesmo dia é proibido apenas aos sábados. De segunda a sexta é permitido em turnos diferentes.",
  "TURNO_NAO_CONFIGURADO": "Turno gerado para horário não configurado no local.",
};

function getRuleExplanation(rule: string): string {
  for (const [key, value] of Object.entries(ruleExplanations)) {
    if (rule.includes(key) || key.includes(rule.split(":")[0])) {
      return value;
    }
  }
  return "";
}

function getRuleShortName(rule: string): string {
  const parts = rule.split(":");
  return parts[0].trim();
}

// ═══════════════════════════════════════════════════════════
// HUMANIZAR RAZÕES DE EXCLUSÃO
// Traduz strings técnicas do gerador para português claro
// ═══════════════════════════════════════════════════════════
const weekdayMap: Record<string, string> = {
  monday: "segundas", tuesday: "terças", wednesday: "quartas",
  thursday: "quintas", friday: "sextas", saturday: "sábados", sunday: "domingos",
};
const shiftMap: Record<string, string> = { morning: "manhã", afternoon: "tarde" };

function humanizeExclusionReason(reason: string): string {
  // DIA: monday não está em available_weekdays
  {
    const m = reason.match(/DIA:\s*(\w+)\s*não está em available_weekdays/i);
    if (m) return `Corretor não trabalha às ${weekdayMap[m[1]] || m[1]}`;
  }
  // GLOBAL: sem disponibilidade para morning em tuesday
  {
    const m = reason.match(/GLOBAL:\s*sem disponibilidade para\s*(\w+)\s*em\s*(\w+)/i);
    if (m) return `Sem disponibilidade pela ${shiftMap[m[1]] || m[1]} às ${weekdayMap[m[2]] || m[2]}`;
  }
  // LOCAL: weekday_shift_availability não inclui afternoon em wednesday
  {
    const m = reason.match(/LOCAL:\s*weekday_shift_availability não inclui\s*(\w+)\s*em\s*(\w+)/i);
    if (m) return `Vínculo local não permite turno da ${shiftMap[m[1]] || m[1]} às ${weekdayMap[m[2]] || m[2]}`;
  }
  // LEGACY: available_morning = false / available_afternoon = false
  {
    const m = reason.match(/LEGACY:\s*available_(morning|afternoon)\s*=\s*false/i);
    if (m) return `Turno da ${shiftMap[m[1]] || m[1]} desabilitado neste local`;
  }
  // Fallback: return as-is
  return reason;
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export function ValidationReportPanel({ result, onClose, brokerDiagnostics, eligibilityExclusions, brokerEligibilityMap }: ValidationReportPanelProps) {
  const [expandedBrokers, setExpandedBrokers] = useState<Set<string>>(new Set());
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const [expandedDiagnostics, setExpandedDiagnostics] = useState<Set<string>>(new Set());
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [ruleFilter, setRuleFilter] = useState<string>("all");
  const [searchBroker, setSearchBroker] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("broker");

  const isFailureResult = result ? result.brokerReports.length === 0 && result.violations.length > 0 : false;

  // ─── Derived data ────────────────────────────────────────
  const allViolations = useMemo(() => {
    if (!result) return [];
    const violations: PostValidationViolation[] = [...result.violations];
    result.brokerReports.forEach(r => {
      r.violations.forEach(v => {
        if (!violations.some(existing => 
          existing.rule === v.rule && existing.brokerId === v.brokerId && existing.details === v.details
        )) {
          violations.push(v);
        }
      });
    });
    return violations;
  }, [result]);

  // Group violations by rule
  const violationsByRule = useMemo(() => {
    const map = new Map<string, PostValidationViolation[]>();
    allViolations.forEach(v => {
      const key = getRuleShortName(v.rule);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    });
    return map;
  }, [allViolations]);

  // Unique rule names for filter dropdown
  const uniqueRules = useMemo(() => Array.from(violationsByRule.keys()).sort(), [violationsByRule]);

  // ─── Filtering logic ────────────────────────────────────
  const filteredViolations = useMemo(() => {
    return allViolations.filter(v => {
      if (severityFilter !== "all" && v.severity !== severityFilter) return false;
      if (ruleFilter !== "all" && !v.rule.includes(ruleFilter)) return false;
      if (searchBroker && !v.brokerName.toLowerCase().includes(searchBroker.toLowerCase())) return false;
      return true;
    });
  }, [allViolations, severityFilter, ruleFilter, searchBroker]);

  // ─── Global violations (brokerId vazio) ──────────────────
  const filteredGlobalViolations = useMemo(() => {
    if (!result) return [];
    return result.violations.filter(v => {
      if (v.brokerId && v.brokerId !== "") return false;
      if (severityFilter !== "all" && v.severity !== severityFilter) return false;
      if (ruleFilter !== "all" && !v.rule.includes(ruleFilter)) return false;
      return true;
    });
  }, [result, severityFilter, ruleFilter]);

  const filteredBrokerReports = useMemo(() => {
    if (!result) return [];
    let reports = [...result.brokerReports];
    
    if (searchBroker) {
      reports = reports.filter(r => r.brokerName.toLowerCase().includes(searchBroker.toLowerCase()));
    }

    // When filtering by severity or rule, only show brokers with matching violations
    if (severityFilter !== "all" || ruleFilter !== "all") {
      reports = reports.filter(r => {
        const matchingViolations = r.violations.filter(v => {
          if (severityFilter !== "all" && v.severity !== severityFilter) return false;
          if (ruleFilter !== "all" && !v.rule.includes(ruleFilter)) return false;
          return true;
        });
        return matchingViolations.length > 0;
      });
    }

    // Sort: errors first
    reports.sort((a, b) => {
      const aErrors = a.violations.filter(v => severityFilter === "all" || v.severity === severityFilter).some(v => v.severity === "error");
      const bErrors = b.violations.filter(v => severityFilter === "all" || v.severity === severityFilter).some(v => v.severity === "error");
      if (aErrors && !bErrors) return -1;
      if (!aErrors && bErrors) return 1;
      return a.brokerName.localeCompare(b.brokerName);
    });

    return reports;
  }, [result, severityFilter, ruleFilter, searchBroker]);

  const filteredViolationsByRule = useMemo(() => {
    const map = new Map<string, PostValidationViolation[]>();
    filteredViolations.forEach(v => {
      const key = getRuleShortName(v.rule);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    });
    return map;
  }, [filteredViolations]);

  // ─── Actions ─────────────────────────────────────────────
  const toggleBroker = (id: string) => {
    const s = new Set(expandedBrokers);
    s.has(id) ? s.delete(id) : s.add(id);
    setExpandedBrokers(s);
  };

  const toggleRule = (rule: string) => {
    const s = new Set(expandedRules);
    s.has(rule) ? s.delete(rule) : s.add(rule);
    setExpandedRules(s);
  };

  const expandAll = () => {
    if (viewMode === "broker") {
      setExpandedBrokers(new Set(filteredBrokerReports.map(r => r.brokerId)));
    } else {
      setExpandedRules(new Set(filteredViolationsByRule.keys()));
    }
  };

  const collapseAll = () => {
    setExpandedBrokers(new Set());
    setExpandedRules(new Set());
  };

  const clearFilters = () => {
    setSeverityFilter("all");
    setRuleFilter("all");
    setSearchBroker("");
  };

  const hasActiveFilters = severityFilter !== "all" || ruleFilter !== "all" || searchBroker !== "";

  const errorCount = allViolations.filter(v => v.severity === "error").length;
  const warningCount = allViolations.filter(v => v.severity === "warning").length;

  if (!result) return null;

  return (
    <div className="space-y-4">
      {/* ─── Summary Badges ──────────────────────────────── */}
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
        {errorCount > 0 && (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            {errorCount} erros
          </Badge>
        )}
        {warningCount > 0 && (
          <Badge variant="secondary" className="gap-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            <AlertTriangle className="h-3 w-3" />
            {warningCount} avisos
          </Badge>
        )}
        {result.isValid && (
          <Badge className="gap-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
            <CheckCircle2 className="h-3 w-3" />
            Todas regras OK
          </Badge>
        )}
      </div>

      {/* ─── Failure State ───────────────────────────────── */}
      {isFailureResult && (
        <FailureSection violations={result.violations} />
      )}

      {/* ─── Unallocated Demands ─────────────────────────── */}
      {result.unallocatedDemands && result.unallocatedDemands.length > 0 && !isFailureResult && (
        <UnallocatedSection demands={result.unallocatedDemands} />
      )}

      {/* ─── Rule Summary Cards ──────────────────────────── */}
      {!isFailureResult && violationsByRule.size > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Resumo por Regra</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Array.from(violationsByRule.entries()).map(([rule, violations]) => {
              const hasErrors = violations.some(v => v.severity === "error");
              const isActive = ruleFilter === rule;
              return (
                <button
                  key={rule}
                  onClick={() => setRuleFilter(isActive ? "all" : rule)}
                  className={`
                    p-3 rounded-lg border text-left transition-all text-xs
                    ${isActive
                      ? "ring-2 ring-primary border-primary bg-primary/5"
                      : hasErrors
                        ? "border-destructive/30 bg-destructive/5 hover:bg-destructive/10"
                        : "border-yellow-200 bg-yellow-50 hover:bg-yellow-100 dark:border-yellow-800 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/30"
                    }
                  `}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    {hasErrors ? (
                      <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400 shrink-0" />
                    )}
                    <span className="font-semibold truncate">{rule}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {violations.length} ocorrência{violations.length !== 1 ? "s" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Filters Bar ─────────────────────────────────── */}
      {!isFailureResult && result.brokerReports.length > 0 && (
        <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="h-4 w-4" />
            Filtros
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar corretor..."
                value={searchBroker}
                onChange={e => setSearchBroker(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>

            {/* Severity */}
            <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as SeverityFilter)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Severidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas severidades</SelectItem>
                <SelectItem value="error">❌ Apenas Erros</SelectItem>
                <SelectItem value="warning">⚠️ Apenas Avisos</SelectItem>
              </SelectContent>
            </Select>

            {/* Rule filter */}
            <Select value={ruleFilter} onValueChange={setRuleFilter}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Regra" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as regras</SelectItem>
                {uniqueRules.map(rule => (
                  <SelectItem key={rule} value={rule}>{rule}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* View mode toggle + actions */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex gap-1">
              <Button
                variant={viewMode === "broker" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setViewMode("broker")}
              >
                <LayoutList className="h-3 w-3" />
                Por Corretor
              </Button>
              <Button
                variant={viewMode === "rule" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setViewMode("rule")}
              >
                <Layers className="h-3 w-3" />
                Por Regra
              </Button>
              <Button
                variant={viewMode === "diagnostic" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setViewMode("diagnostic")}
              >
                <HelpCircle className="h-3 w-3" />
                Por que não alocou
              </Button>
              <Button
                variant={viewMode === "eligibility" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setViewMode("eligibility")}
              >
                <Link2 className="h-3 w-3" />
                Vínculos
              </Button>
            </div>
            <div className="flex gap-1">
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              )}
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={expandAll}>
                Expandir
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={collapseAll}>
                Recolher
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Content Area ────────────────────────────────── */}
      {!isFailureResult && result.brokerReports.length > 0 && (
        <ScrollArea className="h-[400px] pr-4">
          {viewMode === "broker" ? (
            <>
              {filteredGlobalViolations.length > 0 && (
                <GlobalViolationsSection violations={filteredGlobalViolations} />
              )}
              <BrokerView
                reports={filteredBrokerReports}
                expandedBrokers={expandedBrokers}
                toggleBroker={toggleBroker}
                severityFilter={severityFilter}
                ruleFilter={ruleFilter}
              />
            </>
          ) : viewMode === "rule" ? (
            <RuleView
              violationsByRule={filteredViolationsByRule}
              expandedRules={expandedRules}
              toggleRule={toggleRule}
            />
          ) : viewMode === "diagnostic" ? (
            <DiagnosticView
              diagnostics={brokerDiagnostics || []}
              eligibilityExclusions={eligibilityExclusions || []}
              expanded={expandedDiagnostics}
              toggleExpanded={(id) => {
                const next = new Set(expandedDiagnostics);
                if (next.has(id)) next.delete(id); else next.add(id);
                setExpandedDiagnostics(next);
              }}
              searchBroker={searchBroker}
            />
          ) : viewMode === "eligibility" ? (
            <EligibilityView
              eligibilityMap={brokerEligibilityMap || []}
              expanded={expandedDiagnostics}
              toggleExpanded={(id) => {
                const next = new Set(expandedDiagnostics);
                if (next.has(id)) next.delete(id); else next.add(id);
                setExpandedDiagnostics(next);
              }}
              searchBroker={searchBroker}
            />
          ) : null}
          {filteredBrokerReports.length === 0 && filteredGlobalViolations.length === 0 && filteredViolationsByRule.size === 0 && hasActiveFilters && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhum resultado para os filtros aplicados.
            </div>
          )}
        </ScrollArea>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// FAILURE SECTION
// ═══════════════════════════════════════════════════════════
function FailureSection({ violations }: { violations: PostValidationViolation[] }) {
  return (
    <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
      <h4 className="font-semibold text-destructive mb-2 flex items-center gap-2">
        <XCircle className="h-5 w-5" />
        Geração Falhou - Motivos:
      </h4>
      <p className="text-sm text-muted-foreground mb-3">
        A escala não pôde ser gerada porque as regras abaixo não podem ser satisfeitas.
      </p>
      <ul className="space-y-2 text-sm">
        {violations.map((v, i) => (
          <li key={i} className="flex items-start gap-2 p-2 bg-background rounded border">
            <span className="text-destructive mt-0.5">
              {v.severity === "error" ? <XCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            </span>
            <div>
              <div className="font-medium">{v.rule}</div>
              <div className="text-muted-foreground">
                <strong>{v.brokerName}</strong>: {v.details}
              </div>
              <RuleExplanationBadge rule={v.rule} />
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-sm">
        <strong className="text-yellow-800 dark:text-yellow-300">💡 Sugestões para resolver:</strong>
        <ul className="text-yellow-700 dark:text-yellow-400 mt-1 list-disc list-inside space-y-1">
          <li>Verificar se há corretores suficientes nos locais afetados</li>
          <li>Verificar a disponibilidade dos corretores</li>
          <li>Considerar adicionar mais corretores</li>
        </ul>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// GLOBAL VIOLATIONS SECTION
// ═══════════════════════════════════════════════════════════
function GlobalViolationsSection({ violations }: { violations: PostValidationViolation[] }) {
  return (
    <div className="mb-3 p-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
      <h4 className="font-semibold text-sm text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
        <Layers className="h-4 w-4" />
        Violações Gerais ({violations.length})
      </h4>
      <ul className="space-y-1.5">
        {violations.map((v, i) => (
          <li key={i} className="flex items-start gap-2 p-2 bg-background rounded border text-xs">
            <span className="mt-0.5 shrink-0">
              {v.severity === "error" ? (
                <XCircle className="h-3.5 w-3.5 text-destructive" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
              )}
            </span>
            <div>
              <div className="font-medium">{v.rule}</div>
              <div className="text-muted-foreground">{v.details}</div>
              <RuleExplanationBadge rule={v.rule} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// UNALLOCATED SECTION
// ═══════════════════════════════════════════════════════════
function formatDateBR(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function UnallocatedSection({ demands }: { demands: UnallocatedDemand[] }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between cursor-pointer group">
            <h4 className="font-semibold text-orange-800 dark:text-orange-300 flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Turnos Não Alocados ({demands.length})
            </h4>
            <ChevronDown className={`h-5 w-5 text-orange-600 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="space-y-2 text-sm mt-2">
            {demands.map((d, i) => (
              <li key={i} className="p-2 bg-background rounded border">
                <div className="flex items-center gap-2">
                  <span className="text-orange-600">⚠️</span>
                  <span>
                    <strong>{d.locationName}</strong> - {formatDateBR(d.date)} ({d.shift === "morning" ? "Manhã" : "Tarde"})
                  </span>
                </div>
                {d.reason && (
                  <div className="mt-1 ml-7 text-xs text-muted-foreground italic">
                    {d.reason}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ═══════════════════════════════════════════════════════════
// BROKER VIEW (improved)
// ═══════════════════════════════════════════════════════════
function BrokerView({
  reports,
  expandedBrokers,
  toggleBroker,
  severityFilter,
  ruleFilter,
}: {
  reports: BrokerValidationReport[];
  expandedBrokers: Set<string>;
  toggleBroker: (id: string) => void;
  severityFilter: SeverityFilter;
  ruleFilter: string;
}) {
  return (
    <div className="space-y-2">
      {reports.map(report => {
        const filteredViolations = report.violations.filter(v => {
          if (severityFilter !== "all" && v.severity !== severityFilter) return false;
          if (ruleFilter !== "all" && !v.rule.includes(ruleFilter)) return false;
          return true;
        });
        const hasErrors = filteredViolations.some(v => v.severity === "error");
        const hasWarnings = filteredViolations.some(v => v.severity === "warning");
        const isExpanded = expandedBrokers.has(report.brokerId);

        return (
          <Collapsible key={report.brokerId} open={isExpanded} onOpenChange={() => toggleBroker(report.brokerId)}>
            <CollapsibleTrigger asChild>
              <div
                className={`
                  flex items-center justify-between p-3 rounded-lg cursor-pointer
                  hover:bg-muted/50 transition-colors
                  ${hasErrors ? "bg-destructive/5 border border-destructive/20" :
                    hasWarnings ? "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800" :
                    "bg-muted/30 border border-transparent"}
                `}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  {hasErrors ? <XCircle className="h-5 w-5 text-destructive" /> :
                    hasWarnings ? <AlertTriangle className="h-5 w-5 text-yellow-600" /> :
                    <CheckCircle2 className="h-5 w-5 text-green-500" />}
                  <span className="font-medium">{report.brokerName}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline" className="text-xs">{report.externalCount} ext</Badge>
                  <Badge variant="outline" className="text-xs">{report.internalCount} int</Badge>
                  <Badge variant="outline" className="text-xs">{report.saturdayCount} sáb</Badge>
                  {filteredViolations.length > 0 && (
                    <Badge variant={hasErrors ? "destructive" : "secondary"} className="text-xs">
                      {filteredViolations.length} violação(ões)
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
                      <div key={i} className="flex items-center justify-between p-2 bg-muted/30 rounded text-xs">
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

                {/* Violations */}
                {filteredViolations.length > 0 && (
                  <div className="text-sm">
                    <h5 className="font-medium mb-2 text-destructive">Violações:</h5>
                    <ul className="space-y-1">
                      {filteredViolations.map((v, i) => (
                        <li key={i} className={`p-2 rounded text-xs ${v.severity === "error" ? "bg-destructive/10 text-destructive" : "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300"}`}>
                          <div className="font-medium">{v.rule}</div>
                          <div>{v.details}</div>
                          {v.dates && v.dates.length > 0 && (
                            <div className="text-muted-foreground mt-1">Datas: {v.dates.map(formatDateBR).join(", ")}</div>
                          )}
                          <RuleExplanationBadge rule={v.rule} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {filteredViolations.length === 0 && (
                  <div className="text-sm text-green-600 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Todas as regras foram respeitadas
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// RULE VIEW (new)
// ═══════════════════════════════════════════════════════════
function RuleView({
  violationsByRule,
  expandedRules,
  toggleRule,
}: {
  violationsByRule: Map<string, PostValidationViolation[]>;
  expandedRules: Set<string>;
  toggleRule: (rule: string) => void;
}) {
  const entries = Array.from(violationsByRule.entries()).sort((a, b) => {
    const aHasErrors = a[1].some(v => v.severity === "error");
    const bHasErrors = b[1].some(v => v.severity === "error");
    if (aHasErrors && !bHasErrors) return -1;
    if (!aHasErrors && bHasErrors) return 1;
    return b[1].length - a[1].length;
  });

  return (
    <div className="space-y-2">
      {entries.map(([rule, violations]) => {
        const isExpanded = expandedRules.has(rule);
        const hasErrors = violations.some(v => v.severity === "error");
        const explanation = getRuleExplanation(rule);

        return (
          <Collapsible key={rule} open={isExpanded} onOpenChange={() => toggleRule(rule)}>
            <CollapsibleTrigger asChild>
              <div
                className={`
                  flex items-center justify-between p-3 rounded-lg cursor-pointer
                  hover:bg-muted/50 transition-colors
                  ${hasErrors ? "bg-destructive/5 border border-destructive/20" : "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"}
                `}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  {hasErrors ? <XCircle className="h-5 w-5 text-destructive" /> : <AlertTriangle className="h-5 w-5 text-yellow-600" />}
                  <div>
                    <span className="font-medium">{rule}</span>
                    {explanation && (
                      <p className="text-xs text-muted-foreground mt-0.5">{explanation}</p>
                    )}
                  </div>
                </div>
                <Badge variant={hasErrors ? "destructive" : "secondary"} className="text-xs">
                  {violations.length} ocorrência{violations.length !== 1 ? "s" : ""}
                </Badge>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="ml-8 mt-2 space-y-1 pb-3">
                {violations.map((v, i) => (
                  <div key={i} className={`p-2 rounded text-xs ${v.severity === "error" ? "bg-destructive/10 text-destructive" : "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300"}`}>
                    <div className="font-medium">{v.brokerName}</div>
                    <div>{v.details}</div>
                    {v.dates && v.dates.length > 0 && (
                      <div className="text-muted-foreground mt-1">Datas: {v.dates.map(formatDateBR).join(", ")}</div>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DIAGNOSTIC VIEW: "Por que não alocou"
// ═══════════════════════════════════════════════════════════
function DiagnosticView({
  diagnostics,
  eligibilityExclusions,
  expanded,
  toggleExpanded,
  searchBroker
}: {
  diagnostics: BrokerAllocationDiagnostic[];
  eligibilityExclusions: EligibilityExclusion[];
  expanded: Set<string>;
  toggleExpanded: (id: string) => void;
  searchBroker: string;
}) {
  const filtered = diagnostics.filter(d => 
    !searchBroker || d.brokerName.toLowerCase().includes(searchBroker.toLowerCase())
  );

  const filteredExclusions = eligibilityExclusions.filter(e =>
    !searchBroker || e.brokerName.toLowerCase().includes(searchBroker.toLowerCase())
  );

  if (filtered.length === 0 && filteredExclusions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        {diagnostics.length === 0 && eligibilityExclusions.length === 0
          ? "Todos os corretores atingiram o target de 2 externos." 
          : "Nenhum corretor corresponde ao filtro."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Seção de Exclusões de Elegibilidade */}
      {filteredExclusions.length > 0 && (
        <div className="space-y-2">
          <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-sm">
            <div className="font-medium flex items-center gap-2 text-orange-800 dark:text-orange-300">
              <AlertTriangle className="h-4 w-4" />
              Exclusões de Elegibilidade: {filteredExclusions.length} corretor{filteredExclusions.length !== 1 ? "es" : ""} com demandas bloqueadas
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Corretores que foram excluídos de demandas ANTES da alocação. Isso indica problemas de configuração de disponibilidade (global, local ou dias da semana).
            </p>
          </div>

          {filteredExclusions.map(excl => {
            const isExpanded = expanded.has(`elig-${excl.brokerId}`);
            const reasonEntries = Object.entries(excl.exclusionsByReason).sort((a, b) => b[1] - a[1]);
            
            return (
              <Collapsible key={`elig-${excl.brokerId}`} open={isExpanded} onOpenChange={() => toggleExpanded(`elig-${excl.brokerId}`)}>
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-orange-50/50 dark:bg-orange-900/10 hover:bg-orange-100/50 dark:hover:bg-orange-900/20 transition-colors border border-orange-200/50 dark:border-orange-800/50">
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{excl.brokerName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {excl.eligibleCount}/{excl.totalDemandsInLinkedLocations} elegível
                      </Badge>
                      <Badge variant="destructive" className="text-xs">
                        {excl.excludedCount} excluído{excl.excludedCount !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-6 mt-2 space-y-3 pb-3">
                    {reasonEntries.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">Exclusões por motivo:</div>
                        {reasonEntries.map(([reason, count]) => (
                          <div key={reason} className="flex items-center justify-between p-2 rounded bg-background border text-xs">
                            <span className="text-orange-700 dark:text-orange-400">{humanizeExclusionReason(reason)}</span>
                            <Badge variant="outline" className="text-xs">{count}x</Badge>
                          </div>
                        ))}
                      </div>
                    )}

                    {excl.exclusionDetails.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">Detalhes ({excl.exclusionDetails.length} exclusões):</div>
                        {excl.exclusionDetails.slice(0, 20).map((det, i) => (
                          <div key={i} className="p-2 rounded bg-background border text-xs">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span className="font-medium">{det.locationName}</span>
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span>{formatDateBR(det.dateStr)}</span>
                              <Badge variant="outline" className="text-[10px]">{det.shift === "morning" ? "Manhã" : "Tarde"}</Badge>
                            </div>
                            <div className="mt-1 text-orange-600 dark:text-orange-400">{humanizeExclusionReason(det.reason)}</div>
                          </div>
                        ))}
                        {excl.exclusionDetails.length > 20 && (
                          <div className="text-xs text-muted-foreground text-center">
                            ... e mais {excl.exclusionDetails.length - 20} exclusões
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* Seção de Diagnóstico de Alocação (existente) */}
      {filtered.length > 0 && (
        <div className="space-y-2">
          <div className="p-3 rounded-lg bg-accent/50 border border-accent text-sm">
            <div className="font-medium flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              Corretores que não atingiram a meta de externos: {filtered.length} corretor{filtered.length !== 1 ? "es" : ""}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Para cada corretor abaixo, veja quantas vezes ele foi considerado para alocação e a regra que impediu.
            </p>
          </div>

          {filtered.map(diag => {
            const isExpanded = expanded.has(diag.brokerId);
            const ruleEntries = Object.entries(diag.rejectionsByRule).sort((a, b) => b[1] - a[1]);
            
            return (
              <Collapsible key={diag.brokerId} open={isExpanded} onOpenChange={() => toggleExpanded(diag.brokerId)}>
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{diag.brokerName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-xs">
                        {diag.finalExternalCount}/{diag.targetExternals} externos
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {diag.totalOpportunities} rejeições
                      </Badge>
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-6 mt-2 space-y-3 pb-3">
                    {ruleEntries.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">Rejeições por regra:</div>
                        {ruleEntries.map(([rule, count]) => (
                          <div key={rule} className="flex items-center justify-between p-2 rounded bg-background border text-xs">
                            <span>{rule}</span>
                            <Badge variant="outline" className="text-xs">{count}x</Badge>
                          </div>
                        ))}
                      </div>
                    )}

                    {diag.opportunities.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">Detalhes ({diag.opportunities.length} oportunidades):</div>
                        {diag.opportunities.slice(0, 20).map((opp, i) => (
                          <div key={i} className="p-2 rounded bg-background border text-xs">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span className="font-medium">{opp.locationName}</span>
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span>{formatDateBR(opp.dateStr)}</span>
                              <Badge variant="outline" className="text-[10px]">{opp.shift === "morning" ? "Manhã" : "Tarde"}</Badge>
                            </div>
                            <div className="mt-1 text-muted-foreground">{opp.reason}</div>
                          </div>
                        ))}
                        {diag.opportunities.length > 20 && (
                          <div className="text-xs text-muted-foreground text-center">
                            ... e mais {diag.opportunities.length - 20} oportunidades
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}



// ═══════════════════════════════════════════════════════════
// ELIGIBILITY VIEW — Vínculos Externos por Corretor
// ═══════════════════════════════════════════════════════════
function EligibilityView({ eligibilityMap, expanded, toggleExpanded, searchBroker }: {
  eligibilityMap: BrokerExternalEligibility[];
  expanded: Set<string>;
  toggleExpanded: (id: string) => void;
  searchBroker: string;
}) {
  const filtered = eligibilityMap.filter(b =>
    !searchBroker || b.brokerName.toLowerCase().includes(searchBroker.toLowerCase())
  );

  if (filtered.length === 0) {
    return <div className="text-sm text-muted-foreground p-4">Nenhum corretor com vínculos externos encontrado.</div>;
  }

  return (
    <div className="space-y-2">
      {filtered.map(broker => {
        const isUnder = broker.finalExternalCount < broker.targetExternals;
        const isExpanded = expanded.has(broker.brokerId);

        return (
          <Collapsible key={broker.brokerId} open={isExpanded} onOpenChange={() => toggleExpanded(broker.brokerId)}>
            <CollapsibleTrigger asChild>
              <div className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-accent/50 border ${isUnder ? "border-destructive/40 bg-destructive/5" : "border-border"}`}>
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium text-sm">{broker.brokerName}</span>
                <Badge variant={isUnder ? "destructive" : "secondary"} className="text-xs ml-auto">
                  {broker.finalExternalCount}/{broker.targetExternals} ext
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {broker.linkedLocationCount} locais
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {broker.totalEligibleDemands} elegíveis
                </Badge>
                {broker.totalExcludedDemands > 0 && (
                  <Badge variant="outline" className="text-xs text-amber-600">
                    {broker.totalExcludedDemands} excluídos
                  </Badge>
                )}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="ml-6 mt-1 space-y-2 pb-2">
                {broker.locations.map(loc => (
                  <div key={loc.locationId} className="border rounded p-2 bg-card">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm font-medium">{loc.locationName}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {loc.eligible.length} elegíveis
                      </Badge>
                      {loc.excluded.length > 0 && (
                        <Badge variant="outline" className="text-[10px] text-amber-600">
                          {loc.excluded.length} excluídos
                        </Badge>
                      )}
                    </div>
                    {loc.eligible.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {loc.eligible.map((e, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            {e.dateStr} {e.shift === "morning" ? "M" : "T"}
                          </span>
                        ))}
                      </div>
                    )}
                    {loc.excluded.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {loc.excluded.map((e, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800" title={e.reason}>
                            {e.dateStr} {e.shift === "morning" ? "M" : "T"} — {e.reason}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
function RuleExplanationBadge({ rule }: { rule: string }) {
  const explanation = getRuleExplanation(rule);
  if (!explanation) return null;

  return (
    <div className="mt-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-1.5 rounded border border-blue-100 dark:border-blue-800">
      💡 {explanation}
    </div>
  );
}
