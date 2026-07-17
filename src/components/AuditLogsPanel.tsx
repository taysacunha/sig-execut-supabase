import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, History, User, Shield, ChevronDown, ChevronUp, Filter, RefreshCw, Search } from "lucide-react";
import { TablePagination } from "@/components/vendas/TableControls";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

interface AdminAuditLog {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  target_id: string | null;
  target_email: string | null;
  target_name: string | null;
  action: string;
  details: unknown;
  created_at: string;
}

interface ModuleAuditLog {
  id: string;
  module_name: string;
  table_name: string;
  record_id: string | null;
  action: string;
  old_data: unknown;
  new_data: unknown;
  changed_fields: string[] | null;
  changed_by: string | null;
  changed_by_email: string | null;
  created_at: string;
}

const actionLabels: Record<string, string> = {
  deactivate: "Desativou usuário",
  reactivate: "Reativou usuário",
  delete: "Removeu usuário",
  update_email: "Alterou email",
  update_password: "Alterou senha",
  INSERT: "Inseriu",
  UPDATE: "Atualizou",
  DELETE: "Removeu",
  DELETE_CASCADE_NOTE: "Cascata",
  DELETE_NOTE: "Justificativa",
};

const actionColors: Record<string, string> = {
  deactivate: "bg-amber-500 text-white",
  reactivate: "bg-green-600 text-white",
  delete: "bg-destructive text-destructive-foreground",
  update_email: "bg-blue-500 text-white",
  update_password: "bg-purple-500 text-white",
  INSERT: "bg-green-600 text-white",
  UPDATE: "bg-blue-500 text-white",
  DELETE: "bg-destructive text-destructive-foreground",
  DELETE_CASCADE_NOTE: "bg-orange-500 text-white",
  DELETE_NOTE: "bg-orange-500 text-white",
};

const moduleLabels: Record<string, string> = {
  escalas: "Escalas",
  vendas: "Vendas",
  estoque: "Estoques",
  ferias: "Férias e Folgas",
  despesas: "Despesas",
  sistema: "Sistema",
};

const tableLabels: Record<string, string> = {
  brokers: "Corretores",
  locations: "Locais",
  schedule_assignments: "Alocações",
  generated_schedules: "Escalas",
  sales: "Vendas",
  sales_brokers: "Corretores de Vendas",
  sales_teams: "Equipes",
  broker_evaluations: "Avaliações",
  monthly_leads: "Leads",
  proposals: "Propostas",
  user_roles: "Permissões",
  system_access: "Acessos ao Sistema",
  user_profiles: "Perfis de Usuário",
  admin_audit_logs: "Logs Administrativos",
  module_audit_logs: "Logs de Módulos",
  estoque_materiais: "Materiais",
  estoque_locais_armazenamento: "Locais de Armazenamento",
  estoque_saldos: "Saldos",
  estoque_gestores: "Gestores",
  estoque_solicitacoes: "Solicitações",
  estoque_solicitacao_itens: "Itens de Solicitação",
  estoque_movimentacoes: "Movimentações",
  estoque_notificacoes: "Notificações",
  ferias_colaboradores: "Colaboradores",
  ferias_ferias: "Períodos de Férias",
  ferias_folgas: "Folgas de Sábado",
  ferias_folgas_escala: "Escalas de Folga",
  ferias_folgas_creditos: "Créditos de Folga/Férias",
  ferias_folgas_perdas: "Perdas de Folga",
  ferias_afastamentos: "Afastamentos",
  ferias_setores: "Setores",
  ferias_equipes: "Equipes (Férias)",
  ferias_cargos: "Cargos",
  ferias_unidades: "Unidades",
  ferias_feriados: "Feriados",
  ferias_formulario_anual: "Formulário Anual",
  ferias_gozo_periodos: "Períodos de Gozo",
  ferias_periodos_quitados: "Períodos Quitados",
  ferias_setor_chefes: "Chefes de Setor",
  ferias_colaborador_setores_substitutos: "Setores Substitutos",
  // Despesas
  despesas_lancamentos: "Lançamentos",
  despesas_lancamento_pagamentos: "Pagamentos",
  despesas_recorrencias: "Recorrências",
  despesas_imoveis: "Imóveis",
  despesas_imovel_encargos: "Encargos de Imóvel",
  despesas_veiculos: "Veículos",
  despesas_veiculo_documentos: "Documentos de Veículo",
  despesas_repasses: "Repasses",
  despesas_repasse_itens: "Itens de Repasse",
  despesas_categorias: "Categorias",
  despesas_subcategorias: "Subcategorias",
  despesas_planos_conta: "Planos de Conta",
  despesas_centros_custo: "Centros de Custo",
  despesas_contas_bancarias: "Contas Bancárias",
  despesas_pessoas: "Pessoas",
  despesas_aba_permissoes: "Permissões por Aba",
  despesas_centros_custo_permissoes: "Permissões de Centro",
  despesas_perfis_acesso: "Perfis de Acesso (Despesas)",
  despesas_notificacoes_preferencias: "Preferências de Notificação",
};

