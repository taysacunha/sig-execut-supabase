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
import { Building2, Users, Loader2 } from "lucide-react";

interface UnidadeViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unidade: { id: string; nome: string; endereco: string | null; is_active: boolean } | null;
}

const UnidadeViewDialog = ({ open, onOpenChange, unidade }: UnidadeViewDialogProps) => {
  const { data: setores = [], isLoading: loadingSetores } = useQuery({
    queryKey: ["ferias-unidade-setores-view", unidade?.id],
    enabled: !!unidade?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_setores")
        .select("id, nome, is_active")
        .eq("unidade_id", unidade!.id)
        .order("nome");
      if (error) throw error;
      return data as { id: string; nome: string; is_active: boolean }[];
    },
  });

  const { data: colaboradores = [], isLoading: loadingColabs } = useQuery({
    queryKey: ["ferias-unidade-colaboradores-view", unidade?.id],
    enabled: !!unidade?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_colaboradores")
        .select("id, nome, status, setor_titular_id")
        .eq("unidade_id", unidade!.id)
        .order("nome");
      if (error) throw error;
      return data as { id: string; nome: string; status: string; setor_titular_id: string | null }[];
    },
  });

  if (!unidade) return null;

  const ativos = colaboradores.filter((c) => c.status === "ativo");
  const setorNome = new Map(setores.map((s) => [s.id, s.nome]));

  // Agrupar colaboradores por setor
  const colabsPorSetor = new Map<string, typeof colaboradores>();
  colaboradores.forEach((c) => {
    const key = c.setor_titular_id || "_sem_setor";
    if (!colabsPorSetor.has(key)) colabsPorSetor.set(key, []);
    colabsPorSetor.get(key)!.push(c);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {unidade.nome}
            <Badge variant={unidade.is_active ? "default" : "secondary"}>
              {unidade.is_active ? "Ativo" : "Inativo"}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {unidade.endereco || "Sem endereço cadastrado."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Setores ({setores.length})
            </h3>
            {loadingSetores ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : setores.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum setor cadastrado nesta unidade.</p>
            ) : (
              <ul className="space-y-1">
                {setores.map((s) => (
                  <li key={s.id} className="text-sm flex items-center gap-2">
                    <span>{s.nome}</span>
                    {!s.is_active && (
                      <Badge variant="secondary" className="text-xs">Inativo</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      ({(colabsPorSetor.get(s.id) || []).filter((c) => c.status === "ativo").length} ativos)
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Colaboradores ({ativos.length} ativos / {colaboradores.length} total)
            </h3>
            {loadingColabs ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : colaboradores.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum colaborador vinculado a esta unidade.</p>
            ) : (
              <ul className="space-y-1">
                {colaboradores.map((c) => (
                  <li key={c.id} className="text-sm flex items-center gap-2">
                    <span className={c.status !== "ativo" ? "text-muted-foreground line-through" : ""}>
                      {c.nome}
                    </span>
                    {c.setor_titular_id && (
                      <span className="text-xs text-muted-foreground">
                        — {setorNome.get(c.setor_titular_id) || "—"}
                      </span>
                    )}
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

export default UnidadeViewDialog;