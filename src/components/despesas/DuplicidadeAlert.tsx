import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useDuplicidades, DuplicidadeArgs } from "@/hooks/useDespesasDuplicidades";

export function DuplicidadeAlert(props: DuplicidadeArgs) {
  const { data, isLoading } = useDuplicidades(props);
  if (isLoading || !data || data.length === 0) return null;

  return (
    <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <div className="space-y-1 min-w-0">
          <div className="font-medium">
            {data.length} possível duplicidade{data.length > 1 ? "s" : ""} encontrada
            {data.length > 1 ? "s" : ""}
          </div>
          <ul className="list-disc pl-4 space-y-0.5">
            {data.slice(0, 5).map((d) => (
              <li key={d.id} className="break-words">
                {d.descricao} — R$ {Number(d.valor_total).toFixed(2)} em{" "}
                {format(new Date(d.data_vencimento + "T00:00:00"), "dd/MM/yyyy", {
                  locale: ptBR,
                })}
                {d.pessoa_nome ? ` · ${d.pessoa_nome}` : ""}{" "}
                <span className="text-xs opacity-70">({d.status})</span>
              </li>
            ))}
          </ul>
          <div className="text-xs opacity-70">
            Confira antes de salvar. Você pode prosseguir se for realmente distinto.
          </div>
        </div>
      </div>
    </div>
  );
}