const fieldLabels: Record<string, string> = {
  nome: "Nome",
  nome_exibicao: "Nome de exibição",
  status: "Status",
  data_admissao: "Admissão",
  data_nascimento: "Nascimento",
  observacoes: "Observações",
  cpf: "CPF",
  setor_titular_id: "Setor titular",
  unidade_id: "Unidade",
  cargo_id: "Cargo",
  equipe_id: "Equipe",
  familiar_id: "Familiar",
  colaborador_id: "Colaborador",
  data_sabado: "Sábado",
  data_inicio: "Início",
  data_fim: "Fim",
  motivo: "Motivo",
  motivo_descricao: "Descrição do motivo",
  is_excecao: "Exceção",
  excecao_motivo: "Motivo da exceção",
  excecao_justificativa: "Justificativa",
  quinzena1_inicio: "Quinzena 1 - início",
  quinzena1_fim: "Quinzena 1 - fim",
  quinzena2_inicio: "Quinzena 2 - início",
  quinzena2_fim: "Quinzena 2 - fim",
  gozo_quinzena1_inicio: "Gozo Q1 - início",
  gozo_quinzena1_fim: "Gozo Q1 - fim",
  gozo_quinzena2_inicio: "Gozo Q2 - início",
  gozo_quinzena2_fim: "Gozo Q2 - fim",
  vender_dias: "Vende dias",
  dias_vendidos: "Dias vendidos",
  quinzena_venda: "Quinzena de venda",
  enviado_contador: "Enviado ao contador",
  enviado_contador_q1: "Enviado contador Q1",
  enviado_contador_q2: "Enviado contador Q2",
  is_active: "Ativo",
  periodo_aquisitivo_inicio: "Período aquisitivo - início",
  periodo_aquisitivo_fim: "Período aquisitivo - fim",
  distribuicao_tipo: "Distribuição",
  origem: "Origem",
  gozo_diferente: "Gozo diferente",
  gozo_flexivel: "Gozo flexível",
  vender_q1: "Vender Q1",
  vender_q2: "Vender Q2",
  dias_vendidos_q1: "Dias vendidos Q1",
  dias_vendidos_q2: "Dias vendidos Q2",
  parent_id: "Pai",
  tipo: "Tipo",
  descricao: "Descrição",
  unidade_medida: "Unidade de medida",
  estoque_minimo: "Estoque mínimo",
  categoria: "Categoria",
  categoria_id: "Categoria",
  quantidade: "Quantidade",
  material_id: "Material",
  local_origem_id: "Local de origem",
  local_destino_id: "Local de destino",
  responsavel_user_id: "Responsável",
  recebido_em: "Recebido em",
  recebido_por_user_id: "Recebido por",
  solicitacao_id: "Solicitação",
  setor_id: "Setor",
  available_weekdays: "Dias disponíveis",
  weekday_shift_availability: "Turnos disponíveis",
  creci: "CRECI",
  // Sistema / usuários
  user_id: "Usuário",
  role: "Permissão",
  system_name: "Sistema",
  can_view: "Pode visualizar",
  can_edit: "Pode editar",
  name: "Nome",
  email: "E-mail",
  phone: "Telefone",
  avatar_url: "Foto",
  granted_by: "Concedido por",
  granted_at: "Concedido em",
  // Detalhes de admin_audit_logs
  reason: "Motivo",
  is_self: "Auto-ação",
  old_email: "E-mail anterior",
  new_email: "Novo e-mail",
  actor_id: "Ator",
  actor_email: "E-mail do ator",
  target_id: "Alvo",
  target_email: "E-mail do alvo",
  // Despesas
  valor_total: "Valor total",
  valor_pago: "Valor pago",
  valor_previsto: "Valor previsto",
  data_competencia: "Competência",
  data_vencimento: "Vencimento",
  data_pagamento: "Pagamento",
  forma_pagamento: "Forma de pagamento",
  numero_documento: "Nº documento",
  observacao: "Observação",
  codigo: "Código",
  banco: "Banco",
  agencia: "Agência",
  conta: "Conta",
  centro_custo_id: "Centro de custo",
  plano_conta_id: "Plano de conta",
  subcategoria_id: "Subcategoria",
  conta_bancaria_id: "Conta bancária",
  pessoa_id: "Pessoa",
  imovel_id: "Imóvel",
  veiculo_id: "Veículo",
  repasse_id: "Repasse",
  recorrencia_id: "Recorrência",
  serie_id: "Série",
  periodicidade: "Periodicidade",
  horizonte_meses: "Horizonte (meses)",
  iptu: "IPTU",
  tcr: "TCR",
  spu: "SPU",
  parcelas: "Parcelas",
  proprietario_id: "Proprietário",
  locatario_id: "Locatário",
  motorista_id: "Motorista",
  situacao: "Situação",
  endereco: "Endereço",
  modelo: "Modelo",
  placa: "Placa",
  renavam: "Renavam",
  chassi: "Chassi",
  ano: "Ano",
  valor_anual: "Valor anual",
  vencimento_primeira_parcela: "1ª parcela",
  nivel: "Nível",
  aba: "Aba",
};

