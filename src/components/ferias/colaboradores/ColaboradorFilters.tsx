import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ColaboradorFiltersProps {
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  setorFilter: string;
  setSetorFilter: (value: string) => void;
  unidadeFilter: string;
  setUnidadeFilter: (value: string) => void;
  setores: { id: string; nome: string }[];
  unidades: { id: string; nome: string }[];
}

const ColaboradorFilters = ({
  statusFilter,
  setStatusFilter,
  setorFilter,
  setSetorFilter,
  unidadeFilter,
  setUnidadeFilter,
  setores,
  unidades,
}: ColaboradorFiltersProps) => {
  const clearFilters = () => {
    setStatusFilter("todos");
    setSetorFilter("todos");
    setUnidadeFilter("todos");
  };

  const hasFilters = statusFilter !== "todos" || setorFilter !== "todos" || unidadeFilter !== "todos";

  return (
    <div className="flex flex-wrap gap-4 p-4 bg-muted/50 rounded-lg">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Status</label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="desligado">Desligado</SelectItem>
            <SelectItem value="temporario">Inativo (temporário)</SelectItem>
            <SelectItem value="inativo">Inativo (todos)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Setor</label>
        <Select value={setorFilter} onValueChange={setSetorFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Setor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {setores.map((setor) => (
              <SelectItem key={setor.id} value={setor.id}>
                {setor.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Unidade</label>
        <Select value={unidadeFilter} onValueChange={setUnidadeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Unidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            {unidades.map((unidade) => (
              <SelectItem key={unidade.id} value={unidade.id}>
                {unidade.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasFilters && (
        <div className="flex items-end">
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        </div>
      )}
    </div>
  );
};

export default ColaboradorFilters;
