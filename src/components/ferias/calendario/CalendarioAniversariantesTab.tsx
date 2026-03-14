import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, getMonth, getDate } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarDays, Briefcase } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

interface Colaborador {
  id: string;
  nome: string;
  data_nascimento: string;
  setor_titular_id: string;
  setor?: { id: string; nome: string } | null;
  cargo?: { nome: string } | null;
  status: string | null;
  is_broker?: boolean;
}

interface SalesBroker {
  id: string;
  name: string;
  birth_date: string | null;
}

interface CalendarioAniversariantesTabProps {
  colaboradores?: Colaborador[] | undefined;
}

const MONTHS_OPTIONS = [
  { value: "all", label: "Ano Completo" },
  { value: "0", label: "Janeiro" },
  { value: "1", label: "Fevereiro" },
  { value: "2", label: "Março" },
  { value: "3", label: "Abril" },
  { value: "4", label: "Maio" },
  { value: "5", label: "Junho" },
  { value: "6", label: "Julho" },
  { value: "7", label: "Agosto" },
  { value: "8", label: "Setembro" },
  { value: "9", label: "Outubro" },
  { value: "10", label: "Novembro" },
  { value: "11", label: "Dezembro" },
];

export function CalendarioAniversariantesTab({ colaboradores: externalColaboradores }: CalendarioAniversariantesTabProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [viewMode, setViewMode] = useState<string>("all");

  // Buscar colaboradores se não forem passados via props
  const { data: fetchedColaboradores } = useQuery({
    queryKey: ["ferias-colaboradores-calendario-tab"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_colaboradores")
        .select(`
          id,
          nome,
          data_nascimento,
          setor_titular_id,
          status,
          setor:ferias_setores!ferias_colaboradores_setor_titular_id_fkey(id, nome),
          cargo:ferias_cargos(nome)
        `)
        .eq("status", "ativo")
        .order("nome");

      if (error) throw error;
      return data as Colaborador[];
    },
    enabled: !externalColaboradores,
  });

  // Buscar corretores do sistema de vendas
  const { data: salesBrokers } = useQuery({
    queryKey: ["sales-brokers-calendario-tab"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_brokers")
        .select("id, name, birth_date")
        .eq("is_active", true)
        .not("birth_date", "is", null);
      if (error) throw error;
      return data as SalesBroker[];
    },
  });

  // Mesclar colaboradores e corretores
  const allPeople = useMemo(() => {
    const colabs: Colaborador[] = (externalColaboradores || fetchedColaboradores || []).map(c => ({ ...c, is_broker: false }));
    const brokers: Colaborador[] = (salesBrokers || [])
      .filter(b => b.birth_date)
      .map(b => ({
        id: `broker-${b.id}`,
        nome: b.name,
        data_nascimento: b.birth_date!,
        setor_titular_id: "",
        setor: { id: "corretores", nome: "Corretores" },
        cargo: null,
        status: "ativo",
        is_broker: true,
      }));
    return [...colabs, ...brokers];
  }, [externalColaboradores, fetchedColaboradores, salesBrokers]);

  // Map de aniversariantes por dia (key: "month-day")
  const aniversariantesPorDia = useMemo(() => {
    const map = new Map<string, Colaborador[]>();
    
    allPeople.forEach((col) => {
      const birthDate = parseISO(col.data_nascimento);
      const key = `${getMonth(birthDate)}-${getDate(birthDate)}`;
      
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(col);
    });
    
    return map;
  }, [allPeople]);

  const getAniversariantesNoDia = (date: Date): Colaborador[] => {
    const key = `${getMonth(date)}-${getDate(date)}`;
    return aniversariantesPorDia.get(key) || [];
  };

  const calcularIdade = (dataNascimento: string, referenceYear: number): number => {
    const nascimento = parseISO(dataNascimento);
    return referenceYear - nascimento.getFullYear();
  };

  // Dias que têm aniversário
  const birthdayDates = useMemo(() => {
    const dates: Date[] = [];
    const startMonth = viewMode === "all" ? 0 : parseInt(viewMode);
    const endMonth = viewMode === "all" ? 11 : parseInt(viewMode);
    
    for (let month = startMonth; month <= endMonth; month++) {
      allPeople.forEach((col) => {
        const birthDate = parseISO(col.data_nascimento);
        if (getMonth(birthDate) === month) {
          dates.push(new Date(selectedYear, month, getDate(birthDate)));
        }
      });
    }
    
    return dates;
  }, [allPeople, selectedYear, viewMode]);

  // Componente de dia customizado com HoverCard
  const DayWithTooltip = ({ date, displayMonth }: { date: Date; displayMonth: Date }) => {
    const aniversariantes = getAniversariantesNoDia(date);
    const isOutsideMonth = getMonth(date) !== getMonth(displayMonth);
    const dayNumber = getDate(date);
    const hasBirthday = aniversariantes.length > 0;
    const isToday = 
      getDate(date) === getDate(new Date()) && 
      getMonth(date) === getMonth(new Date()) &&
      selectedYear === new Date().getFullYear();

    const dayButton = (
      <button
        type="button"
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "h-7 w-7 p-0 font-normal text-xs",
          isOutsideMonth && "text-muted-foreground opacity-50",
          isToday && !hasBirthday && "bg-accent text-accent-foreground",
          hasBirthday && "bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full"
        )}
      >
        {dayNumber}
      </button>
    );

    if (!hasBirthday) {
      return dayButton;
    }

    return (
      <HoverCard openDelay={100} closeDelay={50}>
        <HoverCardTrigger asChild>
          {dayButton}
        </HoverCardTrigger>
        <HoverCardContent className="w-80 p-3" side="top">
          <div className="space-y-2">
            <p className="font-semibold text-sm border-b pb-2">
              {format(date, "dd 'de' MMMM", { locale: ptBR })}
            </p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {aniversariantes.map((col) => (
                <div key={col.id} className="flex items-start gap-2 text-sm">
                  <span>🎂</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium flex items-center gap-1 flex-wrap">
                      <span className="break-words">{col.nome}</span>
                      {col.is_broker && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-primary/10 text-primary border-primary/30 flex-shrink-0">
                          <Briefcase className="h-2 w-2 mr-0.5" />
                          Corretor
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {calcularIdade(col.data_nascimento, selectedYear)} anos
                      {col.setor?.nome && ` • ${col.setor.nome}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  };

  const yearOptions = getYearOptions(2, 8);

  const calendarMonth = viewMode === "all" 
    ? new Date(selectedYear, 0, 1)
    : new Date(selectedYear, parseInt(viewMode), 1);

  const numberOfMonths = viewMode === "all" ? 12 : 1;

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/30 rounded-lg border">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Ano:</span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSelectedYear(y => y - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[100px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSelectedYear(y => y + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Visualização:</span>
          <Select value={viewMode} onValueChange={setViewMode}>
            <SelectTrigger className="w-[160px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS_OPTIONS.map((month) => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 ml-auto text-sm text-muted-foreground">
          <div className="h-4 w-4 rounded-full bg-primary" />
          <span>Dia com aniversário</span>
        </div>
      </div>

      {/* Calendário */}
      <div className={cn(
        "overflow-x-auto pb-4",
        viewMode === "all" && "border rounded-lg p-4 bg-card"
      )}>
        <DayPicker
          mode="single"
          month={calendarMonth}
          numberOfMonths={numberOfMonths}
          pagedNavigation={false}
          showOutsideDays={false}
          locale={ptBR}
          className={cn(
            viewMode === "all" && "flex flex-wrap justify-center gap-4"
          )}
          classNames={{
            months: viewMode === "all" 
              ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" 
              : "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
            month: "space-y-2",
            caption: "flex justify-center pt-1 relative items-center",
            caption_label: "text-sm font-medium",
            nav: "hidden",
            table: "w-full border-collapse",
            head_row: "flex",
            head_cell: "text-muted-foreground w-7 font-normal text-[0.7rem]",
            row: "flex w-full mt-0.5",
            cell: "h-7 w-7 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
            day: cn(buttonVariants({ variant: "ghost" }), "h-7 w-7 p-0 font-normal text-xs"),
            day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
            day_today: "bg-accent text-accent-foreground",
            day_outside: "text-muted-foreground opacity-50",
            day_disabled: "text-muted-foreground opacity-50",
            day_hidden: "invisible",
          }}
          components={{
            Day: DayWithTooltip,
          }}
          modifiers={{
            birthday: birthdayDates,
          }}
        />
      </div>

      {/* Legenda e estatísticas */}
      <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground p-3 bg-muted/20 rounded-lg">
        <div className="flex items-center gap-4">
          <span>
            <strong className="text-foreground">{allPeople.length}</strong> pessoas cadastradas
          </span>
          <span>•</span>
          <span>
            <strong className="text-foreground">{birthdayDates.length}</strong> aniversários 
            {viewMode === "all" ? " no ano" : ` em ${MONTHS_OPTIONS.find(m => m.value === viewMode)?.label}`}
          </span>
        </div>
        <p className="text-xs">
          Passe o mouse sobre os dias destacados para ver os aniversariantes
        </p>
      </div>
    </div>
  );
}

export default CalendarioAniversariantesTab;