// Tradução de valores específicos por campo
const valueLabels: Record<string, Record<string, string>> = {
  role: {
    super_admin: "Super Administrador",
    admin: "Administrador",
    manager: "Gerente",
    supervisor: "Supervisor",
    collaborator: "Colaborador",
  },
  system_name: {
    escalas: "Escalas",
    vendas: "Vendas",
    estoque: "Estoques",
    ferias: "Férias e Folgas",
    sistema: "Sistema",
  },
  reason: {
    user_deactivated: "Usuário desativado",
    user_reactivated: "Usuário reativado",
    user_deleted: "Usuário removido",
    password_reset: "Senha redefinida",
  },
  tipo: {
    a_pagar: "A pagar",
    a_receber: "A receber",
  },
  status: {
    a_vencer: "A vencer",
    vencido: "Vencido",
    pago: "Pago",
    parcial: "Parcialmente pago",
    cancelado: "Cancelado",
  },
  forma_pagamento: {
    pix: "PIX",
    boleto: "Boleto",
    dinheiro: "Dinheiro",
    cartao: "Cartão",
    transferencia: "Transferência",
    cheque: "Cheque",
  },
  situacao: {
    alugado: "Alugado",
    vago: "Vago",
    proprio: "Próprio",
    obra: "Em obra",
    vendido: "Vendido",
  },
  periodicidade: {
    mensal: "Mensal",
    anual: "Anual",
    meses_fixos: "Meses fixos",
    intercalada: "Intercalada",
  },
  nivel: {
    sem_acesso: "Sem acesso",
    view: "Visualizar",
    edit: "Editar",
    delete: "Excluir",
  },
  aba: {
    calendario: "Calendário",
    recorrencias: "Recorrências",
    imoveis: "Imóveis",
    repasses: "Repasses",
    veiculos: "Veículos",
    cadastros: "Cadastros",
    relatorios: "Relatórios",
    permissoes: "Permissões",
    auditoria: "Auditoria",
  },
};

// Campos técnicos a esconder em INSERT/DELETE expandido
const HIDDEN_FIELDS = new Set([
  "id", "created_at", "updated_at", "created_by",
]);

const formatFieldLabel = (field: string) => fieldLabels[field] || field;

const ACTION_KEYWORDS: Record<string, string[]> = {
  INSERT: ["inseriu", "inserir", "adicionou", "adicionar", "criou", "criar", "cadastrou", "cadastrar", "novo", "nova"],
  UPDATE: ["alterou", "alterar", "atualizou", "atualizar", "editou", "editar", "modificou", "modificar", "mudou", "mudar"],
  DELETE: ["excluiu", "excluir", "removeu", "remover", "deletou", "deletar", "apagou", "apagar"],
};

