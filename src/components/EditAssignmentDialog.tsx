import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeText } from "@/lib/textUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, MapPin, ArrowRight, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface Assignment {
  id?: string;
  broker_id: string;
  location_id: string;
  assignment_date: string;
  shift_type: string;
  start_time: string;
  end_time: string;
  broker?: { id: string; name: string; creci: string };
  location?: { id: string; name: string; location_type: string; city: string };
}

interface EditAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: Assignment | null;
  allAssignments: Assignment[];
  generatedScheduleId: string;
  onSave: (updates: { assignmentId: string; newLocationId: string; conflictAssignmentId?: string }) => void;
}

export function EditAssignmentDialog({
  open,
  onOpenChange,
  assignment,
  allAssignments,
  generatedScheduleId,
  onSave,
}: EditAssignmentDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [conflictAssignment, setConflictAssignment] = useState<Assignment | null>(null);
  const [eligibilityWarningOpen, setEligibilityWarningOpen] = useState(false);
  const [pendingLocationId, setPendingLocationId] = useState<string | null>(null);
  const [pendingLocationName, setPendingLocationName] = useState<string>("");

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSearchTerm("");
      setSelectedLocationId(null);
      setConflictAssignment(null);
      setPendingLocationId(null);
    }
  }, [open]);

  // Fetch broker's eligible locations
  const { data: brokerLocationIds } = useQuery({
    queryKey: ["broker-location-ids", assignment?.broker_id],
    queryFn: async () => {
      if (!assignment?.broker_id) return [];
      const { data, error } = await supabase
        .from("location_brokers")
        .select("location_id")
        .eq("broker_id", assignment.broker_id);
      if (error) throw error;
      return data?.map((lb: any) => lb.location_id) || [];
    },
    enabled: open && !!assignment?.broker_id,
  });

  // Fetch available locations for this day/shift
  const { data: availableLocations, isLoading } = useQuery({
    queryKey: ["available-locations-for-edit", assignment?.assignment_date, assignment?.shift_type],
    queryFn: async () => {
      if (!assignment) return [];

      const dateStr = assignment.assignment_date;
      const dayOfWeekNum = new Date(dateStr + "T00:00:00").getDay();
      const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const dayOfWeek = weekdays[dayOfWeekNum];

      const { data: locations, error } = await supabase
        .from("locations")
        .select(`
          id, name, location_type, city,
          location_periods (
            id, start_date, end_date,
            period_day_configs (weekday, has_morning, has_afternoon)
          )
        `)
        .eq("is_active", true);

      if (error) throw error;

      const { data: specificConfigs } = await supabase
        .from("period_specific_day_configs")
        .select("*")
        .eq("specific_date", dateStr);

      const validLocations = locations?.filter((loc: any) => {
        const specificConfig = specificConfigs?.find((sc: any) => {
          const period = loc.location_periods?.find((p: any) => p.id === sc.period_id);
          return period !== undefined;
        });

        if (specificConfig) {
          return assignment.shift_type === "morning" 
            ? specificConfig.has_morning 
            : specificConfig.has_afternoon;
        }

        const date = new Date(dateStr + "T00:00:00");
        const period = loc.location_periods?.find((p: any) => {
          const start = new Date(p.start_date + "T00:00:00");
          const end = new Date(p.end_date + "T00:00:00");
          return date >= start && date <= end;
        });

        if (!period) return false;

        const dayConfig = period.period_day_configs?.find((dc: any) => dc.weekday === dayOfWeek);
        if (!dayConfig) return false;

        return assignment.shift_type === "morning" 
          ? dayConfig.has_morning 
          : dayConfig.has_afternoon;
      });

      return validLocations || [];
    },
    enabled: open && !!assignment,
  });

  const normalizedSearch = normalizeText(searchTerm);
  const filteredLocations = availableLocations?.filter((loc: any) =>
    normalizeText(loc.name).includes(normalizedSearch) ||
    normalizeText(loc.city || "").includes(normalizedSearch)
  );

  const isBrokerEligible = (locationId: string): boolean => {
    if (!brokerLocationIds) return true; // Still loading, assume eligible
    return brokerLocationIds.includes(locationId);
  };

  const proceedWithSave = (locationId: string) => {
    if (!assignment) return;

    const conflict = allAssignments.find(
      (a) =>
        a.location_id === locationId &&
        a.assignment_date === assignment.assignment_date &&
        a.shift_type === assignment.shift_type &&
        a.id !== assignment.id
    );

    if (conflict) {
      setSelectedLocationId(locationId);
      setConflictAssignment(conflict);
      setConflictDialogOpen(true);
    } else {
      if (assignment.id) {
        onSave({ assignmentId: assignment.id, newLocationId: locationId });
        onOpenChange(false);
      }
    }
  };

  const handleLocationSelect = (locationId: string, locationName: string) => {
    if (!assignment) return;

    // Check eligibility for external locations
    const loc = availableLocations?.find((l: any) => l.id === locationId);
    if (loc?.location_type === "external" && !isBrokerEligible(locationId)) {
      setPendingLocationId(locationId);
      setPendingLocationName(locationName);
      setEligibilityWarningOpen(true);
      return;
    }

    proceedWithSave(locationId);
  };

  const handleEligibilityConfirm = () => {
    setEligibilityWarningOpen(false);
    if (pendingLocationId) {
      proceedWithSave(pendingLocationId);
    }
  };

  const handleConfirmSwap = () => {
    if (!assignment?.id || !selectedLocationId || !conflictAssignment) return;

    onSave({
      assignmentId: assignment.id,
      newLocationId: selectedLocationId,
      conflictAssignmentId: conflictAssignment.id,
    });

    setConflictDialogOpen(false);
    onOpenChange(false);
  };

  if (!assignment) return null;

  const dateFormatted = format(new Date(assignment.assignment_date + "T00:00:00"), "dd/MM/yyyy");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Alocação</DialogTitle>
            <DialogDescription>
              Alterar o local de {assignment.broker?.name} em {dateFormatted} ({assignment.shift_type === "morning" ? "Manhã" : "Tarde"})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">Alocação Atual:</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={assignment.location?.location_type === "external" ? "default" : "secondary"}>
                  {assignment.location?.location_type === "external" ? "Externo" : "Interno"}
                </Badge>
                <span className="font-medium">{assignment.location?.name}</span>
              </div>
            </div>

            <div>
              <Label htmlFor="search-location">Buscar Local</Label>
              <Input
                id="search-location"
                placeholder="Nome ou cidade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div>
              <Label>Selecione o Novo Local</Label>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ScrollArea className="h-[250px] mt-2 border rounded-md">
                  <div className="p-2 space-y-1">
                    {filteredLocations?.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum local encontrado
                      </p>
                    ) : (
                      filteredLocations?.map((loc: any) => {
                        const isCurrent = loc.id === assignment.location_id;
                        const hasConflict = allAssignments.some(
                          (a) =>
                            a.location_id === loc.id &&
                            a.assignment_date === assignment.assignment_date &&
                            a.shift_type === assignment.shift_type &&
                            a.id !== assignment.id
                        );
                        const notEligible = loc.location_type === "external" && !isBrokerEligible(loc.id);

                        return (
                          <button
                            key={loc.id}
                            disabled={isCurrent}
                            onClick={() => handleLocationSelect(loc.id, loc.name)}
                            className={`w-full p-3 text-left rounded-md transition-colors ${
                              isCurrent
                                ? "bg-muted opacity-50 cursor-not-allowed"
                                : hasConflict
                                ? "hover:bg-amber-50 dark:hover:bg-amber-950 border border-amber-200 dark:border-amber-800"
                                : notEligible
                                ? "hover:bg-orange-50 dark:hover:bg-orange-950 border border-orange-200 dark:border-orange-800"
                                : "hover:bg-accent"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{loc.name}</span>
                                  <Badge variant={loc.location_type === "external" ? "default" : "secondary"} className="text-xs">
                                    {loc.location_type === "external" ? "Ext" : "Int"}
                                  </Badge>
                                </div>
                                {loc.city && (
                                  <p className="text-xs text-muted-foreground ml-6">{loc.city}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                {notEligible && (
                                  <Badge variant="outline" className="text-orange-600 border-orange-400 text-xs">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Não vinculado
                                  </Badge>
                                )}
                                {hasConflict && (
                                  <Badge variant="outline" className="text-amber-600 border-amber-400">
                                    Ocupado
                                  </Badge>
                                )}
                                {isCurrent && (
                                  <Badge variant="secondary">Atual</Badge>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Eligibility warning dialog */}
      <AlertDialog open={eligibilityWarningOpen} onOpenChange={setEligibilityWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Corretor Não Vinculado
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  O corretor <strong className="text-foreground">{assignment.broker?.name}</strong> não está configurado como disponível para o local <strong className="text-foreground">{pendingLocationName}</strong>.
                </p>
                <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-700 dark:text-amber-400 text-sm">
                    Esta alocação será marcada como manual. Deseja continuar mesmo assim?
                  </AlertDescription>
                </Alert>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEligibilityConfirm}>
              Prosseguir Mesmo Assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Conflict confirmation dialog */}
      <AlertDialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conflito Detectado</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                O corretor <strong>{conflictAssignment?.broker?.name}</strong> já está alocado neste local/turno.
              </p>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium">{assignment.broker?.name}</p>
                  <p className="text-xs text-muted-foreground">{assignment.location?.name}</p>
                </div>
                <ArrowRight className="h-4 w-4" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{conflictAssignment?.broker?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {availableLocations?.find((l: any) => l.id === selectedLocationId)?.name}
                  </p>
                </div>
              </div>
              <p>Deseja trocar os corretores de lugar?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSwap}>
              Sim, Trocar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
