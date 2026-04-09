import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getBrokersFromInternalShift, getAvailableBrokersForShift } from "@/lib/scheduleGenerator";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, ArrowRight, User, UserCheck, AlertTriangle } from "lucide-react";
import { normalizeText } from "@/lib/textUtils";
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

interface InternalAssignment {
  id: string;
  broker_id: string;
  location_id: string;
  broker: {
    id: string;
    name: string;
    creci: string;
  };
  location: {
    id: string;
    name: string;
    location_type: string;
  };
}

interface AvailableBroker {
  broker: {
    id: string;
    name: string;
    creci: string;
  };
  isAvailable: true;
}

interface ScheduleReplacementDialogProps {
  generatedScheduleId: string;
  locationId: string;
  date: string;
  shiftType: "morning" | "afternoon";
  currentBrokerId?: string;
  currentBrokerName?: string;
  onSelect: (selection: InternalAssignment | AvailableBroker) => void;
}

export function ScheduleReplacementDialog({
  generatedScheduleId,
  locationId,
  date,
  shiftType,
  currentBrokerId,
  currentBrokerName,
  onSelect,
}: ScheduleReplacementDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [pendingSelection, setPendingSelection] = useState<InternalAssignment | AvailableBroker | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  // Query 1: Corretores em plantão interno (para swap)
  const { data: internalAssignments, isLoading: isLoadingInternal } = useQuery({
    queryKey: ["internal-shift-brokers", generatedScheduleId, date, shiftType],
    queryFn: () => getBrokersFromInternalShift(generatedScheduleId, date, shiftType),
    enabled: !!generatedScheduleId,
  });

  // Query 2: Corretores disponíveis sem alocação
  const { data: availableBrokers, isLoading: isLoadingAvailable } = useQuery({
    queryKey: ["available-brokers-for-shift", locationId, date, shiftType],
    queryFn: () => getAvailableBrokersForShift(locationId, date, shiftType),
    enabled: !!locationId,
  });

  // Query 3: Broker eligibility for the target location
  const { data: eligibleBrokerIds } = useQuery({
    queryKey: ["location-broker-ids", locationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("location_brokers")
        .select("broker_id")
        .eq("location_id", locationId);
      if (error) throw error;
      return data?.map((lb: any) => lb.broker_id) || [];
    },
    enabled: !!locationId,
  });

  const isLoading = isLoadingInternal || isLoadingAvailable;

  const isBrokerEligible = (brokerId: string): boolean => {
    if (!eligibleBrokerIds) return true;
    return eligibleBrokerIds.includes(brokerId);
  };

  // Handler ao clicar em um corretor
  const handleBrokerClick = (selection: InternalAssignment | AvailableBroker) => {
    setPendingSelection(selection);
    setShowConfirmation(true);
  };

  // Handler de confirmação
  const handleConfirm = () => {
    if (pendingSelection) {
      onSelect(pendingSelection);
    }
    setShowConfirmation(false);
    setPendingSelection(null);
  };

  // Handler de cancelamento
  const handleCancel = () => {
    setShowConfirmation(false);
    setPendingSelection(null);
  };

  // Obter nome e id do corretor selecionado
  const getSelectedBrokerName = (): string => {
    if (!pendingSelection) return "";
    if ("isAvailable" in pendingSelection) {
      return pendingSelection.broker?.name || "";
    }
    return (pendingSelection as InternalAssignment).broker?.name || "";
  };

  const getSelectedBrokerId = (): string => {
    if (!pendingSelection) return "";
    if ("isAvailable" in pendingSelection) {
      return pendingSelection.broker?.id || "";
    }
    return (pendingSelection as InternalAssignment).broker?.id || "";
  };

  // Verificar se é corretor disponível
  const isAvailableBroker = (selection: InternalAssignment | AvailableBroker | null): boolean => {
    if (!selection) return false;
    return "isAvailable" in selection && selection.isAvailable === true;
  };

  if (isLoading) {
    return <div className="p-4 text-center">Carregando opções de substituição...</div>;
  }

  // Filtrar para não mostrar o corretor atual
  const filteredInternalBrokers = (internalAssignments as InternalAssignment[] || []).filter(
    (a) => a.broker_id !== currentBrokerId
  );

  const filteredAvailableBrokers = (availableBrokers as AvailableBroker[] || []).filter(
    (a) => a.broker?.id !== currentBrokerId
  );

  // Filtrar por termo de busca
  const normalizedSearch = normalizeText(searchTerm);
  
  const searchedInternalBrokers = filteredInternalBrokers.filter((a) =>
    normalizeText(a.broker?.name || "").includes(normalizedSearch) ||
    normalizeText(a.broker?.creci || "").includes(normalizedSearch) ||
    normalizeText(a.location?.name || "").includes(normalizedSearch)
  );

  const searchedAvailableBrokers = filteredAvailableBrokers.filter((a) =>
    normalizeText(a.broker?.name || "").includes(normalizedSearch) ||
    normalizeText(a.broker?.creci || "").includes(normalizedSearch)
  );

  const dateFormatted = new Date(date + "T00:00:00").toLocaleDateString("pt-BR");
  const hasNoOptions = searchedInternalBrokers.length === 0 && searchedAvailableBrokers.length === 0;
  const hasNoResults = hasNoOptions && searchTerm.length > 0;

  // Check eligibility for the pending selection
  const pendingBrokerId = getSelectedBrokerId();
  const pendingNotEligible = pendingBrokerId ? !isBrokerEligible(pendingBrokerId) : false;

  return (
    <>
      <div className="space-y-4 min-w-0">
        <div className="p-3 bg-muted rounded-lg space-y-2">
          <p className="text-sm font-medium">Substituição de Plantão Externo</p>
          <p className="text-xs text-muted-foreground">
            Corretor atual: <strong>{currentBrokerName || "N/A"}</strong>
          </p>
          <p className="text-xs text-muted-foreground">
            Data: <strong>{dateFormatted}</strong> | Turno: <strong>{shiftType === "morning" ? "Manhã" : "Tarde"}</strong>
          </p>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Selecione um corretor para assumir este plantão. Corretores em <strong>plantão interno</strong> farão swap. 
            Corretores <strong>disponíveis</strong> assumirão diretamente.
          </AlertDescription>
        </Alert>

        {/* Campo de busca */}
        <Input
          placeholder="Buscar corretor por nome, CRECI ou local..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full"
        />

        {hasNoOptions && !searchTerm ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Nenhum corretor disponível para substituição neste dia/turno.
            </AlertDescription>
          </Alert>
        ) : hasNoResults ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Nenhum corretor encontrado com o termo "{searchTerm}".
            </AlertDescription>
          </Alert>
        ) : (
          <ScrollArea className="h-72">
            <div className="space-y-4">
              {/* Seção: Corretores Disponíveis (sem alocação) */}
              {searchedAvailableBrokers.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <UserCheck className="h-4 w-4" />
                    <span>Corretores Disponíveis ({searchedAvailableBrokers.length})</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Sem alocação atual - assumirão o plantão diretamente
                  </p>
                  {searchedAvailableBrokers.map((item) => (
                    <div
                      key={item.broker?.id}
                      className="p-3 border border-primary/30 rounded-lg hover:bg-primary/10 cursor-pointer transition-colors bg-primary/5"
                      onClick={() => handleBrokerClick(item)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{item.broker?.name}</p>
                          <p className="text-sm text-muted-foreground">CRECI: {item.broker?.creci}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-primary" />
                      </div>
                      <div className="mt-2">
                        <Badge variant="default" className="text-xs bg-primary/20 text-primary hover:bg-primary/30">
                          Disponível
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Seção: Corretores em Plantão Interno (swap) */}
              {searchedInternalBrokers.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>Corretores em Plantão Interno ({searchedInternalBrokers.length})</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Farão troca - o plantão interno será liberado
                  </p>
                  {searchedInternalBrokers.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => handleBrokerClick(assignment)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{assignment.broker?.name}</p>
                          <p className="text-sm text-muted-foreground">CRECI: {assignment.broker?.creci}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="mt-2">
                        <Badge variant="outline" className="text-xs">
                          Plantão atual: {assignment.location?.name}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Dialog de Confirmação */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirmar Substituição
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Você está prestes a realizar a seguinte substituição:</p>
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">De:</span>
                    <span className="font-semibold text-foreground">{currentBrokerName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Para:</span>
                    <span className="font-semibold text-foreground">{getSelectedBrokerName()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Data:</span>
                    <span className="font-semibold text-foreground">{dateFormatted}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Turno:</span>
                    <span className="font-semibold text-foreground">{shiftType === "morning" ? "Manhã" : "Tarde"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tipo:</span>
                    <Badge variant={isAvailableBroker(pendingSelection) ? "default" : "outline"} className="text-xs">
                      {isAvailableBroker(pendingSelection) ? "Substituição direta" : "Swap com plantão interno"}
                    </Badge>
                  </div>
                </div>

                {/* Eligibility warning */}
                {pendingNotEligible && (
                  <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-700 dark:text-amber-400 text-sm">
                      ⚠️ <strong>{getSelectedBrokerName()}</strong> não está vinculado a este local externo. A alocação será marcada como manual.
                    </AlertDescription>
                  </Alert>
                )}

                <p className="text-amber-600 text-sm font-medium">
                  ⚠️ Esta ação não pode ser desfeita automaticamente.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Confirmar Substituição</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