const matchActionFromTerm = (term: string): string | null => {
  const lower = term.toLowerCase();
  for (const [action, keywords] of Object.entries(ACTION_KEYWORDS)) {
    if (keywords.some(k => k.startsWith(lower) || lower.startsWith(k))) return action;
  }
  return null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// =====================================================================
// Cache global de lookups (id -> nome) carregado uma vez por sessão
// =====================================================================
type LookupMap = Map<string, string>;
const lookupCaches: Record<string, LookupMap | "loading" | undefined> = {};
const lookupListeners: Set<() => void> = new Set();

async function loadLookup(table: string, nameCol: string): Promise<LookupMap> {
  if (lookupCaches[table] && lookupCaches[table] !== "loading") {
    return lookupCaches[table] as LookupMap;
  }
  if (lookupCaches[table] === "loading") {
    return new Map();
  }
  lookupCaches[table] = "loading";
  try {
    const { data } = await (supabase as any)
      .from(table)
      .select(`id, ${nameCol}`)
      .limit(5000);
    const map: LookupMap = new Map();
    (data || []).forEach((r: any) => {
      if (r?.id && r?.[nameCol]) map.set(r.id, String(r[nameCol]));
    });
    lookupCaches[table] = map;
    lookupListeners.forEach(l => l());
    return map;
  } catch {
    const empty: LookupMap = new Map();
    lookupCaches[table] = empty;
    return empty;
  }
}

// Lookup especial para perfis de usuário: indexa por user_id (não pelo id da
// tabela user_profiles) e cai para o e-mail quando o nome estiver vazio.
async function loadUserProfilesLookup(): Promise<LookupMap> {
  const key = "user_profiles";
  if (lookupCaches[key] && lookupCaches[key] !== "loading") {
    return lookupCaches[key] as LookupMap;
  }
  if (lookupCaches[key] === "loading") return new Map();
  lookupCaches[key] = "loading";
  try {
    const { data } = await (supabase as any)
      .from("user_profiles")
      .select("user_id, name, email")
      .limit(5000);
    const map: LookupMap = new Map();
    (data || []).forEach((r: any) => {
      if (r?.user_id) {
        const label = (r.name && String(r.name).trim()) || r.email || "";
        if (label) map.set(r.user_id, String(label));
      }
    });
    lookupCaches[key] = map;
    lookupListeners.forEach(l => l());
    return map;
  } catch {
    const empty: LookupMap = new Map();
    lookupCaches[key] = empty;
    return empty;
  }
}

function useLookups() {
  const [, force] = useState(0);
  useEffect(() => {
    const listener = () => force(n => n + 1);
    lookupListeners.add(listener);
    // pré-carrega tabelas comuns de FK
    loadLookup("ferias_colaboradores", "nome");
    loadLookup("ferias_setores", "nome");
    loadLookup("ferias_unidades", "nome");
    loadLookup("ferias_cargos", "nome");
    loadLookup("ferias_equipes", "nome");
    loadLookup("brokers", "name");
    loadLookup("estoque_materiais", "nome");
    loadLookup("estoque_locais_armazenamento", "nome");
    loadUserProfilesLookup();
    return () => { lookupListeners.delete(listener); };
  }, []);

  const resolve = useCallback((field: string, value: unknown): string | null => {
    if (typeof value !== "string" || !UUID_RE.test(value)) return null;
    const tableByField: Record<string, [string, string]> = {
      colaborador_id: ["ferias_colaboradores", "nome"],
      colaborador1_id: ["ferias_colaboradores", "nome"],
      colaborador2_id: ["ferias_colaboradores", "nome"],
      familiar_id: ["ferias_colaboradores", "nome"],
      setor_titular_id: ["ferias_setores", "nome"],
      setor_id: ["ferias_setores", "nome"],
      unidade_id: ["ferias_unidades", "nome"],
      cargo_id: ["ferias_cargos", "nome"],
      equipe_id: ["ferias_equipes", "nome"],
      broker_id: ["brokers", "name"],
      material_id: ["estoque_materiais", "nome"],
      local_origem_id: ["estoque_locais_armazenamento", "nome"],
      local_destino_id: ["estoque_locais_armazenamento", "nome"],
      local_armazenamento_id: ["estoque_locais_armazenamento", "nome"],
      user_id: ["user_profiles", "name"],
      actor_id: ["user_profiles", "name"],
      target_id: ["user_profiles", "name"],
      granted_by: ["user_profiles", "name"],
      changed_by: ["user_profiles", "name"],
      recebido_por_user_id: ["user_profiles", "name"],
      responsavel_user_id: ["user_profiles", "name"],
    };
    const tuple = tableByField[field];
    if (!tuple) return null;
    const cache = lookupCaches[tuple[0]];
    if (cache && cache !== "loading") return cache.get(value) || null;
    return null;
  }, []);

  const userName = useCallback((userId: string | null): string | null => {
    if (!userId) return null;
    const cache = lookupCaches["user_profiles"];
    if (cache && cache !== "loading") return cache.get(userId) || null;
    return null;
  }, []);

  return { resolve, userName };
}

// Normaliza string para busca: lowercase + remove acentos
const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Coleta UUIDs cujos nomes batem com o termo, em todos os caches de lookup.
// Retorna { recordIds, userIds } limitados a 200 cada para não estourar URL.
function collectMatchingUuids(term: string): { recordIds: string[]; userIds: string[] } {
  const t = normalize(term);
  if (!t) return { recordIds: [], userIds: [] };
  const recordIds: string[] = [];
  const userIds: string[] = [];
  for (const [table, cache] of Object.entries(lookupCaches)) {
    if (!cache || cache === "loading") continue;
    for (const [id, name] of cache.entries()) {
      if (normalize(name).includes(t)) {
        if (table === "user_profiles") {
          if (userIds.length < 200) userIds.push(id);
        } else {
          if (recordIds.length < 200) recordIds.push(id);
        }
      }
      if (recordIds.length >= 200 && userIds.length >= 200) break;
    }
  }
  return { recordIds, userIds };
}

// Diff entre old_data e new_data ignorando campos técnicos / sem alteração real
const TIMESTAMP_FIELDS = new Set(["updated_at", "created_at"]);
function computeChangedFields(oldData: unknown, newData: unknown): string[] {
  const o = (oldData as Record<string, unknown>) || {};
  const n = (newData as Record<string, unknown>) || {};
  const keys = new Set([...Object.keys(o), ...Object.keys(n)]);
  const changed: string[] = [];
  for (const k of keys) {
    if (HIDDEN_FIELDS.has(k)) continue;
    const a = o[k];
    const b = n[k];
    if (a === b) continue;
    if (a == null && b == null) continue;
    try {
      if (JSON.stringify(a) === JSON.stringify(b)) continue;
    } catch {
      // se não serializa, considera mudado
    }
    changed.push(k);
  }
  return changed;
}

// Resumo curto para INSERT/DELETE com 3-4 campos relevantes
const INSERT_SUMMARY_FIELDS = ["nome", "nome_exibicao", "status", "data_admissao", "data_inicio", "data_sabado", "data_fim", "tipo", "motivo"];
// Campos extras usados para gerar resumos legíveis em Despesas.
const INSERT_SUMMARY_FIELDS_EXTRA = ["descricao", "valor_total", "data_vencimento", "codigo"];
const ALL_INSERT_SUMMARY_FIELDS = [...INSERT_SUMMARY_FIELDS, ...INSERT_SUMMARY_FIELDS_EXTRA];
function buildInsertDeleteSummary(action: "INSERT" | "DELETE", data: Record<string, unknown> | null, resolve: (f: string, v: unknown) => string | null): string {
  if (!data) return action === "INSERT" ? "Registro criado" : "Registro removido";
  const parts: string[] = [];
  for (const k of ALL_INSERT_SUMMARY_FIELDS) {
    if (parts.length >= 4) break;
    const v = data[k];
    if (v == null || v === "") continue;
    parts.push(`${formatFieldLabel(k)}: ${formatFieldValue(v, k, resolve)}`);
  }
  if (parts.length === 0) return action === "INSERT" ? "Registro criado" : "Registro removido";
  return (action === "INSERT" ? "Cadastrou — " : "Removeu — ") + parts.join("; ");
}

const formatFieldValue = (val: unknown, field?: string, resolve?: (f: string, v: unknown) => string | null): string => {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "boolean") return val ? "Sim" : "Não";
  if (Array.isArray(val)) return val.length === 0 ? "—" : val.map(v => formatFieldValue(v, field, resolve)).join(", ");
  if (typeof val === "string") {
    if (field && valueLabels[field]?.[val]) return valueLabels[field][val];
    if (field && resolve) {
      const resolved = resolve(field, val);
      if (resolved) return resolved;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      try { return format(new Date(val + "T00:00:00"), "dd/MM/yyyy"); } catch { return val; }
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(val)) {
      try { return format(new Date(val), "dd/MM/yyyy HH:mm"); } catch { return val; }
    }
    if (UUID_RE.test(val)) return val.slice(0, 8) + "…";
    return val;
  }
  if (typeof val === "object") {
    try { return JSON.stringify(val); } catch { return String(val); }
  }
  return String(val);
};

