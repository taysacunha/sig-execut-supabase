import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, AlertTriangle, Loader2 } from "lucide-react";
import type { FeriasDiffResult } from "@/lib/feriasDiff";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diff: FeriasDiffResult | null;
  colaboradorNome?: string;
  isSaving?: boolean;
  onConfirm: () => void;
}

export function ConfirmarAlteracoesFeriasDialog({
  open,
  onOpenChange,
  diff,
  colaboradorNome,
  isSaving,
  onConfirm,
}: Props) {
  if (!diff) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Confirmar alterações nas férias
          </DialogTitle>
          <DialogDescription>
            {colaboradorNome
              ? `Revise o que será alterado no cadastro de ${colaboradorNome} antes de salvar.`
              : "Revise o que será alterado antes de salvar."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 pr-3">
          <div className="space-y-4">
            {diff.rows.length > 0 && (
              <div className="rounded-md border divide-y">
                {diff.rows.map((row) => (
                  <div key={row.label} className="p-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{row.label}</span>
                      {row.destaque && (
                        <Badge variant="destructive" className="text-[10px]">
                          Mudança importante
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded bg-muted px-2 py-1 text-muted-foreground line-through">
                        {row.antes}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="rounded bg-primary/10 px-2 py-1 font-medium text-primary">
                        {row.depois}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {diff.periodosMudaram && (
              <div className="rounded-md border p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Períodos de gozo</span>
                  <Badge variant="destructive" className="text-[10px]">
                    Mudança importante
                  </Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs uppercase text-muted-foreground">Antes</p>
                    {diff.periodosAntes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum período cadastrado</p>
                    ) : (
                      <ul className="space-y-1">
                        {diff.periodosAntes.map((p) => (
                          <li key={p} className="text-sm text-muted-foreground">
                            {p}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase text-muted-foreground">Depois</p>
                    {diff.periodosDepois.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum período cadastrado</p>
                    ) : (
                      <ul className="space-y-1">
                        {diff.periodosDepois.map((p) => (
                          <li key={p} className="text-sm font-medium">
                            {p}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="shrink-0 gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}