import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Download, Edit, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import type { FeriasPremiacao } from "@/hooks/ferias/useFeriasPremiacoes";

const TODAY = () => new Date().toISOString().slice(0, 10);

function fmt(d?: string | null) {
  if (!d) return "—";
  try { return format(parseISO(d), "dd/MM/yyyy"); } catch { return d; }
}

export function ExportacaoCell({
  p, canEdit, onGerar,
}: {
  p: FeriasPremiacao;
  canEdit: boolean;
  onGerar: () => Promise<void> | void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm">{fmt(p.ultima_exportacao_pdf)}</span>
      {canEdit && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          title="Gerar PDF (usa a data de recebimento como emissão)"
          onClick={() => onGerar()}
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

export function RecebimentoCell({
  p, canEdit, userNamesById, onConfirmar, onRemover,
}: {
  p: FeriasPremiacao;
  canEdit: boolean;
  userNamesById?: Record<string, string>;
  onConfirmar: (data: string) => Promise<void> | void;
  onRemover: () => Promise<void> | void;
}) {
  const [pop, setPop] = useState(false);
  const minDate = p.ultima_exportacao_pdf || undefined;
  const [data, setData] = useState<string>(p.recebimento_confirmado_em || minDate || TODAY());

  if (p.recebimento_confirmado && p.recebimento_confirmado_em) {
    const nome = p.recebimento_confirmado_por && userNamesById?.[p.recebimento_confirmado_por];
    return (
      <div className="flex items-center gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild disabled={!canEdit}>
            <Checkbox
              checked
              disabled={!canEdit}
              onCheckedChange={() => { /* AlertDialogTrigger cuida da abertura */ }}
              className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600 cursor-pointer"
            />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Desmarcar atesto de recebimento</AlertDialogTitle>
              <AlertDialogDescription>
                Deseja desmarcar o atesto de recebimento? Esta ação removerá a data e o usuário responsáveis pela confirmação.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={async () => { await onRemover(); }}>Desmarcar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <span className="text-xs text-green-700 dark:text-green-400" title={nome ? `Atestado por ${nome}` : undefined}>
          ✓ {fmt(p.recebimento_confirmado_em)}{nome ? ` · ${nome}` : ""}
        </span>
      </div>
    );
  }

  return (
    <Popover open={pop} onOpenChange={(v) => { setPop(v); if (v) setData(minDate || TODAY()); }}>
      <PopoverTrigger asChild disabled={!canEdit}>
        <div className="flex items-center gap-2 cursor-pointer">
          <Checkbox disabled={!canEdit} />
          <span className="text-xs text-muted-foreground">Pendente</span>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2" align="end">
        <div className="text-xs font-semibold">Atestar recebimento</div>
        <p className="text-[11px] text-muted-foreground">Confirma o recebimento do valor e o PDF assinado.</p>
        <Input type="date" value={data} min={minDate} onChange={(e) => setData(e.target.value)} />
        {minDate && <p className="text-[11px] text-muted-foreground">Não pode ser anterior à emissão ({fmt(minDate)}).</p>}
        <Button size="sm" className="w-full" onClick={async () => {
          if (!data) { toast.error("Informe a data"); return; }
          if (minDate && data < minDate) { toast.error("Data anterior à emissão"); return; }
          await onConfirmar(data);
          setPop(false);
        }}>Atestar</Button>
      </PopoverContent>
    </Popover>
  );
}
