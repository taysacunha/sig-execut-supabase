import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Crown, Users, Loader2 } from "lucide-react";

interface SetorViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setor: { id: string; nome: string; is_active: boolean } | null;
}

const SetorViewDialog = ({ open, onOpenChange, setor }: SetorViewDialogProps) => {
  const { data: chefes = [], isLoading: loadingChefes } = useQuery({
    queryKey: ["ferias-setor-chefes-view", setor?.id],
    enabled: !!setor?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_setor_chefes")
        .select("colaborador_id, ferias_colaboradores(id, nome, status)")
        .eq("setor_id", setor!.id);
      if (error) throw error;
      return data as { colaborador_id: string; ferias_colaboradores: { id: string; nome: string; status: string } | null }[];
    },
  });

  const { data: colaboradores = [], isLoading: loadingColabs } = useQuery({
    queryKey: ["ferias-setor-colaboradores-view", setor?.id],
    enabled: !!setor?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_colaboradores")
        .select("id, nome, status")
        .eq("setor_titular_id", setor!.id)
        .order("nome");
      if (error) throw error;
      return data as { id: string; nome: string; status: string }[];
    },
  });

  if (!setor) return null;

  const chefeIds = new Set(chefes.map((c) => c.colaborador_id));
  const colabsAtivos = colaboradores.filter((c) => c.status === "ativo");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {setor.nome}
            <Badge variant={setor.is_active ? "default" : "secondary"}>
              {setor.is_active ? "Ativo" : "Inativo"}
            </Badge>
          </DialogTitle>
          <DialogDescription>Visão geral dos chefes e colaboradores deste setor.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
              <Crown className="h-4 w-4 text-warning" />
              Chefes ({chefes.length})
            </h3>
            {loadingChefes ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : chefes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum chefe cadastrado.</p>
            ) : (
              <ul className="space-y-1">
                {chefes.map((c) => (
                  <li key={c.colaborador_id} className="text-sm flex items-center gap-2">
                    <span>{c.ferias_colaboradores?.nome || "Nome não disponível"}</span>
                    {c.ferias_colaboradores?.status && c.ferias_colaboradores.status !== "ativo" && (
                      <Badge variant="secondary" className="text-xs">{c.ferias_colaboradores.status}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Colaboradores ({colabsAtivos.length} ativos / {colaboradores.length} total)
            </h3>
            {loadingColabs ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : colaboradores.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum colaborador vinculado a este setor como titular.</p>
            ) : (
              <ul className="space-y-1">
                {colaboradores.map((c) => (
                  <li key={c.id} className="text-sm flex items-center gap-2">
                    {chefeIds.has(c.id) && <Crown className="h-3 w-3 text-warning" />}
                    <span className={c.status !== "ativo" ? "text-muted-foreground line-through" : ""}>
                      {c.nome}
                    </span>
                    {c.status !== "ativo" && (
                      <Badge variant="secondary" className="text-xs">{c.status}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SetorViewDialog;