import { Fragment, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Users, Heart, CheckSquare, Square, Lightbulb, ChevronDown, ChevronUp } from "lucide-react";
import { GeneratedVacation } from "@/lib/vacationGenerator";
import type { SugestaoMover, SugestoesConflito } from "@/lib/feriasConflitoSugestoes";

interface PreviewFeriasTableProps {
  vacations: GeneratedVacation[];
  selectedIds: Set<string>;
  onToggleSelection: (colaboradorId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  showConflicts?: boolean;
  onChangeDate?: (colaboradorId: string, periodo: 1 | 2, inicio: string) => void;
  onTogglePeriodoUnico?: (colaboradorId: string, on: boolean) => void;
  /** Sugestões de resolução por colaborador (aba Com conflitos) */
  suggestions?: Record<string, SugestoesConflito[]>;
  onApplySuggestion?: (colaboradorId: string, periodo: 1 | 2, inicio: string, fim: string) => void;
}

const formatDate = (dateStr: string) => {
  try {
    return format(parseISO(dateStr), "dd/MM", { locale: ptBR });
  } catch {
    return dateStr;
  }
};
const formatPeriodo = (inicio: string, fim: string) => `${formatDate(inicio)} - ${formatDate(fim)}`;

function BlocoSugestao({ s, onApply }: { s: SugestaoMover; onApply?: PreviewFeriasTableProps["onApplySuggestion"] }) {
  return (
    <div className="rounded-md border bg-background p-2 space-y-1.5">
      <div className="text-xs leading-snug">
        Manter <span className="font-medium">{s.manterNome}</span> e mover o{" "}
        <span className="font-medium">{s.moverPeriodo}º período de {s.moverNome}</span>
        {s.atualInicio && s.atualFim && <span className="text-muted-foreground"> (hoje {formatPeriodo(s.atualInicio, s.atualFim)})</span>} para:
      </div>
      {s.opcoes.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {s.opcoes.map((o) => (
            <Button
              key={o.inicio}
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={!onApply}
              onClick={() => onApply?.(s.moverId, s.moverPeriodo, o.inicio, o.fim)}
              title="Aplicar esta data"
            >
              {formatPeriodo(o.inicio, o.fim)}
              <span className="ml-1 text-muted-foreground">({o.deslocamento > 0 ? "+" : ""}{o.deslocamento} dias)</span>
            </Button>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">{s.bloqueio}</div>
      )}
    </div>
  );
}

export function PreviewFeriasTable({
  vacations,
  selectedIds,
  onToggleSelection,
  onSelectAll,
  onDeselectAll,
  showConflicts = false,
  onChangeDate,
  onTogglePeriodoUnico,
  suggestions,
  onApplySuggestion,
}: PreviewFeriasTableProps) {
  const [ocultas, setOcultas] = useState<Set<string>>(new Set());
  const colCount = 5 + (onTogglePeriodoUnico ? 1 : 0) + (showConflicts ? 1 : 0);

  const renderPeriodoCell = (v: GeneratedVacation, periodo: 1 | 2) => {
    if (periodo === 2 && v.periodo_unico) {
      return <span className="text-xs text-muted-foreground">Período único de 30 dias</span>;
    }
    const inicio = periodo === 1 ? v.quinzena1_inicio : v.quinzena2_inicio;
    const fim = periodo === 1 ? v.quinzena1_fim : v.quinzena2_fim;
    const emConflito = v.conflicts.some((c) => c.periodo === periodo && (c.tipo === "setor" || c.tipo === "substituto"));
    if (!onChangeDate) return formatPeriodo(inicio, fim);
    return (
      <div className={`space-y-1 rounded-md p-1 ${emConflito ? "bg-destructive/10 ring-1 ring-destructive/40" : ""}`}>
        <Input
          type="date"
          value={inicio || ""}
          onChange={(e) => onChangeDate(v.colaborador_id, periodo, e.target.value)}
          className="h-8 w-[132px] text-xs"
          aria-label={`Início do ${periodo}º período de ${v.colaborador_nome}`}
        />
        <div className={`text-xs ${emConflito ? "text-destructive font-medium" : "text-muted-foreground"}`}>
          {formatPeriodo(inicio, fim)} {emConflito ? "• em conflito" : "• ok"}
        </div>
      </div>
    );
  };

  const allSelected = vacations.every((v) => selectedIds.has(v.colaborador_id));

  const toggleOculta = (id: string) =>
    setOcultas((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <TooltipProvider>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={allSelected ? onDeselectAll : onSelectAll}>
            {allSelected ? (<><Square className="h-4 w-4 mr-1" />Desmarcar Todos</>) : (<><CheckSquare className="h-4 w-4 mr-1" />Selecionar Todos</>)}
          </Button>
          <span className="text-sm text-muted-foreground">
            {vacations.filter((v) => selectedIds.has(v.colaborador_id)).length} de {vacations.length} selecionados
          </span>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table className="[&_td]:px-2 [&_td]:py-2 [&_th]:px-2">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Colaborador</TableHead>
                <TableHead>1º Período</TableHead>
                <TableHead>2º Período</TableHead>
                <TableHead>Venda</TableHead>
                {onTogglePeriodoUnico && <TableHead>30 dias</TableHead>}
                {showConflicts && <TableHead>Conflitos</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {vacations.map((vacation) => {
                const sugs = suggestions?.[vacation.colaborador_id] || [];
                const mostrarSug = showConflicts && sugs.length > 0;
                const aberta = mostrarSug && !ocultas.has(vacation.colaborador_id);
                return (
                  <Fragment key={vacation.colaborador_id}>
                    <TableRow className={`${selectedIds.has(vacation.colaborador_id) ? "bg-primary/5" : ""} ${mostrarSug ? "border-b-0" : ""}`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(vacation.colaborador_id)}
                          onCheckedChange={() => onToggleSelection(vacation.colaborador_id)}
                        />
                      </TableCell>
                      <TableCell className="min-w-[150px]">
                        <div className="font-medium leading-snug">{vacation.colaborador_nome}</div>
                        <div className="text-xs text-muted-foreground">{vacation.setor_nome || "—"}</div>
                        {(vacation.familiar_match || vacation.is_excecao) && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {vacation.familiar_match && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="text-xs"><Heart className="h-3 w-3 mr-1" />Familiar</Badge>
                                </TooltipTrigger>
                                <TooltipContent><p>Período alinhado com familiar</p></TooltipContent>
                              </Tooltip>
                            )}
                            {vacation.is_excecao && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="text-xs border-destructive/40 text-destructive"><AlertTriangle className="h-3 w-3 mr-1" />Exceção</Badge>
                                </TooltipTrigger>
                                <TooltipContent><p>Será salva como exceção: {vacation.excecao_motivo}</p></TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{renderPeriodoCell(vacation, 1)}</TableCell>
                      <TableCell className="text-sm">
                        {renderPeriodoCell(vacation, 2)}
                        {vacation.preferencia_atendida != null && (
                          <div className={`text-xs mt-1 ${vacation.preferencia_atendida ? "text-muted-foreground" : "text-destructive"}`}>
                            {vacation.preferencia_atendida ? "Mês preferido atendido" : "Mês preferido não atendido"}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {vacation.vender_dias && vacation.dias_vendidos ? (
                          <Badge variant="outline" className="text-xs whitespace-nowrap">{vacation.dias_vendidos} dias</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      {onTogglePeriodoUnico && (
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            <Switch
                              checked={!!vacation.periodo_unico}
                              onCheckedChange={(on) => onTogglePeriodoUnico(vacation.colaborador_id, on)}
                              aria-label={`30 dias direto para ${vacation.colaborador_nome}`}
                            />
                          </div>
                        </TableCell>
                      )}
                      {showConflicts && (
                        <TableCell className="min-w-[200px]">
                          {vacation.conflicts.length === 0 && <Badge variant="outline" className="text-xs">Resolvido</Badge>}
                          <div className="mb-1 space-y-0.5">
                            {vacation.conflicts.filter((c) => c.periodo).map((c, i) => (
                              <div key={i} className="text-xs leading-snug">
                                <span className="font-medium">{c.periodo}º período</span> × {c.colaborador_nome || "colaborador"}
                                {c.outro_periodo && c.outro_inicio && c.outro_fim && (
                                  <span className="text-muted-foreground"> ({c.outro_periodo}º: {formatPeriodo(c.outro_inicio, c.outro_fim)}{c.ja_cadastrado ? ", já cadastrado" : ""})</span>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {vacation.conflicts.map((conflict, idx) => (
                              <Tooltip key={idx}>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="text-xs">
                                    {conflict.tipo === "setor" && <Users className="h-3 w-3 mr-1" />}
                                    {conflict.tipo === "familiar" && <Heart className="h-3 w-3 mr-1" />}
                                    {conflict.tipo === "mes_bloqueado" && <AlertTriangle className="h-3 w-3 mr-1" />}
                                    {conflict.tipo}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent><p>{conflict.descricao}</p></TooltipContent>
                              </Tooltip>
                            ))}
                          </div>
                          {mostrarSug && (
                            <Button type="button" variant="link" size="sm" className="h-6 px-0 text-xs" onClick={() => toggleOculta(vacation.colaborador_id)}>
                              {aberta ? <><ChevronUp className="h-3 w-3 mr-1" />Ocultar sugestões</> : <><ChevronDown className="h-3 w-3 mr-1" />Ver sugestões</>}
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                    {aberta && (
                      <TableRow className={selectedIds.has(vacation.colaborador_id) ? "bg-primary/5" : ""}>
                        <TableCell colSpan={colCount} className="pt-0">
                          <div className="rounded-md border border-primary/20 bg-primary/5 p-2 space-y-2">
                            <div className="flex items-center gap-1 text-xs font-medium text-primary">
                              <Lightbulb className="h-3.5 w-3.5" />
                              Sugestões para resolver (respeitam setor, substitutos, período concessivo, ordem dos períodos e meses permitidos)
                            </div>
                            {sugs.map((s) => (
                              <div key={`${s.periodo}-${s.outroId}-${s.outroPeriodo ?? ""}`} className="space-y-1">
                                <div className="text-xs text-muted-foreground">
                                  {s.periodo}º período de {vacation.colaborador_nome} × {s.outroPeriodo ? `${s.outroPeriodo}º período de ` : ""}{s.outroNome}
                                </div>
                                <div className="grid gap-2 md:grid-cols-2">
                                  <BlocoSugestao s={s.moverOutro} onApply={onApplySuggestion} />
                                  <BlocoSugestao s={s.moverEste} onApply={onApplySuggestion} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
}
