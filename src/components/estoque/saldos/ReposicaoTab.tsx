import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableSearch, TablePagination, SortableHeader } from "@/components/vendas/TableControls";
import { useTableControls } from "@/hooks/useTableControls";
import { FileDown, FilterX, PackageOpen } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import jsPDF from "jspdf";

const fromEstoque = (t: string) => supabase.from(t as any);

export interface ReposicaoRow {
  material_id: string;
  material_nome: string;
  unidade_medida: string;
  categoria: string;
  estoque_minimo: number;
  estoque_maximo: number;
  total: number;
  falta: number;
  situacao: "abaixo_minimo" | "repor" | "completo";
  locaisTexto: string;
}

const SITUACAO_LABEL: Record<ReposicaoRow["situacao"], string> = {
  abaixo_minimo: "Abaixo do mínimo",
  repor: "Repor",
  completo: "Completo",
};

interface MaterialRow {
  id: string;
  nome: string;
  unidade_medida: string;
  categoria: string | null;
  categoria_id: string | null;
  estoque_minimo: number;
  estoque_maximo: number | null;
}

interface SaldoRow {
  material_id: string;
  local_armazenamento_id: string;
  quantidade: number;
}

interface LocalRow {
  id: string;
  nome: string;
  unidade_id: string;
}

interface UnidadeRow {
  id: string;
  nome: string;
}

