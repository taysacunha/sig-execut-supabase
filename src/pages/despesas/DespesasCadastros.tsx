import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDespesasPermissions } from "@/hooks/useDespesasPermissions";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, ShieldAlert } from "lucide-react";
import {
  useVeiculos, useDeleteVeiculo, useGerarEncargosVeiculo, Veiculo,
} from "@/hooks/useDespesasVeiculos";
import { VeiculoDialog } from "@/components/despesas/VeiculoDialog";
import { CalendarClock } from "lucide-react";

type NamedRow = { id: string; nome: string; descricao?: string | null; is_active: boolean };

interface SimpleCrudProps {
  tabela: string;
  singular: string;
  plural: string;
  temDescricao?: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

function SimpleCadastroCrud({ tabela, singular, plural, temDescricao, canEdit, canDelete }: SimpleCrudProps) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NamedRow | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<NamedRow | null>(null);

  const key = ["despesas-cadastro", tabela];

  const { data: rows = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(tabela as any)
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as NamedRow[];
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload: any = { nome: nome.trim() };
      if (temDescricao) payload.descricao = descricao.trim() || null;
      if (editing) {
        const { error } = await supabase.from(tabela as any).update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        payload.is_active = true;
        const { error } = await supabase.from(tabela as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(`${singular} salvo com sucesso`);
      qc.invalidateQueries({ queryKey: key });
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(tabela as any).update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${singular} desativado`);
      qc.invalidateQueries({ queryKey: key });
      setConfirmDelete(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao desativar"),
  });

  function openNew() {
    setEditing(null); setNome(""); setDescricao(""); setDialogOpen(true);
  }
  function openEdit(r: NamedRow) {
    setEditing(r); setNome(r.nome); setDescricao(r.descricao ?? ""); setDialogOpen(true);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{plural}</CardTitle>
          <CardDescription>Cadastro simples de {plural.toLowerCase()}.</CardDescription>
        </div>
        {canEdit && (
          <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-2" />Novo</Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum registro cadastrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                {temDescricao && <TableHead>Descrição</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.nome}</TableCell>
                  {temDescricao && <TableCell className="text-muted-foreground">{r.descricao ?? "—"}</TableCell>}
                  <TableCell>{r.is_active ? "Ativo" : "Inativo"}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {canEdit && (
                      <Button size="icon" variant="ghost" onClick={() => openEdit(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && r.is_active && (
                      <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(r)}>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? `Editar ${singular}` : `Novo ${singular}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} />
            </div>
            {temDescricao && (
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={255} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMut.mutate()} disabled={!nome.trim() || saveMut.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar {singular.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              O registro <b>{confirmDelete?.nome}</b> será marcado como inativo. Ele deixa de aparecer nas listas ativas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDelete && deleteMut.mutate(confirmDelete.id)}
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default function DespesasCadastros() {
  const { podeVer, podeEditar, podeExcluir } = useDespesasPermissions();
  if (!podeVer("cadastros")) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader className="text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
          <CardTitle>Sem acesso</CardTitle>
          <CardDescription>Você não tem permissão para visualizar cadastros.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const canEdit = podeEditar("cadastros");
  const canDelete = podeExcluir("cadastros");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cadastros — Despesas</h1>
        <p className="text-muted-foreground">
          Cadastros auxiliares usados nas abas de Calendário, Imóveis e Repasses.
        </p>
      </div>

      <Tabs defaultValue="centros">
        <TabsList className="flex-wrap">
          <TabsTrigger value="centros">Centros de custo</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="perfis">Perfis de acesso</TabsTrigger>
          <TabsTrigger value="planos">Planos de conta</TabsTrigger>
          <TabsTrigger value="contas">Contas bancárias</TabsTrigger>
          <TabsTrigger value="pessoas">Pessoas</TabsTrigger>
          <TabsTrigger value="veiculos">Veículos</TabsTrigger>
        </TabsList>

        <TabsContent value="centros" className="mt-4">
          <SimpleCadastroCrud tabela="despesas_centros_custo" singular="Centro de custo" plural="Centros de custo" temDescricao canEdit={canEdit} canDelete={canDelete} />
        </TabsContent>
        <TabsContent value="categorias" className="mt-4">
          <SimpleCadastroCrud tabela="despesas_categorias" singular="Categoria" plural="Categorias" canEdit={canEdit} canDelete={canDelete} />
        </TabsContent>
        <TabsContent value="perfis" className="mt-4">
          <SimpleCadastroCrud tabela="despesas_perfis_acesso" singular="Perfil de acesso" plural="Perfis de acesso" temDescricao canEdit={canEdit} canDelete={canDelete} />
        </TabsContent>
        <TabsContent value="planos" className="mt-4">
          <SimpleCadastroCrud tabela="despesas_planos_conta" singular="Plano de conta" plural="Planos de conta" canEdit={canEdit} canDelete={canDelete} />
        </TabsContent>
        <TabsContent value="contas" className="mt-4">
          <SimpleCadastroCrud tabela="despesas_contas_bancarias" singular="Conta bancária" plural="Contas bancárias" canEdit={canEdit} canDelete={canDelete} />
        </TabsContent>
        <TabsContent value="pessoas" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Pessoas</CardTitle>
              <CardDescription>
                Cadastro completo (CPF/CNPJ, OAB, CRECI, papéis) entra na Fase 2 quando ligamos a Pessoa aos lançamentos. Já está disponível na base para uso via consulta.
              </CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>
        <TabsContent value="veiculos" className="mt-4">
          <VeiculosTab canEdit={canEdit} canDelete={canDelete} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VeiculosTab({ canEdit, canDelete }: { canEdit: boolean; canDelete: boolean }) {
  const { data: veiculos = [], isLoading } = useVeiculos();
  const delMut = useDeleteVeiculo();
  const gerarMut = useGerarEncargosVeiculo();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Veiculo | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Veiculo | null>(null);
  const [confirmGerar, setConfirmGerar] = useState<Veiculo | null>(null);
  const [ano, setAno] = useState<number>(new Date().getFullYear());

  async function gerar() {
    if (!confirmGerar) return;
    try {
      const n = await gerarMut.mutateAsync({ veiculoId: confirmGerar.id, ano });
      toast.success(`${n} lançamento(s) gerado(s)`);
      setConfirmGerar(null);
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Veículos</CardTitle>
          <CardDescription>Frota, motorista, documentos (IPVA, seguro etc) e baixa por venda.</CardDescription>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />Novo veículo
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : veiculos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum veículo cadastrado.</p>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Modelo</TableHead>
              <TableHead>Placa</TableHead>
              <TableHead>Motorista</TableHead>
              <TableHead>Centro</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right w-40">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {veiculos.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.modelo}</TableCell>
                  <TableCell>{v.placa ?? "—"}</TableCell>
                  <TableCell>{v.motorista?.nome ?? "—"}</TableCell>
                  <TableCell>{v.centro_custo?.nome ?? "—"}</TableCell>
                  <TableCell>{v.data_venda ? "Vendido" : "Ativo"}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {canEdit && !v.data_venda && (
                      <Button size="icon" variant="ghost" title="Gerar encargos" onClick={() => { setConfirmGerar(v); setAno(new Date().getFullYear()); }}>
                        <CalendarClock className="h-4 w-4" />
                      </Button>
                    )}
                    {canEdit && (
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(v); setDialogOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(v)}>
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

      <VeiculoDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar veículo?</AlertDialogTitle>
            <AlertDialogDescription>
              O veículo <b>{confirmDelete?.modelo}</b> será marcado como inativo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (confirmDelete) delMut.mutate(confirmDelete.id, {
                  onSuccess: () => { toast.success("Veículo desativado"); setConfirmDelete(null); },
                  onError: (err: any) => toast.error(err?.message ?? "Erro"),
                });
              }}
            >Desativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmGerar} onOpenChange={(o) => !o && setConfirmGerar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar encargos do veículo</AlertDialogTitle>
            <AlertDialogDescription>
              Cria lançamentos parcelados no calendário para <b>{confirmGerar?.modelo}</b>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-2">
            <Label>Ano</Label>
            <Input type="number" value={ano} onChange={(e) => setAno(Number(e.target.value))} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); gerar(); }}>Gerar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}