const getRecordLabel = (log: ModuleAuditLog, resolve: (f: string, v: unknown) => string | null): string => {
  const data = (log.new_data || log.old_data) as Record<string, unknown> | null;
  if (!data) return log.record_id?.slice(0, 8) || "—";
  const nome = (data.nome || data.nome_exibicao || data.name || data.titulo) as string | undefined;
  if (nome) return nome;
  // Registros de sistema (user_roles, system_access, user_profiles) — resolver pelo usuário
  if (data.user_id) {
    const u = resolve("user_id", data.user_id);
    if (u) {
      if (log.table_name === "system_access" && data.system_name) {
        const sys = valueLabels.system_name?.[String(data.system_name)] || String(data.system_name);
        return `${u} — ${sys}`;
      }
      if (log.table_name === "user_roles" && data.role) {
        const r = valueLabels.role?.[String(data.role)] || String(data.role);
        return `${u} — ${r}`;
      }
      return u;
    }
  }
  // tentar resolver pelo colaborador_id
  if (data.colaborador_id) {
    const r = resolve("colaborador_id", data.colaborador_id);
    if (r) return r;
  }
  if (data.material_id) {
    const r = resolve("material_id", data.material_id);
    if (r) return r;
  }
  const dataSab = data.data_sabado as string | undefined;
  if (dataSab) return `Sábado ${formatFieldValue(dataSab)}`;
  const inicio = data.data_inicio as string | undefined;
  if (inicio) return `A partir de ${formatFieldValue(inicio)}`;
  return (log.record_id || "—").slice(0, 8);
};

interface AuditLogsPanelProps {
  defaultModule?: "escalas" | "vendas" | "estoque" | "ferias" | "sistema" | "all";
  defaultTab?: "admin" | "modules";
  showAdminTab?: boolean;
}

// Debounce hook simples
function useDebounced<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t: ReturnType<typeof setTimeout> = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

