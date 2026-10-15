import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useDespesasPermissions } from "@/hooks/useDespesasPermissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, ShieldAlert, Search, FileDown, FilterX } from "lucide-react";
import { useLinhas, useLinhasLookup, useDeleteLinha, LinhaTelefonica } from "@/hooks/useDespesasLinhas";
import { LinhaDialog } from "@/components/despesas/linhas/LinhaDialog";
import { gerarRelatorioPdf } from "@/lib/despesasRelatorioPdf";

const T = "todos";
const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const SITUACAO: Record<string, string> = { ativa: "Ativa", inativa: "Inativa", cancelada: "Cancelada" };

export default function DespesasLinhas() {
  const { podeVer, podeEditar, podeExcluir } = useDespesasPermissions();
  const canView = podeVer("linhas");
  const canEdit = podeEditar("linhas");
  const canDelete = podeExcluir("linhas");

  const { data: linhas = [], isLoading } = useLinhas();
  const { data: lookup, refetch: refetchLookup } = useLinhasLookup();
  const delMut = useDeleteLinha();

  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState(T);
  const [operadora, setOperadora] = useState(T);
  const [unidade, setUnidade] = useState(T);
  const [setor, setSetor] = useState(T);
  const [centro, setCentro] = useState(T);
  const [situacao, setSituacao] = useState("ativa");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LinhaTelefonica | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LinhaTelefonica | null>(null);

  const nome = useMemo(() => {
    const m = (arr: { id: string; nome: string }[] = []) => Object.fromEntries(arr.map((x) => [x.id, x.nome]));
    return {
      op: m(lookup?.operadoras), un: m(lookup?.unidades), se: m(lookup?.setores),
      co: m(lookup?.colaboradores), cc: m(lookup?.centros),
    };
  }, [lookup]);

  const filtradas = useMemo(() => {
    const q = semAcento(busca.trim());
    const qd = busca.replace(/\D/g, "");
    return linhas.filter((l) =>
      (tipo === T || l.tipo === tipo) &&
      (operadora === T || l.operadora_id === operadora) &&
      (unidade === T || l.unidade_id === unidade) &&
      (setor === T || l.setor_id === setor) &&
      (centro === T || l.centro_custo_id === centro) &&
      (situacao === T || l.situacao === situacao) &&
      (!q || (qd && l.numero.replace(/\D/g, "").includes(qd)) ||
        [l.empresa_contratada, l.modelo_aparelho, l.observacoes, nome.co[l.responsavel_id ?? ""], nome.op[l.operadora_id]]
          .filter(Boolean).some((t) => semAcento(String(t)).includes(q))),
    );
  }, [linhas, busca, tipo, operadora, unidade, setor, centro, situacao, nome]);

  const algumFiltro = busca || [tipo, operadora, unidade, setor, centro].some((v) => v !== T) || situacao !== "ativa";
  const limpar = () => { setBusca(""); setTipo(T); setOperadora(T); setUnidade(T); setSetor(T); setCentro(T); setSituacao(T); };

  const qtd = {
    ativas: linhas.filter((l) => l.situacao === "ativa").length,
    cel: linhas.filter((l) => l.situacao === "ativa" && l.tipo === "celular").length,
    fixo: linhas.filter((l) => l.situacao === "ativa" && l.tipo === "fixo").length,
  };

  async function gerarPdf() {
    if (!filtradas.length) return toast.error("Nenhuma linha no filtro atual.");
    const desc: string[] = [];
    if (busca) desc.push(`Busca: "${busca}"`);
    if (tipo !== T) desc.push(`Tipo: ${tipo === "celular" ? "Celular" : "Fixo"}`);
    if (operadora !== T) desc.push(`Operadora: ${nome.op[operadora]}`);
    if (unidade !== T) desc.push(`Unidade: ${nome.un[unidade]}`);
    if (setor !== T) desc.push(`Setor: ${nome.se[setor]}`);
    if (centro !== T) desc.push(`Centro: ${nome.cc[centro]}`);
    desc.push(`Situação: ${situacao === T ? "Todas" : SITUACAO[situacao]}`);
    await gerarRelatorioPdf({
      titulo: "Relatório de Linhas Telefônicas",
      filtros: desc.join(" • "),
      unidade: "linha(s)",
      colunas: ["Tipo", "Número", "Operadora", "Empresa contratada", "Unidade", "Setor", "Responsável", "Valor", "Internet", "Aparelho", "Centro de custo", "Situação", "Observações"],
      pesos: [7, 12, 9, 12, 9, 10, 12, 11, 8, 10, 10, 7, 16],
      linhas: filtradas.map((l) => [
        l.tipo === "celular" ? "Celular" : "Fixo",
        l.numero,
        nome.op[l.operadora_id] ?? "",
        l.empresa_contratada ?? "",
        nome.un[l.unidade_id] ?? "",
        nome.se[l.setor_id ?? ""] ?? "",
        nome.co[l.responsavel_id ?? ""] ?? "",
        l.valor_contratado != null ? `${brl(Number(l.valor_contratado))} (${l.tipo_valor === "global" ? "global" : "individual"})` : "",
        l.capacidade_internet ?? "",
        l.modelo_aparelho ?? "",
        nome.cc[l.centro_custo_id ?? ""] ?? "",
        SITUACAO[l.situacao],
        l.observacoes ?? "",
      ]),
      arquivo: `linhas-telefonicas-${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  }

  if (!canView) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader className="text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
          <CardTitle>Sem acesso</CardTitle>
          <CardDescription>Você não tem permissão para visualizar linhas telefônicas.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const filtroSelect = (label: string, value: string, onChange: (v: string) => void, opts: { id: string; nome: string }[]) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-44"><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={T}>{label}: todos</SelectItem>
        {opts.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Linhas Telefônicas</h1>
          <p className="text-muted-foreground">Linhas celulares e fixas da imobiliária.</p>
        </div>
        {canEdit && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />Nova linha
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[["Linhas ativas", qtd.ativas], ["Celulares ativos", qtd.cel], ["Fixos ativos", qtd.fixo]].map(([t, n]) => (
          <Card key={t as string}><CardContent className="pt-6"><p className="text-sm text-muted-foreground">{t}</p><p className="text-2xl font-bold">{n}</p></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative max-w-sm flex-1 min-w-[220px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar por número, responsável, empresa, aparelho…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <Button variant="outline" onClick={limpar} disabled={!algumFiltro}><FilterX className="h-4 w-4 mr-2" />Limpar filtros</Button>
            <Button variant="outline" onClick={gerarPdf} disabled={!filtradas.length}><FileDown className="h-4 w-4 mr-2" />Gerar PDF ({filtradas.length})</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {filtroSelect("Tipo", tipo, setTipo, [{ id: "celular", nome: "Celular" }, { id: "fixo", nome: "Fixo" }])}
            {filtroSelect("Operadora", operadora, setOperadora, lookup?.operadoras ?? [])}
            {filtroSelect("Unidade", unidade, setUnidade, lookup?.unidades ?? [])}
            {filtroSelect("Setor", setor, setSetor, lookup?.setores ?? [])}
            {filtroSelect("Centro", centro, setCentro, lookup?.centros ?? [])}
            {filtroSelect("Situação", situacao, setSituacao, Object.entries(SITUACAO).map(([id, nome]) => ({ id, nome })))}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : filtradas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma linha encontrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Operadora</TableHead>
                  <TableHead>Unidade / Setor</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Aparelho / Internet</TableHead>
                  <TableHead>Centro de custo</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <div className="font-medium">{l.numero}</div>
                      <div className="text-xs text-muted-foreground">{l.tipo === "celular" ? "Celular" : "Fixo"}{l.empresa_contratada ? ` · ${l.empresa_contratada}` : ""}</div>
                    </TableCell>
                    <TableCell>{nome.op[l.operadora_id] ?? "—"}</TableCell>
                    <TableCell>
                      <div>{nome.un[l.unidade_id] ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{nome.se[l.setor_id ?? ""] ?? "—"}</div>
                    </TableCell>
                    <TableCell>{nome.co[l.responsavel_id ?? ""] ?? "—"}</TableCell>
                    <TableCell>
                      {l.tipo === "celular" ? (
                        <><div>{l.modelo_aparelho ?? "—"}</div><div className="text-xs text-muted-foreground">{l.capacidade_internet ?? ""}</div></>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{nome.cc[l.centro_custo_id ?? ""] ?? "—"}</TableCell>
                    <TableCell><Badge variant={l.situacao === "ativa" ? "default" : "secondary"}>{SITUACAO[l.situacao]}</Badge></TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {canEdit && (
                        <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => { setEditing(l); setDialogOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => setConfirmDelete(l)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {lookup && (
        <LinhaDialog open={dialogOpen} onOpenChange={setDialogOpen} linha={editing} lookup={lookup} onOpened={() => refetchLookup()} />
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir linha?</AlertDialogTitle>
            <AlertDialogDescription>
              A linha <b>{confirmDelete?.numero}</b> será apagada definitivamente. Para manter o histórico, prefira editar e marcar como Cancelada ou Inativa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={delMut.isPending}
              onClick={async (e) => {
                e.preventDefault();
                if (!confirmDelete) return;
                try { await delMut.mutateAsync(confirmDelete.id); toast.success("Linha excluída"); setConfirmDelete(null); }
                catch (err: any) { toast.error(err?.message ?? "Erro ao excluir"); }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
