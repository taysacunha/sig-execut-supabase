import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachWeekendOfInterval, isSaturday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Loader2, Grid3X3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SetoresSabadosTableProps {
  year: number;
  month: number;
}

interface Setor {
  id: string;
  nome: string;
}

interface Colaborador {
  nome: string;
  nome_exibicao: string | null;
  setor_titular_id: string;
  familiar_id: string | null;
  unidade?: { nome: string } | null;
}

interface Folga {
  id: string;
  data_sabado: string;
  colaborador_id: string;
  is_excecao: boolean;
  colaborador?: Colaborador | null;
}

// Função para extrair nome de exibição
const getDisplayName = (colaborador: Colaborador | null | undefined): string => {
  if (!colaborador) return "—";
  if (colaborador.nome_exibicao) return colaborador.nome_exibicao;
  const parts = colaborador.nome.trim().split(" ");
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
};

export function SetoresSabadosTable({ year, month }: SetoresSabadosTableProps) {
  // Get saturdays of the month
  const saturdaysOfMonth = useMemo(() => {
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(new Date(year, month - 1));
    const weekends = eachWeekendOfInterval({ start, end });
    return weekends.filter(d => isSaturday(d)).map(d => format(d, "yyyy-MM-dd"));
  }, [year, month]);

  // Query setores
  const { data: setores = [] } = useQuery({
    queryKey: ["ferias-setores-table"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_setores")
        .select("id, nome")
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      return data as Setor[];
    },
  });

  // Query chefes de setor
  const { data: setorChefes = [] } = useQuery({
    queryKey: ["ferias-setor-chefes-table"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_setor_chefes")
        .select("setor_id, colaborador_id");
      if (error) throw error;
      return data as { setor_id: string; colaborador_id: string }[];
    },
  });

  // Query folgas do mês
  const { data: folgas = [], isLoading } = useQuery({
    queryKey: ["ferias-folgas-table", year, month],
    queryFn: async () => {
      const monthStart = format(startOfMonth(new Date(year, month - 1)), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(new Date(year, month - 1)), "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("ferias_folgas")
        .select("id, data_sabado, colaborador_id, is_excecao, colaborador:ferias_colaboradores!ferias_folgas_colaborador_id_fkey(nome, nome_exibicao, setor_titular_id, familiar_id, unidade:ferias_unidades(nome))")
        .gte("data_sabado", monthStart)
        .lte("data_sabado", monthEnd);

      if (error) throw error;
      return data as Folga[];
    },
  });

  // Identificar chefes
  const chefeIds = useMemo(() => {
    return new Set(setorChefes.map(sc => sc.colaborador_id));
  }, [setorChefes]);

  // Identificar pares familiares que folgam juntos
  const familiarPairsOnSameSaturday = useMemo(() => {
    const pairs = new Set<string>();
    
    folgas.forEach(folga => {
      if (!folga.colaborador?.familiar_id) return;
      
      const familiarFolga = folgas.find(
        f => f.colaborador_id === folga.colaborador?.familiar_id && 
             f.data_sabado === folga.data_sabado
      );
      
      if (familiarFolga) {
        pairs.add(folga.colaborador_id);
        pairs.add(folga.colaborador.familiar_id);
      }
    });
    
    return pairs;
  }, [folgas]);

  // Build matrix: setor x saturday -> list of colaboradores
  const matrix = useMemo(() => {
    const result: Record<string, Record<string, Folga[]>> = {};

    setores.forEach(setor => {
      result[setor.id] = {};
      saturdaysOfMonth.forEach(sat => {
        result[setor.id][sat] = [];
      });
    });

    folgas.forEach(folga => {
      const setorId = folga.colaborador?.setor_titular_id;
      if (setorId && result[setorId] && result[setorId][folga.data_sabado]) {
        result[setorId][folga.data_sabado].push(folga);
      }
    });

    return result;
  }, [setores, saturdaysOfMonth, folgas]);

  // Contagem por sábado para identificar distribuição
  const countBySaturday = useMemo(() => {
    const counts: Record<string, number> = {};
    saturdaysOfMonth.forEach(sat => {
      counts[sat] = folgas.filter(f => f.data_sabado === sat).length;
    });
    return counts;
  }, [folgas, saturdaysOfMonth]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Grid3X3 className="h-5 w-5" />
          Mapa de Folgas por Setor
        </CardTitle>
        <CardDescription>
          Visualização das folgas de {format(new Date(year, month - 1), "MMMM yyyy", { locale: ptBR })} organizadas por setor e sábado
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead className="sticky left-0 bg-muted min-w-[180px] z-10 font-bold border-r-2 border-border">
                    Setor
                  </TableHead>
                  {saturdaysOfMonth.map((sat, idx) => (
                    <TableHead 
                      key={sat} 
                      className={cn(
                        "text-center min-w-[140px] font-bold border-r border-border",
                        idx % 2 === 0 ? "bg-muted" : "bg-muted/70"
                      )}
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-foreground">
                          {format(new Date(sat + "T12:00:00"), "dd/MM", { locale: ptBR })}
                        </span>
                        <span className="text-xs text-muted-foreground font-normal capitalize">
                          {format(new Date(sat + "T12:00:00"), "EEEE", { locale: ptBR })}
                        </span>
                        <Badge 
                          variant="secondary" 
                          className={cn(
                            "text-xs mt-1",
                            countBySaturday[sat] === 0 && "bg-destructive/10 text-destructive",
                            countBySaturday[sat] > 0 && countBySaturday[sat] < 3 && "bg-amber-100 text-amber-800"
                          )}
                        >
                          {countBySaturday[sat]} folga{countBySaturday[sat] !== 1 && "s"}
                        </Badge>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {setores.map((setor, idx) => (
                  <TableRow 
                    key={setor.id}
                    className={cn(
                      "border-b border-border",
                      idx % 2 === 0 ? "bg-background" : "bg-muted/30"
                    )}
                  >
                    <TableCell className={cn(
                      "sticky left-0 font-semibold z-10 border-r-2 border-border",
                      idx % 2 === 0 ? "bg-background" : "bg-muted/30"
                    )}>
                      {setor.nome}
                    </TableCell>
                    {saturdaysOfMonth.map((sat, colIdx) => {
                      const folgasNaCelula = matrix[setor.id]?.[sat] || [];
                      return (
                        <TableCell 
                          key={sat} 
                          className={cn(
                            "text-center p-2 border-r border-border/50",
                            colIdx % 2 === 0 ? "bg-background/50" : "bg-muted/20"
                          )}
                        >
                          {folgasNaCelula.length > 0 ? (
                            <div className="flex flex-col gap-1.5">
                              {folgasNaCelula.map(folga => {
                                const isFamiliar = familiarPairsOnSameSaturday.has(folga.colaborador_id);
                                const isChefe = chefeIds.has(folga.colaborador_id);
                                const unidadeNome = folga.colaborador?.unidade?.nome;
                                return (
                                  <div key={folga.id} className="flex flex-col items-center gap-0.5">
                                    <Badge
                                      variant={folga.is_excecao ? "outline" : "secondary"}
                                      className={cn(
                                        "text-xs truncate max-w-[120px] justify-center py-1",
                                        isFamiliar && "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-700",
                                        isChefe && !isFamiliar && "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700",
                                        folga.is_excecao && !isFamiliar && !isChefe && "border-amber-400 text-amber-700 bg-amber-50"
                                      )}
                                      title={`${folga.colaborador?.nome}${unidadeNome ? ` - ${unidadeNome}` : ""}${isFamiliar ? " (Familiar folgando junto)" : ""}${isChefe ? " (Chefe de setor)" : ""}${folga.is_excecao ? " (Ajuste manual)" : ""}`}
                                    >
                                      {getDisplayName(folga.colaborador)}
                                    </Badge>
                                    {unidadeNome && (
                                      <span className="text-[10px] text-muted-foreground leading-tight truncate max-w-[120px]">
                                        {unidadeNome}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/40 text-sm">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Legenda - sem ícones */}
        <div className="flex flex-wrap items-center gap-6 mt-4 pt-4 border-t text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">Nome</Badge>
            <span>Folga normal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-sky-100 border border-sky-300" />
            <span>Par familiar junto</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-violet-100 border border-violet-300" />
            <span>Chefe de setor</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-amber-50 border border-amber-400" />
            <span>Ajuste manual</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
