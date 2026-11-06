import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertTriangle, Users, Heart, CheckSquare, Square } from "lucide-react";
import { GeneratedVacation } from "@/lib/vacationGenerator";

interface PreviewFeriasTableProps {
  vacations: GeneratedVacation[];
  selectedIds: Set<string>;
  onToggleSelection: (colaboradorId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  showConflicts?: boolean;
  onChangeDate?: (colaboradorId: string, periodo: 1 | 2, inicio: string) => void;
}

export function PreviewFeriasTable({
  vacations,
  selectedIds,
  onToggleSelection,
  onSelectAll,
  onDeselectAll,
  showConflicts = false,
  onChangeDate,
}: PreviewFeriasTableProps) {
  const renderPeriodoCell = (v: GeneratedVacation, periodo: 1 | 2) => {
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
          className="h-8 w-[140px] text-xs"
          aria-label={`Início do ${periodo}º período de ${v.colaborador_nome}`}
        />
        <div className={`text-xs ${emConflito ? "text-destructive font-medium" : "text-muted-foreground"}`}>
          {formatPeriodo(inicio, fim)} {emConflito ? "• em conflito" : "• ok"}
        </div>
      </div>
    );
  };
  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd/MM", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const formatPeriodo = (inicio: string, fim: string) => {
    return `${formatDate(inicio)} - ${formatDate(fim)}`;
  };

  const allSelected = vacations.every((v) => selectedIds.has(v.colaborador_id));
  const noneSelected = vacations.every((v) => !selectedIds.has(v.colaborador_id));

  return (
    <div className="space-y-2">
      {/* Bulk actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={allSelected ? onDeselectAll : onSelectAll}
        >
          {allSelected ? (
            <>
              <Square className="h-4 w-4 mr-1" />
              Desmarcar Todos
            </>
          ) : (
            <>
              <CheckSquare className="h-4 w-4 mr-1" />
              Selecionar Todos
            </>
          )}
        </Button>
        <span className="text-sm text-muted-foreground">
          {vacations.filter((v) => selectedIds.has(v.colaborador_id)).length} de {vacations.length} selecionados
        </span>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Colaborador</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead>1º Período</TableHead>
              <TableHead>2º Período</TableHead>
              <TableHead>Venda</TableHead>
              {showConflicts && <TableHead>Conflitos</TableHead>}
              <TableHead>Info</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vacations.map((vacation) => (
              <TableRow
                key={vacation.colaborador_id}
                className={selectedIds.has(vacation.colaborador_id) ? "bg-primary/5" : ""}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(vacation.colaborador_id)}
                    onCheckedChange={() => onToggleSelection(vacation.colaborador_id)}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  {vacation.colaborador_nome}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {vacation.setor_nome || "—"}
                </TableCell>
                <TableCell className="text-sm">
                  {renderPeriodoCell(vacation, 1)}
                </TableCell>
                <TableCell className="text-sm">
                  {renderPeriodoCell(vacation, 2)}
                </TableCell>
                <TableCell>
                  {vacation.vender_dias && vacation.dias_vendidos ? (
                    <Badge variant="outline" className="text-xs">
                      {vacation.dias_vendidos} dias
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                {showConflicts && (
                  <TableCell>
                    {vacation.conflicts.length === 0 && (
                      <Badge variant="outline" className="text-xs">Resolvido</Badge>
                    )}
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
                    <TooltipProvider>
                      <div className="flex flex-wrap gap-1">
                        {vacation.conflicts.map((conflict, idx) => (
                          <Tooltip key={idx}>
                            <TooltipTrigger>
                              <Badge
                                variant="outline"
                                className={
                                  conflict.tipo === "setor"
                                    ? "bg-orange-500/10 text-orange-600 border-orange-500/20"
                                    : conflict.tipo === "familiar"
                                    ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                    : "bg-red-500/10 text-red-600 border-red-500/20"
                                }
                              >
                                {conflict.tipo === "setor" && <Users className="h-3 w-3 mr-1" />}
                                {conflict.tipo === "familiar" && <Heart className="h-3 w-3 mr-1" />}
                                {conflict.tipo === "mes_bloqueado" && <AlertTriangle className="h-3 w-3 mr-1" />}
                                {conflict.tipo}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{conflict.descricao}</p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </TooltipProvider>
                  </TableCell>
                )}
                <TableCell>
                  <div className="flex items-center gap-1">
                    {vacation.familiar_match && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="outline" className="bg-pink-500/10 text-pink-600 border-pink-500/20">
                              <Heart className="h-3 w-3" />
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Período alinhado com familiar</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {vacation.is_excecao && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                              <AlertTriangle className="h-3 w-3" />
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Será salva como exceção: {vacation.excecao_motivo}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