// =====================================================================
// Tabela de logs de módulos (server-side paginada + busca)
// =====================================================================
function ModuleLogsTable({ defaultModule }: { defaultModule: AuditLogsPanelProps["defaultModule"] }) {
  const { resolve, userName } = useLookups();

  const [moduleFilter, setModuleFilter] = useState<string>(defaultModule || "all");
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput, 350);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [logs, setLogs] = useState<ModuleAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [refreshTick, setRefreshTick] = useState(0);

  // Refaz a query quando algum cache de lookup termina de carregar
  // (relevante para a busca por nome, que depende dos caches).
  useEffect(() => {
    const listener = () => setRefreshTick(t => t + 1);
    lookupListeners.add(listener);
    return () => { lookupListeners.delete(listener); };
  }, []);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [moduleFilter, tableFilter, actionFilter, search]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let q: any = supabase
        .from("module_audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (moduleFilter !== "all") q = q.eq("module_name", moduleFilter);
      if (tableFilter !== "all") q = q.eq("table_name", tableFilter);

      const term = search.trim();
      if (term) {
        const actionMatch = matchActionFromTerm(term);
        if (actionFilter !== "all") {
          q = q.eq("action", actionFilter);
        } else if (actionMatch) {
          q = q.eq("action", actionMatch);
        } else {
          const safe = term.replace(/[%,()]/g, " ").trim();
          const pat = `%${safe}%`;
          // Resolve o termo em UUIDs via caches em memória (nomes de
          // colaboradores, setores, unidades, materiais, etc.)
          const { recordIds, userIds } = collectMatchingUuids(safe);
          const orParts: string[] = [
            `changed_by_email.ilike.${pat}`,
            `table_name.ilike.${pat}`,
            `new_data::text.ilike.${pat}`,
            `old_data::text.ilike.${pat}`,
          ];
          if (recordIds.length > 0) {
            orParts.push(`record_id.in.(${recordIds.join(",")})`);
          }
          if (userIds.length > 0) {
            orParts.push(`changed_by.in.(${userIds.join(",")})`);
          }
          q = q.or(orParts.join(","));
        }
      } else if (actionFilter !== "all") {
        q = q.eq("action", actionFilter);
      }

      q = q.range(from, to);
      const { data, error, count } = await q;
      if (error) {
        // fallback caso o cast jsonb::text não seja aceito
        if (term) {
          let q2: any = supabase
            .from("module_audit_logs")
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false });
          if (moduleFilter !== "all") q2 = q2.eq("module_name", moduleFilter);
          if (tableFilter !== "all") q2 = q2.eq("table_name", tableFilter);
          const safe = term.replace(/[%,()]/g, " ").trim();
          const pat = `%${safe}%`;
          q2 = q2.or(`changed_by_email.ilike.${pat},table_name.ilike.${pat}`).range(from, to);
          const r2 = await q2;
          setLogs(r2.data || []);
          setTotal(r2.count || 0);
        } else {
          throw error;
        }
      } else {
        setLogs(data || []);
        setTotal(count || 0);
      }
    } catch (e) {
      console.error("Audit fetch error:", e);
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [moduleFilter, tableFilter, actionFilter, search, page, pageSize, refreshTick]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Carrega lista de tabelas existentes para o filtro (do módulo atual)
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      let q: any = supabase.from("module_audit_logs").select("table_name").limit(1000);
      if (moduleFilter !== "all") q = q.eq("module_name", moduleFilter);
      const { data } = await q;
      const set = new Set<string>((data || []).map((r: any) => r.table_name));
      setAvailableTables(Array.from(set).sort());
    })();
  }, [moduleFilter, refreshTick]);

  const toggleRow = (id: string) => {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por usuário, ação, campo ou conteúdo…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Módulo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os módulos</SelectItem>
              <SelectItem value="escalas">Escalas</SelectItem>
              <SelectItem value="vendas">Vendas</SelectItem>
              <SelectItem value="estoque">Estoques</SelectItem>
              <SelectItem value="ferias">Férias e Folgas</SelectItem>
              <SelectItem value="sistema">Sistema</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Select value={tableFilter} onValueChange={setTableFilter}>
          <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Tabela" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as tabelas</SelectItem>
            {availableTables.map(t => (
              <SelectItem key={t} value={t}>{tableLabels[t] || t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Ação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            <SelectItem value="INSERT">Inseriu</SelectItem>
            <SelectItem value="UPDATE">Atualizou</SelectItem>
            <SelectItem value="DELETE">Removeu</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-9" onClick={() => setRefreshTick(t => t + 1)}>
          <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          {loading ? "Carregando…" : `${total.toLocaleString("pt-BR")} registro${total === 1 ? "" : "s"}`}
        </span>
      </div>

      <ScrollArea className="h-[640px] border rounded-md">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead className="w-[150px]">Data/Hora</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead className="w-[110px]">Ação</TableHead>
              <TableHead className="w-[120px]">Módulo</TableHead>
              <TableHead className="w-[180px]">Tabela</TableHead>
              <TableHead>Registro</TableHead>
              <TableHead>Resumo da alteração</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
            ) : logs.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Nenhum registro encontrado</TableCell></TableRow>
            ) : logs.map(log => {
              const isOpen = expanded.has(log.id);
              const userDisplay = userName(log.changed_by) || log.changed_by_email || "Sistema";
              const rawFields = (log.changed_fields && log.changed_fields.length > 0)
                ? log.changed_fields
                : computeChangedFields(log.old_data, log.new_data);
              const fields = rawFields.filter(f => !HIDDEN_FIELDS.has(f));
              const realFields = fields.filter(f => !TIMESTAMP_FIELDS.has(f));
              const summaryFields = realFields.slice(0, 6).map(formatFieldLabel).join(", ");
              let summaryText: string;
              if (log.action === "INSERT") {
                summaryText = buildInsertDeleteSummary("INSERT", log.new_data as any, resolve);
              } else if (log.action === "DELETE") {
                summaryText = buildInsertDeleteSummary("DELETE", log.old_data as any, resolve);
              } else if (realFields.length > 0) {
                summaryText = "Alterou — " + summaryFields;
              } else if (fields.length > 0) {
                summaryText = "Apenas timestamp atualizado";
              } else {
                summaryText = "—";
              }
              return (
                <Collapsible key={log.id} asChild open={isOpen}>
                  <>
                    <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRow(log.id)}>
                      <TableCell>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </CollapsibleTrigger>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{userDisplay}</span>
                          {log.changed_by_email && userDisplay !== log.changed_by_email && (
                            <span className="text-xs text-muted-foreground">{log.changed_by_email}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell><Badge className={actionColors[log.action] || "bg-secondary"}>{actionLabels[log.action] || log.action}</Badge></TableCell>
                      <TableCell><Badge variant="outline">{moduleLabels[log.module_name] || log.module_name}</Badge></TableCell>
                      <TableCell className="text-sm">{tableLabels[log.table_name] || log.table_name}</TableCell>
                      <TableCell className="text-sm font-medium">{getRecordLabel(log, resolve)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[320px] truncate" title={summaryText}>
                        {summaryText}
                      </TableCell>
                    </TableRow>
                    <CollapsibleContent asChild>
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={8} className="py-4">
                          <ExpandedDetails log={log} resolve={resolve} />
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>

      <TablePagination
        currentPage={page}
        totalPages={totalPages}
        itemsPerPage={pageSize}
        onPageChange={setPage}
        onItemsPerPageChange={(n) => { setPageSize(n); setPage(1); }}
        totalItems={total}
      />
    </div>
  );
}

function ExpandedDetails({ log, resolve }: { log: ModuleAuditLog; resolve: (f: string, v: unknown) => string | null }) {
  const old = (log.old_data as Record<string, unknown>) || {};
  const neu = (log.new_data as Record<string, unknown>) || {};

  if (log.action === "UPDATE") {
    const raw = (log.changed_fields && log.changed_fields.length > 0)
      ? log.changed_fields
      : computeChangedFields(log.old_data, log.new_data);
    const fields = raw.filter(f => !HIDDEN_FIELDS.has(f));
    const realFields = fields.filter(f => !TIMESTAMP_FIELDS.has(f));
    if (realFields.length === 0) {
      return (
        <div className="text-sm text-muted-foreground">
          {fields.length > 0 ? "Apenas o timestamp foi atualizado." : "Sem campos alterados."}
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <div className="text-sm font-semibold">Campos alterados</div>
        <div className="space-y-1">
          {realFields.map(field => (
            <div key={field} className="flex flex-wrap items-start gap-2 p-2 bg-background rounded border">
              <span className="font-medium text-sm min-w-[180px]">{formatFieldLabel(field)}</span>
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-700 dark:text-red-300 line-through">
                  {formatFieldValue(old[field], field, resolve)}
                </span>
                <span className="text-muted-foreground">→</span>
                <span className="px-2 py-0.5 rounded bg-green-500/15 text-green-700 dark:text-green-300">
                  {formatFieldValue(neu[field], field, resolve)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const data = log.action === "DELETE" ? old : neu;
  const entries = Object.entries(data).filter(([k, v]) => !HIDDEN_FIELDS.has(k) && v !== null && v !== "" && v !== undefined);
  const title = log.action === "INSERT" ? "Valores cadastrados" : log.action === "DELETE" ? "Valores removidos" : "Detalhes";
  const tone = log.action === "INSERT" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";

  if (entries.length === 0) {
    return <div className="text-sm text-muted-foreground">Sem detalhes adicionais.</div>;
  }

  return (
    <div className="space-y-2">
      <div className={`text-sm font-semibold ${tone}`}>{title}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-start gap-2 p-2 bg-background rounded border text-xs">
            <span className="font-medium min-w-[150px]">{formatFieldLabel(k)}</span>
            <span className="text-foreground break-all">{formatFieldValue(v, k, resolve)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================================
// Tabela de logs administrativos (server-side paginada + busca)
// =====================================================================
function AdminLogsTable() {
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput, 350);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => { setPage(1); }, [actionFilter, search]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        let q: any = supabase.from("admin_audit_logs").select("*", { count: "exact" }).order("created_at", { ascending: false });
        if (actionFilter !== "all") q = q.eq("action", actionFilter);
        const term = search.trim();
        if (term) {
          const safe = term.replace(/[%,()]/g, " ").trim();
          const pat = `%${safe}%`;
          q = q.or(
            [
              `actor_email.ilike.${pat}`,
              `actor_name.ilike.${pat}`,
              `target_email.ilike.${pat}`,
              `target_name.ilike.${pat}`,
            ].join(",")
          );
        }
        q = q.range(from, to);
        const { data, count, error } = await q;
        if (error) throw error;
        setLogs(data || []);
        setTotal(count || 0);
      } catch (e) {
        console.error(e);
        setLogs([]); setTotal(0);
      } finally { setLoading(false); }
    })();
  }, [search, actionFilter, page, pageSize, refreshTick]);

  const toggle = (id: string) => setExpanded(p => {
    const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Buscar por nome ou email…" className="pl-9" />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            <SelectItem value="deactivate">Desativar</SelectItem>
            <SelectItem value="reactivate">Reativar</SelectItem>
            <SelectItem value="delete">Remover</SelectItem>
            <SelectItem value="update_email">Alterar email</SelectItem>
            <SelectItem value="update_password">Alterar senha</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-9" onClick={() => setRefreshTick(t => t + 1)}>
          <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          {loading ? "Carregando…" : `${total.toLocaleString("pt-BR")} registro${total === 1 ? "" : "s"}`}
        </span>
      </div>

      <ScrollArea className="h-[640px] border rounded-md">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead className="w-[150px]">Data/Hora</TableHead>
              <TableHead>Ator</TableHead>
              <TableHead className="w-[160px]">Ação</TableHead>
              <TableHead>Alvo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
            ) : logs.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nenhum registro encontrado</TableCell></TableRow>
            ) : logs.map(log => {
              const isOpen = expanded.has(log.id);
              return (
                <Collapsible key={log.id} asChild open={isOpen}>
                  <>
                    <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggle(log.id)}>
                      <TableCell><CollapsibleTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6">{isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button></CollapsibleTrigger></TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                      <TableCell><div className="flex flex-col"><span className="text-sm font-medium">{log.actor_name || "—"}</span><span className="text-xs text-muted-foreground">{log.actor_email}</span></div></TableCell>
                      <TableCell><Badge className={actionColors[log.action] || "bg-secondary"}>{actionLabels[log.action] || log.action}</Badge></TableCell>
                      <TableCell><div className="flex flex-col"><span className="text-sm font-medium">{log.target_name || "—"}</span><span className="text-xs text-muted-foreground">{log.target_email}</span></div></TableCell>
                    </TableRow>
                    <CollapsibleContent asChild>
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={5} className="py-3">
                          {log.details && Object.keys(log.details as any).length > 0 ? (
                            <div className="space-y-1">
                              <div className="text-sm font-semibold">Detalhes</div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                                {Object.entries(log.details as Record<string, unknown>).map(([k, v]) => (
                                  <div key={k} className="flex items-start gap-2 p-2 bg-background rounded border text-xs">
                                    <span className="font-medium min-w-[140px]">{formatFieldLabel(k)}</span>
                                    <span className="break-all">{formatFieldValue(v)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : <div className="text-sm text-muted-foreground">Sem detalhes adicionais.</div>}
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>

      <TablePagination
        currentPage={page}
        totalPages={totalPages}
        itemsPerPage={pageSize}
        onPageChange={setPage}
        onItemsPerPageChange={(n) => { setPageSize(n); setPage(1); }}
        totalItems={total}
      />
    </div>
  );
}

export function AuditLogsPanel({ defaultModule = "all", defaultTab = "modules", showAdminTab = true }: AuditLogsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Logs de Auditoria</CardTitle>
        <CardDescription>Histórico completo de alterações — quem fez, o quê, quando e em qual campo.</CardDescription>
      </CardHeader>
      <CardContent>
        {showAdminTab ? (
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="admin" className="flex items-center gap-2"><Shield className="h-4 w-4" /> Ações Administrativas</TabsTrigger>
              <TabsTrigger value="modules" className="flex items-center gap-2"><User className="h-4 w-4" /> Alterações nos Módulos</TabsTrigger>
            </TabsList>
            <TabsContent value="admin"><AdminLogsTable /></TabsContent>
            <TabsContent value="modules"><ModuleLogsTable defaultModule={defaultModule} /></TabsContent>
          </Tabs>
        ) : (
          <ModuleLogsTable defaultModule={defaultModule} />
        )}
      </CardContent>
    </Card>
  );
}
