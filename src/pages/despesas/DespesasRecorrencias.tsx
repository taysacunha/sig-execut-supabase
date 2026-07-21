import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Loader2, Play, Power, Trash2, ListChecks } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Recorrencia, useDeleteRecorrencia, useGerarOcorrencias, useRecorrencias,
  useSaveRecorrencia,
} from "@/hooks/useDespesasRecorrencias";

const TIPO_LABEL: Record<string, string> = {
  mensal: "Mensal",
  anual: "Anual",
  fixa_meses: "Meses fixos",
  intercalada: "Intercalada",
};

export default function DespesasRecorrencias() {
  const { data = [], isLoading } = useRecorrencias();
  const saveMut = useSaveRecorrencia();
  const gerarMut = useGerarOcorrencias();
  const delMut = useDeleteRecorrencia();
  const [toDelete, setToDelete] = useState<Recorrencia | null>(null);

  async function toggleAtivo(r: Recorrencia) {
    try {
      await saveMut.mutateAsync({
        id: r.id,
        input: {
          ativo: !r.ativo,
          tipo: r.tipo,
          data_inicio: r.data_inicio,
          data_fim: r.data_fim,
          dia_vencimento: r.dia_vencimento,
          meses_fixos: r.meses_fixos,
          janela_geracao_meses: r.janela_geracao_meses,
          lanc_tipo: r.lanc_tipo,
          descricao: r.descricao,
          valor_total: r.valor_total,
          centro_custo_id: r.centro_custo_id,
          categoria_id: r.categoria_id,
          plano_conta_id: r.plano_conta_id,
          subcategoria_id: r.subcategoria_id,
          conta_bancaria_id: r.conta_bancaria_id,
          pessoa_id: r.pessoa_id,
          imovel_id: r.imovel_id,
          referencia_tipo: r.referencia_tipo,
          referencia_numero: r.referencia_numero,
          observacao: r.observacao,
        },
      });
      toast.success(r.ativo ? "Série pausada" : "Série ativada");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao alterar status");
    }
  }

  async function gerar(r: Recorrencia) {
    try {
      const n = await gerarMut.mutateAsync({ id: r.id });
      toast.success(`${n} ocorrência(s) geradas`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao gerar ocorrências");
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await delMut.mutateAsync(toDelete.id);
      toast.success("Série removida");
      setToDelete(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao remover");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Recorrências</h1>
          <p className="text-sm text-muted-foreground">
            Séries que geram lançamentos automaticamente. Crie novas séries pelo diálogo
            de <strong>Novo Lançamento</strong> ativando “Repetir automaticamente”.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Séries cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : data.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma série cadastrada.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Frequência</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Centro</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Última geração até</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.descricao}</TableCell>
                      <TableCell>{TIPO_LABEL[r.tipo] ?? r.tipo}</TableCell>
                      <TableCell>R$ {Number(r.valor_total).toFixed(2)}</TableCell>
                      <TableCell>{r.centro_custo?.nome ?? "—"}</TableCell>
                      <TableCell>
                        {format(new Date(r.data_inicio + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {r.ultima_geracao_ate
                          ? format(new Date(r.ultima_geracao_ate + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.ativo ? "default" : "secondary"}>
                          {r.ativo ? "Ativa" : "Pausada"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1 whitespace-nowrap">
                        <Button asChild size="sm" variant="ghost">
                          <Link to={`/despesas/calendario?serie=${r.id}`}>
                            <ListChecks className="h-3 w-3 mr-1" /> Ver ocorrências
                          </Link>
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => gerar(r)} disabled={gerarMut.isPending}>
                          <Play className="h-3 w-3 mr-1" /> Gerar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => toggleAtivo(r)} disabled={saveMut.isPending}>
                          <Power className="h-3 w-3 mr-1" /> {r.ativo ? "Pausar" : "Ativar"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setToDelete(r)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover série de recorrência?</AlertDialogTitle>
            <AlertDialogDescription>
              Os lançamentos já gerados serão mantidos (sem vínculo com a série). Novos
              lançamentos não serão gerados. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}