export function ReposicaoTab() {
  const [unidadeFiltro, setUnidadeFiltro] = useState("todas");
  const [categoriaFiltro, setCategoriaFiltro] = useState("todas");
  const [situacaoFiltro, setSituacaoFiltro] = useState("todas");

  const { data: unidades = [] } = useQuery({
    queryKey: ["estoque-unidades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_unidades")
        .select("id, nome")
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      return (data || []) as UnidadeRow[];
    },
  });

  const { data: materiais = [], isLoading } = useQuery({
    queryKey: ["estoque-materiais-reposicao"],
    refetchOnMount: "always" as const,
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_materiais")
        .select("id, nome, unidade_medida, categoria, categoria_id, estoque_minimo, estoque_maximo")
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      return (data || []) as unknown as MaterialRow[];
    },
  });

  const { data: saldos = [] } = useQuery({
    queryKey: ["estoque-saldos-reposicao"],
    refetchOnMount: "always" as const,
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_saldos")
        .select("material_id, local_armazenamento_id, quantidade");
      if (error) throw error;
      return (data || []) as unknown as SaldoRow[];
    },
  });

  const { data: locais = [] } = useQuery({
    queryKey: ["estoque-locais-ativos-reposicao"],
    refetchOnMount: "always" as const,
    queryFn: async () => {
      const { data, error } = await fromEstoque("estoque_locais_armazenamento")
        .select("id, nome, unidade_id");
      if (error) throw error;
      return (data || []) as unknown as LocalRow[];
    },
  });

  const categorias = useMemo(() => {
    const set = new Set<string>();
    materiais.forEach((m) => m.categoria && set.add(m.categoria));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [materiais]);

  const rows: ReposicaoRow[] = useMemo(() => {
    const localById = new Map(locais.map((l) => [l.id, l]));

    return materiais
      .filter((m) => (m.estoque_maximo || 0) > 0)
      .map((m) => {
        const doMaterial = saldos.filter((s) => s.material_id === m.id);
        const total = doMaterial.reduce((acc, s) => acc + (s.quantidade || 0), 0);
        const maximo = m.estoque_maximo || 0;
        const falta = Math.max(maximo - total, 0);
        const situacao: ReposicaoRow["situacao"] =
          m.estoque_minimo > 0 && total <= m.estoque_minimo
            ? "abaixo_minimo"
            : falta > 0
              ? "repor"
              : "completo";

        const detalhes = doMaterial
          .filter((s) => (s.quantidade || 0) !== 0)
          .map((s) => ({ local: localById.get(s.local_armazenamento_id), qtd: s.quantidade }))
          .sort((a, b) => (a.local?.nome || "").localeCompare(b.local?.nome || ""));

        return {
          material_id: m.id,
          material_nome: m.nome,
          unidade_medida: m.unidade_medida,
          categoria: m.categoria || "—",
          estoque_minimo: m.estoque_minimo || 0,
          estoque_maximo: maximo,
          total,
          falta,
          situacao,
          locaisTexto: detalhes.length
            ? detalhes.map((d) => `${d.local?.nome || "Local"}: ${d.qtd}`).join(" · ")
            : "Sem saldo registrado em nenhum local",
          unidadeIds: Array.from(
            new Set(detalhes.map((d) => d.local?.unidade_id).filter(Boolean) as string[])
          ),
        };
      });
  }, [materiais, saldos, locais]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (unidadeFiltro !== "todas" && !r.unidadeIds.includes(unidadeFiltro)) return false;
      if (categoriaFiltro !== "todas" && r.categoria !== categoriaFiltro) return false;
      if (situacaoFiltro !== "todas" && r.situacao !== situacaoFiltro) return false;
      return true;
    });
  }, [rows, unidadeFiltro, categoriaFiltro, situacaoFiltro]);

  const controls = useTableControls({
    data: filtered,
    searchField: ["material_nome", "categoria", "locaisTexto"],
    defaultItemsPerPage: 25,
  });

  const {
    searchTerm, setSearchTerm, paginatedData, filteredData,
    currentPage, totalPages, itemsPerPage, setCurrentPage, setItemsPerPage,
    sortField, sortDirection, setSorting,
  } = controls;

  const temFiltro =
    !!searchTerm || unidadeFiltro !== "todas" || categoriaFiltro !== "todas" || situacaoFiltro !== "todas";

  const limparFiltros = () => {
    setSearchTerm("");
    setUnidadeFiltro("todas");
    setCategoriaFiltro("todas");
    setSituacaoFiltro("todas");
    setCurrentPage(1);
  };

  const gerarPDF = () => {
    const dados = filteredData;
    if (dados.length === 0) {
      toast.error("Nenhum material para os filtros selecionados");
      return;
    }

    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;

    pdf.setFillColor(59, 130, 246);
    pdf.rect(0, 0, pageWidth, 25, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("REPOSIÇÃO DE ESTOQUE", pageWidth / 2, 12, { align: "center" });
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text(
      `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      pageWidth / 2, 20, { align: "center" }
    );
    pdf.setTextColor(0, 0, 0);

    let y = 32;

    const filtrosTexto = [
      unidadeFiltro !== "todas"
        ? `Unidade: ${unidades.find((u) => u.id === unidadeFiltro)?.nome || "—"}`
        : null,
      categoriaFiltro !== "todas" ? `Categoria: ${categoriaFiltro}` : null,
      situacaoFiltro !== "todas"
        ? `Situação: ${SITUACAO_LABEL[situacaoFiltro as ReposicaoRow["situacao"]]}`
        : null,
      searchTerm ? `Busca: "${searchTerm}"` : null,
    ].filter(Boolean) as string[];

    pdf.setFontSize(9);
    pdf.text(
      filtrosTexto.length ? `Filtros — ${filtrosTexto.join(" | ")}` : "Filtros — nenhum (todos os materiais)",
      margin, y
    );
    y += 6;

    const cols = [
      { label: "Material", x: margin + 2, w: 60 },
      { label: "Un.", x: margin + 64, w: 14 },
      { label: "Mín.", x: margin + 80, w: 14 },
      { label: "Máx.", x: margin + 96, w: 14 },
      { label: "Atual", x: margin + 112, w: 16 },
      { label: "Falta", x: margin + 130, w: 16 },
      { label: "Situação", x: margin + 148, w: 32 },
      { label: "Distribuição por local", x: margin + 182, w: pageWidth - margin - (margin + 182) - 2 },
    ];

    const drawHeader = () => {
      pdf.setFillColor(200, 200, 200);
      pdf.rect(margin, y, pageWidth - margin * 2, 8, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      cols.forEach((c) => pdf.text(c.label, c.x, y + 5.5));
      y += 8;
      pdf.setFont("helvetica", "normal");
    };
    drawHeader();

    dados.forEach((r, idx) => {
      const cells = [
        r.material_nome,
        r.unidade_medida,
        String(r.estoque_minimo),
        String(r.estoque_maximo),
        String(r.total),
        String(r.falta),
        SITUACAO_LABEL[r.situacao],
        r.locaisTexto,
      ];
      const wrapped = cells.map((txt, i) => pdf.splitTextToSize(String(txt), cols[i].w));
      const lines = Math.max(...wrapped.map((w) => w.length));
      const rowH = lines * 4 + 3;

      if (y + rowH > pageHeight - 14) {
        pdf.addPage();
        y = 15;
        drawHeader();
      }

      if (idx % 2 === 0) {
        pdf.setFillColor(245, 245, 245);
        pdf.rect(margin, y, pageWidth - margin * 2, rowH, "F");
      }
      wrapped.forEach((w, i) => pdf.text(w, cols[i].x, y + 4.5));
      y += rowH;
    });

    const abaixo = dados.filter((r) => r.situacao === "abaixo_minimo").length;
    const repor = dados.filter((r) => r.situacao === "repor").length;
    y += 6;
    if (y > pageHeight - 14) { pdf.addPage(); y = 15; }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text(
      `Total de materiais listados: ${dados.length}  |  Abaixo do mínimo: ${abaixo}  |  A repor: ${repor}`,
      margin, y
    );

    pdf.save(`reposicao-estoque-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast.success("PDF gerado!");
  };

  if (isLoading) {
    return <p className="text-center text-muted-foreground py-8">Carregando…</p>;
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
          <PackageOpen className="h-12 w-12 mb-4 opacity-50" />
          <p>Nenhum material com estoque máximo definido.</p>
          <p className="text-sm">Cadastre o estoque máximo na página Materiais para acompanhar a reposição.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <TableSearch
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar material, categoria ou local..."
          />
          <Select value={unidadeFiltro} onValueChange={setUnidadeFiltro}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as unidades</SelectItem>
              {unidades.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as categorias</SelectItem>
              {categorias.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={situacaoFiltro} onValueChange={setSituacaoFiltro}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as situações</SelectItem>
              <SelectItem value="abaixo_minimo">Abaixo do mínimo</SelectItem>
              <SelectItem value="repor">Repor</SelectItem>
              <SelectItem value="completo">Completo</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={limparFiltros} disabled={!temFiltro}>
            <FilterX className="h-4 w-4 mr-2" /> Limpar filtros
          </Button>
          <Button variant="outline" onClick={gerarPDF} className="ml-auto">
            <FileDown className="h-4 w-4 mr-2" /> Gerar PDF
          </Button>
        </div>

        {paginatedData.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum material encontrado para os filtros.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortableHeader label="Material" field="material_nome" currentField={sortField as string} direction={sortDirection} onSort={setSorting as any} />
                  </TableHead>
                  <TableHead>Un.</TableHead>
                  <TableHead className="text-center">
                    <SortableHeader label="Mín." field="estoque_minimo" currentField={sortField as string} direction={sortDirection} onSort={setSorting as any} />
                  </TableHead>
                  <TableHead className="text-center">
                    <SortableHeader label="Máx." field="estoque_maximo" currentField={sortField as string} direction={sortDirection} onSort={setSorting as any} />
                  </TableHead>
                  <TableHead className="text-center">
                    <SortableHeader label="Atual" field="total" currentField={sortField as string} direction={sortDirection} onSort={setSorting as any} />
                  </TableHead>
                  <TableHead className="text-center">
                    <SortableHeader label="Falta" field="falta" currentField={sortField as string} direction={sortDirection} onSort={setSorting as any} />
                  </TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((r) => (
                  <TableRow key={r.material_id}>
                    <TableCell className="font-medium">
                      <div>{r.material_nome}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{r.locaisTexto}</div>
                    </TableCell>
                    <TableCell>{r.unidade_medida}</TableCell>
                    <TableCell className="text-center">{r.estoque_minimo}</TableCell>
                    <TableCell className="text-center">{r.estoque_maximo}</TableCell>
                    <TableCell className="text-center font-semibold">{r.total}</TableCell>
                    <TableCell className="text-center">{r.falta}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.situacao === "abaixo_minimo"
                            ? "destructive"
                            : r.situacao === "repor"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {SITUACAO_LABEL[r.situacao]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
              totalItems={filteredData.length}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
