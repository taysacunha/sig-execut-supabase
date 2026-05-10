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
import { Users, Loader2 } from "lucide-react";

interface CargoViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cargo: { id: string; nome: string; is_active?: boolean | null } | null;
}

const CargoViewDialog = ({ open, onOpenChange, cargo }: CargoViewDialogProps) => {
  const { data: colaboradores = [], isLoading } = useQuery({
    queryKey: ["ferias-cargo-colaboradores-view", cargo?.id],
    enabled: !!cargo?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_colaboradores")
        .select("id, nome, status, setor_titular_id, unidade_id, ferias_setores:setor_titular_id(nome), ferias_unidades:unidade_id(nome)")
        .eq("cargo_id", cargo!.id)
        .order("nome");
      if (error) throw error;
      return data as {
        id: string;
        nome: string;
        status: string;
        setor_titular_id: string | null;
        unidade_id: string | null;
        ferias_setores: { nome: string } | null;
        ferias_unidades: { nome: string } | null;
      }[];
    },
  });

  if (!cargo) return null;

  const ativos = colaboradores.filter((c) => c.status === "ativo");
  const isActive = cargo.is_active ?? true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {cargo.nome}
            <Badge variant={isActive ? "default" : "secondary"}>
              {isActive ? "Ativo" : "Inativo"}
            </Badge>
          </DialogTitle>
          <DialogDescription>Visão geral dos colaboradores deste cargo.</DialogDescription>
        </DialogHeader>

        <section>
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Colaboradores ({ativos.length} ativos / {colaboradores.length} total)
          </h3>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : colaboradores.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum colaborador vinculado a este cargo.</p>
          ) : (
            <ul className="space-y-1">
              {colaboradores.map((c) => (
                <li key={c.id} className="text-sm flex items-center gap-2 flex-wrap">
                  <span className={c.status !== "ativo" ? "text-muted-foreground line-through" : ""}>
                    {c.nome}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {c.ferias_setores?.nome ? `— ${c.ferias_setores.nome}` : ""}
                    {c.ferias_unidades?.nome ? ` · ${c.ferias_unidades.nome}` : ""}
                  </span>
                  {c.status !== "ativo" && (
                    <Badge variant="secondary" className="text-xs">{c.status}</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
};

export default CargoViewDialog;