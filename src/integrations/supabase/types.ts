export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          actor_name: string | null
          created_at: string | null
          details: Json | null
          id: string
          target_email: string | null
          target_id: string | null
          target_name: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          target_email?: string | null
          target_id?: string | null
          target_name?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          target_email?: string | null
          target_id?: string | null
          target_name?: string | null
        }
        Relationships: []
      }
      assignment_history_monthly: {
        Row: {
          afternoon_count: number | null
          broker_id: string | null
          broker_name: string
          city: string | null
          created_at: string | null
          id: string
          location_id: string | null
          location_name: string
          location_type: string | null
          morning_count: number | null
          total_assignments: number | null
          updated_at: string | null
          year_month: string
        }
        Insert: {
          afternoon_count?: number | null
          broker_id?: string | null
          broker_name: string
          city?: string | null
          created_at?: string | null
          id?: string
          location_id?: string | null
          location_name: string
          location_type?: string | null
          morning_count?: number | null
          total_assignments?: number | null
          updated_at?: string | null
          year_month: string
        }
        Update: {
          afternoon_count?: number | null
          broker_id?: string | null
          broker_name?: string
          city?: string | null
          created_at?: string | null
          id?: string
          location_id?: string | null
          location_name?: string
          location_type?: string | null
          morning_count?: number | null
          total_assignments?: number | null
          updated_at?: string | null
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_history_monthly_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_history_monthly_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_evaluations: {
        Row: {
          acoes_melhorias_c2s: string | null
          average_score: number | null
          broker_id: string
          c2s_agendamento_chaves: number | null
          c2s_agendamento_sem_chaves: number | null
          c2s_atende_rapido: number | null
          c2s_atualiza_atividades: number | null
          c2s_bolsao: number | null
          c2s_cadastra_proposta: number | null
          c2s_cliente_potencial: number | null
          c2s_cliente_remanejado: number | null
          c2s_etiqueta_construtora: number | null
          c2s_feedback_visita: number | null
          c2s_insere_etiquetas: number | null
          c2s_justifica_arquivamento: number | null
          c2s_negocio_fechado: number | null
          c2s_perfil_cliente: number | null
          classification: string | null
          created_at: string | null
          desempenho_contratos: number | null
          desempenho_propostas: number | null
          desempenho_visitas: number | null
          evaluated_by: string
          feedback: string | null
          id: string
          is_launch: boolean | null
          metas_acoes_futuras: string | null
          obs_feedbacks: string | null
          previous_average: number | null
          updated_at: string | null
          year_month: string
        }
        Insert: {
          acoes_melhorias_c2s?: string | null
          average_score?: number | null
          broker_id: string
          c2s_agendamento_chaves?: number | null
          c2s_agendamento_sem_chaves?: number | null
          c2s_atende_rapido?: number | null
          c2s_atualiza_atividades?: number | null
          c2s_bolsao?: number | null
          c2s_cadastra_proposta?: number | null
          c2s_cliente_potencial?: number | null
          c2s_cliente_remanejado?: number | null
          c2s_etiqueta_construtora?: number | null
          c2s_feedback_visita?: number | null
          c2s_insere_etiquetas?: number | null
          c2s_justifica_arquivamento?: number | null
          c2s_negocio_fechado?: number | null
          c2s_perfil_cliente?: number | null
          classification?: string | null
          created_at?: string | null
          desempenho_contratos?: number | null
          desempenho_propostas?: number | null
          desempenho_visitas?: number | null
          evaluated_by: string
          feedback?: string | null
          id?: string
          is_launch?: boolean | null
          metas_acoes_futuras?: string | null
          obs_feedbacks?: string | null
          previous_average?: number | null
          updated_at?: string | null
          year_month: string
        }
        Update: {
          acoes_melhorias_c2s?: string | null
          average_score?: number | null
          broker_id?: string
          c2s_agendamento_chaves?: number | null
          c2s_agendamento_sem_chaves?: number | null
          c2s_atende_rapido?: number | null
          c2s_atualiza_atividades?: number | null
          c2s_bolsao?: number | null
          c2s_cadastra_proposta?: number | null
          c2s_cliente_potencial?: number | null
          c2s_cliente_remanejado?: number | null
          c2s_etiqueta_construtora?: number | null
          c2s_feedback_visita?: number | null
          c2s_insere_etiquetas?: number | null
          c2s_justifica_arquivamento?: number | null
          c2s_negocio_fechado?: number | null
          c2s_perfil_cliente?: number | null
          classification?: string | null
          created_at?: string | null
          desempenho_contratos?: number | null
          desempenho_propostas?: number | null
          desempenho_visitas?: number | null
          evaluated_by?: string
          feedback?: string | null
          id?: string
          is_launch?: boolean | null
          metas_acoes_futuras?: string | null
          obs_feedbacks?: string | null
          previous_average?: number | null
          updated_at?: string | null
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_evaluations_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "sales_brokers"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_goals: {
        Row: {
          broker_id: string
          created_at: string | null
          created_by: string
          id: string
          target_vgv: number
          updated_at: string | null
          year_month: string
        }
        Insert: {
          broker_id: string
          created_at?: string | null
          created_by: string
          id?: string
          target_vgv?: number
          updated_at?: string | null
          year_month: string
        }
        Update: {
          broker_id?: string
          created_at?: string | null
          created_by?: string
          id?: string
          target_vgv?: number
          updated_at?: string | null
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_goals_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "sales_brokers"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_monthly_proposals: {
        Row: {
          broker_id: string
          created_at: string | null
          created_by: string
          id: string
          proposals_converted: number
          proposals_count: number
          updated_at: string | null
          year_month: string
        }
        Insert: {
          broker_id: string
          created_at?: string | null
          created_by: string
          id?: string
          proposals_converted?: number
          proposals_count?: number
          updated_at?: string | null
          year_month: string
        }
        Update: {
          broker_id?: string
          created_at?: string | null
          created_by?: string
          id?: string
          proposals_converted?: number
          proposals_count?: number
          updated_at?: string | null
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_monthly_proposals_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "sales_brokers"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_weekly_stats: {
        Row: {
          broker_id: string
          created_at: string | null
          external_count: number | null
          id: string
          internal_count: number | null
          saturday_count: number | null
          updated_at: string | null
          week_end: string
          week_start: string
        }
        Insert: {
          broker_id: string
          created_at?: string | null
          external_count?: number | null
          id?: string
          internal_count?: number | null
          saturday_count?: number | null
          updated_at?: string | null
          week_end: string
          week_start: string
        }
        Update: {
          broker_id?: string
          created_at?: string | null
          external_count?: number | null
          id?: string
          internal_count?: number | null
          saturday_count?: number | null
          updated_at?: string | null
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_weekly_stats_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
        ]
      }
      brokers: {
        Row: {
          available_weekdays: string[] | null
          created_at: string | null
          creci: string
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
          weekday_shift_availability: Json | null
        }
        Insert: {
          available_weekdays?: string[] | null
          created_at?: string | null
          creci: string
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
          weekday_shift_availability?: Json | null
        }
        Update: {
          available_weekdays?: string[] | null
          created_at?: string | null
          creci?: string
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
          weekday_shift_availability?: Json | null
        }
        Relationships: []
      }
      despesas_aba_permissoes: {
        Row: {
          aba: string
          created_at: string
          id: string
          nivel: string
          updated_at: string
          user_id: string
        }
        Insert: {
          aba: string
          created_at?: string
          id?: string
          nivel?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          aba?: string
          created_at?: string
          id?: string
          nivel?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      despesas_categorias: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          nome: string
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          nome: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          nome?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      despesas_centros_custo: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          is_active: boolean
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          is_active?: boolean
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          is_active?: boolean
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      despesas_centros_custo_permissoes: {
        Row: {
          centro_custo_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          centro_custo_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          centro_custo_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "despesas_centros_custo_permissoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "despesas_centros_custo"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas_contas_bancarias: {
        Row: {
          agencia: string | null
          banco: string | null
          centro_custo_id: string | null
          created_at: string
          id: string
          is_active: boolean
          nome: string
          numero_conta: string | null
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          banco?: string | null
          centro_custo_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          nome: string
          numero_conta?: string | null
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          banco?: string | null
          centro_custo_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          nome?: string
          numero_conta?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "despesas_contas_bancarias_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "despesas_centros_custo"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas_imoveis: {
        Row: {
          area_total: number | null
          bairro: string | null
          centro_custo_id: string
          cep: string | null
          cidade: string | null
          codigo: string | null
          complemento: string | null
          created_at: string
          created_by: string | null
          data_aquisicao: string | null
          data_venda: string | null
          descricao: string
          endereco: string | null
          id: string
          inquilino_id: string | null
          inscricao_municipal: string | null
          is_active: boolean
          matricula: string | null
          numero: string | null
          observacao: string | null
          proprietario_id: string | null
          situacao: string
          taxa_administracao_pct: number | null
          tipo: string
          uf: string | null
          updated_at: string
          valor_aluguel: number | null
        }
        Insert: {
          area_total?: number | null
          bairro?: string | null
          centro_custo_id: string
          cep?: string | null
          cidade?: string | null
          codigo?: string | null
          complemento?: string | null
          created_at?: string
          created_by?: string | null
          data_aquisicao?: string | null
          data_venda?: string | null
          descricao: string
          endereco?: string | null
          id?: string
          inquilino_id?: string | null
          inscricao_municipal?: string | null
          is_active?: boolean
          matricula?: string | null
          numero?: string | null
          observacao?: string | null
          proprietario_id?: string | null
          situacao?: string
          taxa_administracao_pct?: number | null
          tipo?: string
          uf?: string | null
          updated_at?: string
          valor_aluguel?: number | null
        }
        Update: {
          area_total?: number | null
          bairro?: string | null
          centro_custo_id?: string
          cep?: string | null
          cidade?: string | null
          codigo?: string | null
          complemento?: string | null
          created_at?: string
          created_by?: string | null
          data_aquisicao?: string | null
          data_venda?: string | null
          descricao?: string
          endereco?: string | null
          id?: string
          inquilino_id?: string | null
          inscricao_municipal?: string | null
          is_active?: boolean
          matricula?: string | null
          numero?: string | null
          observacao?: string | null
          proprietario_id?: string | null
          situacao?: string
          taxa_administracao_pct?: number | null
          tipo?: string
          uf?: string | null
          updated_at?: string
          valor_aluguel?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "despesas_imoveis_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "despesas_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_imoveis_inquilino_id_fkey"
            columns: ["inquilino_id"]
            isOneToOne: false
            referencedRelation: "despesas_pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_imoveis_proprietario_id_fkey"
            columns: ["proprietario_id"]
            isOneToOne: false
            referencedRelation: "despesas_pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas_imovel_encargos: {
        Row: {
          ativo: boolean
          categoria_id: string | null
          created_at: string
          descricao: string | null
          id: string
          imovel_id: string
          observacao: string | null
          parcelas: number
          plano_conta_id: string | null
          tipo: string
          updated_at: string
          valor_anual: number
          vencimento_primeira_parcela: string
        }
        Insert: {
          ativo?: boolean
          categoria_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          imovel_id: string
          observacao?: string | null
          parcelas?: number
          plano_conta_id?: string | null
          tipo: string
          updated_at?: string
          valor_anual: number
          vencimento_primeira_parcela: string
        }
        Update: {
          ativo?: boolean
          categoria_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          imovel_id?: string
          observacao?: string | null
          parcelas?: number
          plano_conta_id?: string | null
          tipo?: string
          updated_at?: string
          valor_anual?: number
          vencimento_primeira_parcela?: string
        }
        Relationships: [
          {
            foreignKeyName: "despesas_imovel_encargos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "despesas_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_imovel_encargos_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "despesas_imoveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_imovel_encargos_plano_conta_id_fkey"
            columns: ["plano_conta_id"]
            isOneToOne: false
            referencedRelation: "despesas_planos_conta"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas_imovel_situacao_historico: {
        Row: {
          changed_by: string | null
          created_at: string
          data: string
          id: string
          imovel_id: string
          motivo: string | null
          situacao_anterior: string | null
          situacao_nova: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          data?: string
          id?: string
          imovel_id: string
          motivo?: string | null
          situacao_anterior?: string | null
          situacao_nova: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          data?: string
          id?: string
          imovel_id?: string
          motivo?: string | null
          situacao_anterior?: string | null
          situacao_nova?: string
        }
        Relationships: [
          {
            foreignKeyName: "despesas_imovel_situacao_historico_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "despesas_imoveis"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas_lancamento_pagamentos: {
        Row: {
          conta_bancaria_id: string | null
          created_at: string
          created_by: string | null
          data_pagamento: string
          forma_pagamento: string
          id: string
          lancamento_id: string
          observacao: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          conta_bancaria_id?: string | null
          created_at?: string
          created_by?: string | null
          data_pagamento: string
          forma_pagamento: string
          id?: string
          lancamento_id: string
          observacao?: string | null
          updated_at?: string
          valor: number
        }
        Update: {
          conta_bancaria_id?: string | null
          created_at?: string
          created_by?: string | null
          data_pagamento?: string
          forma_pagamento?: string
          id?: string
          lancamento_id?: string
          observacao?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_lancamento_pagamentos_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "despesas_contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_lancamento_pagamentos_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "despesas_lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas_lancamentos: {
        Row: {
          categoria_id: string | null
          centro_custo_id: string
          conta_bancaria_id: string | null
          created_at: string
          created_by: string | null
          data_competencia: string
          data_vencimento: string
          descricao: string
          documento_numero: string | null
          id: string
          imovel_id: string | null
          is_manual: boolean
          observacao: string | null
          pessoa_id: string | null
          plano_conta_id: string | null
          referencia_numero: string | null
          referencia_numero_pasta: string | null
          referencia_numero_venda: string | null
          referencia_tipo:
            | Database["public"]["Enums"]["despesa_referencia_tipo"]
            | null
          serie_recorrencia_id: string | null
          status: string
          subcategoria_id: string | null
          tipo: string
          updated_at: string
          valor_pago: number
          valor_total: number | null
        }
        Insert: {
          categoria_id?: string | null
          centro_custo_id: string
          conta_bancaria_id?: string | null
          created_at?: string
          created_by?: string | null
          data_competencia: string
          data_vencimento: string
          descricao: string
          documento_numero?: string | null
          id?: string
          imovel_id?: string | null
          is_manual?: boolean
          observacao?: string | null
          pessoa_id?: string | null
          plano_conta_id?: string | null
          referencia_numero?: string | null
          referencia_numero_pasta?: string | null
          referencia_numero_venda?: string | null
          referencia_tipo?:
            | Database["public"]["Enums"]["despesa_referencia_tipo"]
            | null
          serie_recorrencia_id?: string | null
          status?: string
          subcategoria_id?: string | null
          tipo: string
          updated_at?: string
          valor_pago?: number
          valor_total?: number | null
        }
        Update: {
          categoria_id?: string | null
          centro_custo_id?: string
          conta_bancaria_id?: string | null
          created_at?: string
          created_by?: string | null
          data_competencia?: string
          data_vencimento?: string
          descricao?: string
          documento_numero?: string | null
          id?: string
          imovel_id?: string | null
          is_manual?: boolean
          observacao?: string | null
          pessoa_id?: string | null
          plano_conta_id?: string | null
          referencia_numero?: string | null
          referencia_numero_pasta?: string | null
          referencia_numero_venda?: string | null
          referencia_tipo?:
            | Database["public"]["Enums"]["despesa_referencia_tipo"]
            | null
          serie_recorrencia_id?: string | null
          status?: string
          subcategoria_id?: string | null
          tipo?: string
          updated_at?: string
          valor_pago?: number
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "despesas_lancamentos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "despesas_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_lancamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "despesas_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_lancamentos_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "despesas_contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_lancamentos_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "despesas_imoveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_lancamentos_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "despesas_pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_lancamentos_plano_conta_id_fkey"
            columns: ["plano_conta_id"]
            isOneToOne: false
            referencedRelation: "despesas_planos_conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_lancamentos_serie_recorrencia_id_fkey"
            columns: ["serie_recorrencia_id"]
            isOneToOne: false
            referencedRelation: "despesas_recorrencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_lancamentos_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "despesas_subcategorias"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas_lancamentos_credenciais: {
        Row: {
          credenciais: Json
          lancamento_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          credenciais?: Json
          lancamento_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          credenciais?: Json
          lancamento_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "despesas_lancamentos_credenciais_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: true
            referencedRelation: "despesas_lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas_notificacoes: {
        Row: {
          created_at: string
          dias_para_vencer: number | null
          id: string
          lancamento_id: string
          lida: boolean
          mensagem: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dias_para_vencer?: number | null
          id?: string
          lancamento_id: string
          lida?: boolean
          mensagem?: string | null
          tipo: string
          user_id: string
        }
        Update: {
          created_at?: string
          dias_para_vencer?: number | null
          id?: string
          lancamento_id?: string
          lida?: boolean
          mensagem?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "despesas_notificacoes_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "despesas_lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas_notificacoes_preferencias: {
        Row: {
          dias_antecedencia: number[]
          notificar_pagos: boolean
          notificar_vencidos: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          dias_antecedencia?: number[]
          notificar_pagos?: boolean
          notificar_vencidos?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          dias_antecedencia?: number[]
          notificar_pagos?: boolean
          notificar_vencidos?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      despesas_perfis_acesso: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          is_active: boolean
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          is_active?: boolean
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          is_active?: boolean
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      despesas_pessoas: {
        Row: {
          cpf_cnpj: string | null
          created_at: string
          creci: string | null
          email: string | null
          id: string
          is_active: boolean
          nome: string
          oab: string | null
          observacao: string | null
          papeis: string[]
          telefone: string | null
          tipo_pessoa: string
          updated_at: string
        }
        Insert: {
          cpf_cnpj?: string | null
          created_at?: string
          creci?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          nome: string
          oab?: string | null
          observacao?: string | null
          papeis?: string[]
          telefone?: string | null
          tipo_pessoa?: string
          updated_at?: string
        }
        Update: {
          cpf_cnpj?: string | null
          created_at?: string
          creci?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          nome?: string
          oab?: string | null
          observacao?: string | null
          papeis?: string[]
          telefone?: string | null
          tipo_pessoa?: string
          updated_at?: string
        }
        Relationships: []
      }
      despesas_planos_conta: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          nome: string
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          nome: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          nome?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      despesas_recorrencias: {
        Row: {
          ativo: boolean
          categoria_id: string | null
          centro_custo_id: string
          conta_bancaria_id: string | null
          created_at: string
          created_by: string | null
          data_fim: string | null
          data_inicio: string
          descricao: string
          dia_vencimento: number
          id: string
          imovel_id: string | null
          janela_geracao_meses: number
          lanc_tipo: string
          meses_fixos: number[]
          observacao: string | null
          pessoa_id: string | null
          plano_conta_id: string | null
          referencia_numero: string | null
          referencia_numero_pasta: string | null
          referencia_numero_venda: string | null
          referencia_tipo:
            | Database["public"]["Enums"]["despesa_referencia_tipo"]
            | null
          subcategoria_id: string | null
          tipo: string
          ultima_geracao_ate: string | null
          updated_at: string
          valor_total: number | null
        }
        Insert: {
          ativo?: boolean
          categoria_id?: string | null
          centro_custo_id: string
          conta_bancaria_id?: string | null
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio: string
          descricao: string
          dia_vencimento: number
          id?: string
          imovel_id?: string | null
          janela_geracao_meses?: number
          lanc_tipo: string
          meses_fixos?: number[]
          observacao?: string | null
          pessoa_id?: string | null
          plano_conta_id?: string | null
          referencia_numero?: string | null
          referencia_numero_pasta?: string | null
          referencia_numero_venda?: string | null
          referencia_tipo?:
            | Database["public"]["Enums"]["despesa_referencia_tipo"]
            | null
          subcategoria_id?: string | null
          tipo: string
          ultima_geracao_ate?: string | null
          updated_at?: string
          valor_total?: number | null
        }
        Update: {
          ativo?: boolean
          categoria_id?: string | null
          centro_custo_id?: string
          conta_bancaria_id?: string | null
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string
          descricao?: string
          dia_vencimento?: number
          id?: string
          imovel_id?: string | null
          janela_geracao_meses?: number
          lanc_tipo?: string
          meses_fixos?: number[]
          observacao?: string | null
          pessoa_id?: string | null
          plano_conta_id?: string | null
          referencia_numero?: string | null
          referencia_numero_pasta?: string | null
          referencia_numero_venda?: string | null
          referencia_tipo?:
            | Database["public"]["Enums"]["despesa_referencia_tipo"]
            | null
          subcategoria_id?: string | null
          tipo?: string
          ultima_geracao_ate?: string | null
          updated_at?: string
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "despesas_recorrencias_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "despesas_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_recorrencias_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "despesas_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_recorrencias_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "despesas_contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_recorrencias_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "despesas_imoveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_recorrencias_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "despesas_pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_recorrencias_plano_conta_id_fkey"
            columns: ["plano_conta_id"]
            isOneToOne: false
            referencedRelation: "despesas_planos_conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_recorrencias_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "despesas_subcategorias"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas_repasse_itens: {
        Row: {
          created_at: string
          descricao: string
          id: string
          imovel_id: string | null
          lancamento_id: string | null
          origem: string
          repasse_id: string
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          imovel_id?: string | null
          lancamento_id?: string | null
          origem?: string
          repasse_id: string
          tipo: string
          updated_at?: string
          valor: number
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          imovel_id?: string | null
          lancamento_id?: string | null
          origem?: string
          repasse_id?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_repasse_itens_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "despesas_imoveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_repasse_itens_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "despesas_lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_repasse_itens_repasse_id_fkey"
            columns: ["repasse_id"]
            isOneToOne: false
            referencedRelation: "despesas_repasses"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas_repasses: {
        Row: {
          centro_custo_id: string
          competencia: string
          created_at: string
          created_by: string | null
          data_pagamento: string | null
          id: string
          lancamento_pagamento_id: string | null
          observacao: string | null
          proprietario_id: string
          status: string
          taxa_administracao_valor: number
          updated_at: string
          valor_bruto: number
          valor_limite_primeiro: number | null
          valor_liquido: number
        }
        Insert: {
          centro_custo_id: string
          competencia: string
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          id?: string
          lancamento_pagamento_id?: string | null
          observacao?: string | null
          proprietario_id: string
          status?: string
          taxa_administracao_valor?: number
          updated_at?: string
          valor_bruto?: number
          valor_limite_primeiro?: number | null
          valor_liquido?: number
        }
        Update: {
          centro_custo_id?: string
          competencia?: string
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          id?: string
          lancamento_pagamento_id?: string | null
          observacao?: string | null
          proprietario_id?: string
          status?: string
          taxa_administracao_valor?: number
          updated_at?: string
          valor_bruto?: number
          valor_limite_primeiro?: number | null
          valor_liquido?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_repasses_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "despesas_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_repasses_lancamento_pagamento_id_fkey"
            columns: ["lancamento_pagamento_id"]
            isOneToOne: false
            referencedRelation: "despesas_lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_repasses_proprietario_id_fkey"
            columns: ["proprietario_id"]
            isOneToOne: false
            referencedRelation: "despesas_pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas_subcategorias: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          nome: string
          plano_conta_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          nome: string
          plano_conta_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          nome?: string
          plano_conta_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "despesas_subcategorias_plano_conta_id_fkey"
            columns: ["plano_conta_id"]
            isOneToOne: false
            referencedRelation: "despesas_planos_conta"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas_veiculo_documentos: {
        Row: {
          ativo: boolean
          categoria_id: string | null
          created_at: string
          descricao: string | null
          id: string
          observacao: string | null
          parcelas: number
          tipo: string
          updated_at: string
          valor: number
          veiculo_id: string
          vencimento_primeira_parcela: string
        }
        Insert: {
          ativo?: boolean
          categoria_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          observacao?: string | null
          parcelas?: number
          tipo: string
          updated_at?: string
          valor: number
          veiculo_id: string
          vencimento_primeira_parcela: string
        }
        Update: {
          ativo?: boolean
          categoria_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          observacao?: string | null
          parcelas?: number
          tipo?: string
          updated_at?: string
          valor?: number
          veiculo_id?: string
          vencimento_primeira_parcela?: string
        }
        Relationships: [
          {
            foreignKeyName: "despesas_veiculo_documentos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "despesas_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_veiculo_documentos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "despesas_veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas_veiculos: {
        Row: {
          centro_custo_id: string | null
          comprador_id: string | null
          created_at: string
          data_aquisicao: string | null
          data_venda: string | null
          id: string
          is_active: boolean
          modelo: string
          motorista_id: string | null
          nota_fiscal: string | null
          observacao: string | null
          placa: string | null
          proprietario_id: string | null
          updated_at: string
        }
        Insert: {
          centro_custo_id?: string | null
          comprador_id?: string | null
          created_at?: string
          data_aquisicao?: string | null
          data_venda?: string | null
          id?: string
          is_active?: boolean
          modelo: string
          motorista_id?: string | null
          nota_fiscal?: string | null
          observacao?: string | null
          placa?: string | null
          proprietario_id?: string | null
          updated_at?: string
        }
        Update: {
          centro_custo_id?: string | null
          comprador_id?: string | null
          created_at?: string
          data_aquisicao?: string | null
          data_venda?: string | null
          id?: string
          is_active?: boolean
          modelo?: string
          motorista_id?: string | null
          nota_fiscal?: string | null
          observacao?: string | null
          placa?: string | null
          proprietario_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "despesas_veiculos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "despesas_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_veiculos_comprador_id_fkey"
            columns: ["comprador_id"]
            isOneToOne: false
            referencedRelation: "despesas_pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_veiculos_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "despesas_pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_veiculos_proprietario_id_fkey"
            columns: ["proprietario_id"]
            isOneToOne: false
            referencedRelation: "despesas_pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      dev_tracker: {
        Row: {
          cost: number
          created_at: string | null
          description: string | null
          display_order: number | null
          feature_name: string
          hours: number
          id: string
          system_name: string
          updated_at: string | null
        }
        Insert: {
          cost?: number
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          feature_name: string
          hours?: number
          id?: string
          system_name: string
          updated_at?: string | null
        }
        Update: {
          cost?: number
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          feature_name?: string
          hours?: number
          id?: string
          system_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      estoque_categorias: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          is_active: boolean
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          is_active?: boolean
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          is_active?: boolean
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      estoque_gestores: {
        Row: {
          created_at: string | null
          id: string
          nome_gestor: string
          unidade_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome_gestor: string
          unidade_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nome_gestor?: string
          unidade_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_gestores_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "ferias_unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_locais_armazenamento: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          nome: string
          parent_id: string | null
          tipo: string
          unidade_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          nome: string
          parent_id?: string | null
          tipo?: string
          unidade_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          nome?: string
          parent_id?: string | null
          tipo?: string
          unidade_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_locais_armazenamento_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "estoque_locais_armazenamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_locais_armazenamento_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "ferias_unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_materiais: {
        Row: {
          categoria: string | null
          categoria_id: string | null
          created_at: string | null
          descricao: string | null
          estoque_minimo: number | null
          id: string
          is_active: boolean | null
          is_placa: boolean
          nome: string
          tamanho: string | null
          tamanho_outro: string | null
          tipo_uso: string | null
          unidade_medida: string
          updated_at: string | null
        }
        Insert: {
          categoria?: string | null
          categoria_id?: string | null
          created_at?: string | null
          descricao?: string | null
          estoque_minimo?: number | null
          id?: string
          is_active?: boolean | null
          is_placa?: boolean
          nome: string
          tamanho?: string | null
          tamanho_outro?: string | null
          tipo_uso?: string | null
          unidade_medida?: string
          updated_at?: string | null
        }
        Update: {
          categoria?: string | null
          categoria_id?: string | null
          created_at?: string | null
          descricao?: string | null
          estoque_minimo?: number | null
          id?: string
          is_active?: boolean | null
          is_placa?: boolean
          nome?: string
          tamanho?: string | null
          tamanho_outro?: string | null
          tipo_uso?: string | null
          unidade_medida?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_materiais_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "estoque_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_movimentacoes: {
        Row: {
          created_at: string | null
          id: string
          local_destino_id: string | null
          local_origem_id: string | null
          material_id: string
          observacoes: string | null
          quantidade: number
          recebido_em: string | null
          recebido_por_user_id: string | null
          responsavel_user_id: string | null
          solicitacao_id: string | null
          tipo: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          local_destino_id?: string | null
          local_origem_id?: string | null
          material_id: string
          observacoes?: string | null
          quantidade: number
          recebido_em?: string | null
          recebido_por_user_id?: string | null
          responsavel_user_id?: string | null
          solicitacao_id?: string | null
          tipo: string
        }
        Update: {
          created_at?: string | null
          id?: string
          local_destino_id?: string | null
          local_origem_id?: string | null
          material_id?: string
          observacoes?: string | null
          quantidade?: number
          recebido_em?: string | null
          recebido_por_user_id?: string | null
          responsavel_user_id?: string | null
          solicitacao_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_movimentacoes_local_destino_id_fkey"
            columns: ["local_destino_id"]
            isOneToOne: false
            referencedRelation: "estoque_locais_armazenamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_local_origem_id_fkey"
            columns: ["local_origem_id"]
            isOneToOne: false
            referencedRelation: "estoque_locais_armazenamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "estoque_materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "estoque_solicitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_notificacoes: {
        Row: {
          created_at: string | null
          id: string
          lida: boolean | null
          mensagem: string
          referencia_id: string | null
          referencia_tipo: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lida?: boolean | null
          mensagem: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lida?: boolean | null
          mensagem?: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      estoque_placas: {
        Row: {
          categoria_id: string | null
          codigo: string | null
          created_at: string
          created_by: string | null
          data_instalacao_atual: string | null
          id: string
          imovel_codigo_atual: string | null
          local_armazenamento_id: string | null
          material_id: string
          observacoes: string | null
          status: string
          tamanho: string
          tamanho_outro: string | null
          tipo_uso: string
          updated_at: string
        }
        Insert: {
          categoria_id?: string | null
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          data_instalacao_atual?: string | null
          id?: string
          imovel_codigo_atual?: string | null
          local_armazenamento_id?: string | null
          material_id: string
          observacoes?: string | null
          status?: string
          tamanho: string
          tamanho_outro?: string | null
          tipo_uso: string
          updated_at?: string
        }
        Update: {
          categoria_id?: string | null
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          data_instalacao_atual?: string | null
          id?: string
          imovel_codigo_atual?: string | null
          local_armazenamento_id?: string | null
          material_id?: string
          observacoes?: string | null
          status?: string
          tamanho?: string
          tamanho_outro?: string | null
          tipo_uso?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_placas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "estoque_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_placas_local_armazenamento_id_fkey"
            columns: ["local_armazenamento_id"]
            isOneToOne: false
            referencedRelation: "estoque_locais_armazenamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_placas_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "estoque_materiais"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_placas_historico: {
        Row: {
          created_at: string
          data_evento: string
          data_retorno: string | null
          id: string
          imovel_codigo: string | null
          observacoes: string | null
          placa_id: string
          tipo: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          data_evento?: string
          data_retorno?: string | null
          id?: string
          imovel_codigo?: string | null
          observacoes?: string | null
          placa_id: string
          tipo: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          data_evento?: string
          data_retorno?: string | null
          id?: string
          imovel_codigo?: string | null
          observacoes?: string | null
          placa_id?: string
          tipo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_placas_historico_placa_id_fkey"
            columns: ["placa_id"]
            isOneToOne: false
            referencedRelation: "estoque_placas"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_saldos: {
        Row: {
          id: string
          local_armazenamento_id: string
          material_id: string
          quantidade: number
          updated_at: string | null
        }
        Insert: {
          id?: string
          local_armazenamento_id: string
          material_id: string
          quantidade?: number
          updated_at?: string | null
        }
        Update: {
          id?: string
          local_armazenamento_id?: string
          material_id?: string
          quantidade?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_saldos_local_armazenamento_id_fkey"
            columns: ["local_armazenamento_id"]
            isOneToOne: false
            referencedRelation: "estoque_locais_armazenamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_saldos_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "estoque_materiais"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_solicitacao_itens: {
        Row: {
          id: string
          local_armazenamento_id: string | null
          material_id: string
          quantidade_atendida: number | null
          quantidade_solicitada: number
          solicitacao_id: string
        }
        Insert: {
          id?: string
          local_armazenamento_id?: string | null
          material_id: string
          quantidade_atendida?: number | null
          quantidade_solicitada?: number
          solicitacao_id: string
        }
        Update: {
          id?: string
          local_armazenamento_id?: string | null
          material_id?: string
          quantidade_atendida?: number | null
          quantidade_solicitada?: number
          solicitacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_solicitacao_itens_local_armazenamento_id_fkey"
            columns: ["local_armazenamento_id"]
            isOneToOne: false
            referencedRelation: "estoque_locais_armazenamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_solicitacao_itens_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "estoque_materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_solicitacao_itens_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "estoque_solicitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_solicitacoes: {
        Row: {
          created_at: string | null
          id: string
          observacoes: string | null
          recebimento_confirmado_em: string | null
          recebimento_confirmado_por_user_id: string | null
          setor_id: string | null
          solicitante_nome: string
          solicitante_user_id: string
          status: string
          unidade_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          observacoes?: string | null
          recebimento_confirmado_em?: string | null
          recebimento_confirmado_por_user_id?: string | null
          setor_id?: string | null
          solicitante_nome: string
          solicitante_user_id: string
          status?: string
          unidade_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          observacoes?: string | null
          recebimento_confirmado_em?: string | null
          recebimento_confirmado_por_user_id?: string | null
          setor_id?: string | null
          solicitante_nome?: string
          solicitante_user_id?: string
          status?: string
          unidade_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_solicitacoes_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "ferias_setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_solicitacoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "ferias_unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_usuarios_unidades: {
        Row: {
          created_at: string | null
          id: string
          setor_id: string | null
          unidade_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          setor_id?: string | null
          unidade_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          setor_id?: string | null
          unidade_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_usuarios_unidades_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "ferias_setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_usuarios_unidades_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "ferias_unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      ferias_afastamentos: {
        Row: {
          colaborador_id: string
          created_at: string | null
          created_by: string | null
          data_fim: string
          data_inicio: string
          id: string
          motivo: string
          motivo_descricao: string | null
          observacoes: string | null
          updated_at: string | null
        }
        Insert: {
          colaborador_id: string
          created_at?: string | null
          created_by?: string | null
          data_fim: string
          data_inicio: string
          id?: string
          motivo: string
          motivo_descricao?: string | null
          observacoes?: string | null
          updated_at?: string | null
        }
        Update: {
          colaborador_id?: string
          created_at?: string | null
          created_by?: string | null
          data_fim?: string
          data_inicio?: string
          id?: string
          motivo?: string
          motivo_descricao?: string | null
          observacoes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ferias_afastamentos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "ferias_colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      ferias_audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: string | null
          entity_id: string | null
          entity_type: string
          id: string
          new_data: Json | null
          old_data: Json | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ferias_cargos: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          nome: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          nome: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          nome?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ferias_colaborador_setores_substitutos: {
        Row: {
          colaborador_id: string | null
          created_at: string | null
          id: string
          setor_id: string | null
        }
        Insert: {
          colaborador_id?: string | null
          created_at?: string | null
          id?: string
          setor_id?: string | null
        }
        Update: {
          colaborador_id?: string | null
          created_at?: string | null
          id?: string
          setor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ferias_colaborador_setores_substitutos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "ferias_colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ferias_colaborador_setores_substitutos_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "ferias_setores"
            referencedColumns: ["id"]
          },
        ]
      }
      ferias_colaboradores: {
        Row: {
          aviso_previo_fim: string | null
          aviso_previo_inicio: string | null
          cargo_id: string | null
          created_at: string | null
          data_admissao: string
          data_nascimento: string
          equipe_id: string | null
          familiar_id: string | null
          id: string
          nome: string
          nome_exibicao: string | null
          observacoes: string | null
          setor_titular_id: string
          status: string | null
          unidade_id: string | null
          updated_at: string | null
        }
        Insert: {
          aviso_previo_fim?: string | null
          aviso_previo_inicio?: string | null
          cargo_id?: string | null
          created_at?: string | null
          data_admissao: string
          data_nascimento: string
          equipe_id?: string | null
          familiar_id?: string | null
          id?: string
          nome: string
          nome_exibicao?: string | null
          observacoes?: string | null
          setor_titular_id: string
          status?: string | null
          unidade_id?: string | null
          updated_at?: string | null
        }
        Update: {
          aviso_previo_fim?: string | null
          aviso_previo_inicio?: string | null
          cargo_id?: string | null
          created_at?: string | null
          data_admissao?: string
          data_nascimento?: string
          equipe_id?: string | null
          familiar_id?: string | null
          id?: string
          nome?: string
          nome_exibicao?: string | null
          observacoes?: string | null
          setor_titular_id?: string
          status?: string | null
          unidade_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ferias_colaboradores_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "ferias_cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ferias_colaboradores_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "ferias_equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ferias_colaboradores_familiar_id_fkey"
            columns: ["familiar_id"]
            isOneToOne: false
            referencedRelation: "ferias_colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ferias_colaboradores_setor_titular_id_fkey"
            columns: ["setor_titular_id"]
            isOneToOne: false
            referencedRelation: "ferias_setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ferias_colaboradores_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "ferias_unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      ferias_colaboradores_dados_sensiveis: {
        Row: {
          colaborador_id: string
          cpf: string | null
          updated_at: string
        }
        Insert: {
          colaborador_id: string
          cpf?: string | null
          updated_at?: string
        }
        Update: {
          colaborador_id?: string
          cpf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ferias_colaboradores_dados_sensiveis_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: true
            referencedRelation: "ferias_colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      ferias_configuracoes: {
        Row: {
          chave: string
          descricao: string | null
          id: string
          updated_at: string | null
          valor: string
        }
        Insert: {
          chave: string
          descricao?: string | null
          id?: string
          updated_at?: string | null
          valor: string
        }
        Update: {
          chave?: string
          descricao?: string | null
          id?: string
          updated_at?: string | null
          valor?: string
        }
        Relationships: []
      }
      ferias_conflitos: {
        Row: {
          colaborador1_id: string | null
          colaborador2_id: string | null
          created_at: string | null
          id: string
          motivo: string | null
        }
        Insert: {
          colaborador1_id?: string | null
          colaborador2_id?: string | null
          created_at?: string | null
          id?: string
          motivo?: string | null
        }
        Update: {
          colaborador1_id?: string | null
          colaborador2_id?: string | null
          created_at?: string | null
          id?: string
          motivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ferias_conflitos_colaborador1_id_fkey"
            columns: ["colaborador1_id"]
            isOneToOne: false
            referencedRelation: "ferias_colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ferias_conflitos_colaborador2_id_fkey"
            columns: ["colaborador2_id"]
            isOneToOne: false
            referencedRelation: "ferias_colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      ferias_equipes: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          nome: string
          setor_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          nome: string
          setor_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          nome?: string
          setor_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ferias_equipes_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "ferias_setores"
            referencedColumns: ["id"]
          },
        ]
      }
      ferias_feriados: {
        Row: {
          created_at: string | null
          data: string
          id: string
          nome: string
          recorrente: boolean | null
          tipo: string | null
          unidade_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data: string
          id?: string
          nome: string
          recorrente?: boolean | null
          tipo?: string | null
          unidade_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data?: string
          id?: string
          nome?: string
          recorrente?: boolean | null
          tipo?: string | null
          unidade_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ferias_feriados_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "ferias_unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      ferias_ferias: {
        Row: {
          colaborador_id: string | null
          created_at: string | null
          created_by: string | null
          dias_vendidos: number | null
          dias_vendidos_q1: number | null
          dias_vendidos_q2: number | null
          distribuicao_tipo: string | null
          enviado_contador: boolean | null
          enviado_contador_em: string | null
          enviado_contador_q1: boolean | null
          enviado_contador_q2: boolean | null
          excecao_justificativa: string | null
          excecao_motivo: string | null
          gozo_diferente: boolean | null
          gozo_flexivel: boolean | null
          gozo_quinzena1_fim: string | null
          gozo_quinzena1_inicio: string | null
          gozo_quinzena2_fim: string | null
          gozo_quinzena2_inicio: string | null
          id: string
          is_excecao: boolean | null
          origem: string | null
          periodo_aquisitivo_fim: string | null
          periodo_aquisitivo_inicio: string | null
          quinzena_venda: number | null
          quinzena1_fim: string
          quinzena1_inicio: string
          quinzena2_fim: string | null
          quinzena2_inicio: string | null
          status: string | null
          updated_at: string | null
          vender_dias: boolean | null
          vender_q1: boolean
          vender_q2: boolean
        }
        Insert: {
          colaborador_id?: string | null
          created_at?: string | null
          created_by?: string | null
          dias_vendidos?: number | null
          dias_vendidos_q1?: number | null
          dias_vendidos_q2?: number | null
          distribuicao_tipo?: string | null
          enviado_contador?: boolean | null
          enviado_contador_em?: string | null
          enviado_contador_q1?: boolean | null
          enviado_contador_q2?: boolean | null
          excecao_justificativa?: string | null
          excecao_motivo?: string | null
          gozo_diferente?: boolean | null
          gozo_flexivel?: boolean | null
          gozo_quinzena1_fim?: string | null
          gozo_quinzena1_inicio?: string | null
          gozo_quinzena2_fim?: string | null
          gozo_quinzena2_inicio?: string | null
          id?: string
          is_excecao?: boolean | null
          origem?: string | null
          periodo_aquisitivo_fim?: string | null
          periodo_aquisitivo_inicio?: string | null
          quinzena_venda?: number | null
          quinzena1_fim: string
          quinzena1_inicio: string
          quinzena2_fim?: string | null
          quinzena2_inicio?: string | null
          status?: string | null
          updated_at?: string | null
          vender_dias?: boolean | null
          vender_q1?: boolean
          vender_q2?: boolean
        }
        Update: {
          colaborador_id?: string | null
          created_at?: string | null
          created_by?: string | null
          dias_vendidos?: number | null
          dias_vendidos_q1?: number | null
          dias_vendidos_q2?: number | null
          distribuicao_tipo?: string | null
          enviado_contador?: boolean | null
          enviado_contador_em?: string | null
          enviado_contador_q1?: boolean | null
          enviado_contador_q2?: boolean | null
          excecao_justificativa?: string | null
          excecao_motivo?: string | null
          gozo_diferente?: boolean | null
          gozo_flexivel?: boolean | null
          gozo_quinzena1_fim?: string | null
          gozo_quinzena1_inicio?: string | null
          gozo_quinzena2_fim?: string | null
          gozo_quinzena2_inicio?: string | null
          id?: string
          is_excecao?: boolean | null
          origem?: string | null
          periodo_aquisitivo_fim?: string | null
          periodo_aquisitivo_inicio?: string | null
          quinzena_venda?: number | null
          quinzena1_fim?: string
          quinzena1_inicio?: string
          quinzena2_fim?: string | null
          quinzena2_inicio?: string | null
          status?: string | null
          updated_at?: string | null
          vender_dias?: boolean | null
          vender_q1?: boolean
          vender_q2?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ferias_ferias_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "ferias_colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      ferias_folgas: {
        Row: {
          colaborador_id: string | null
          created_at: string | null
          data_sabado: string
          escala_id: string | null
          excecao_justificativa: string | null
          excecao_motivo: string | null
          id: string
          is_excecao: boolean | null
          updated_at: string | null
        }
        Insert: {
          colaborador_id?: string | null
          created_at?: string | null
          data_sabado: string
          escala_id?: string | null
          excecao_justificativa?: string | null
          excecao_motivo?: string | null
          id?: string
          is_excecao?: boolean | null
          updated_at?: string | null
        }
        Update: {
          colaborador_id?: string | null
          created_at?: string | null
          data_sabado?: string
          escala_id?: string | null
          excecao_justificativa?: string | null
          excecao_motivo?: string | null
          id?: string
          is_excecao?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ferias_folgas_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "ferias_colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ferias_folgas_escala_id_fkey"
            columns: ["escala_id"]
            isOneToOne: false
            referencedRelation: "ferias_folgas_escala"
            referencedColumns: ["id"]
          },
        ]
      }
      ferias_folgas_creditos: {
        Row: {
          colaborador_id: string
          created_at: string | null
          created_by: string | null
          dias: number
          id: string
          justificativa: string
          origem_data: string
          status: string
          tipo: string
          updated_at: string | null
          utilizado_em: string | null
          utilizado_referencia: string | null
        }
        Insert: {
          colaborador_id: string
          created_at?: string | null
          created_by?: string | null
          dias?: number
          id?: string
          justificativa: string
          origem_data: string
          status?: string
          tipo: string
          updated_at?: string | null
          utilizado_em?: string | null
          utilizado_referencia?: string | null
        }
        Update: {
          colaborador_id?: string
          created_at?: string | null
          created_by?: string | null
          dias?: number
          id?: string
          justificativa?: string
          origem_data?: string
          status?: string
          tipo?: string
          updated_at?: string | null
          utilizado_em?: string | null
          utilizado_referencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ferias_folgas_creditos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "ferias_colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      ferias_folgas_escala: {
        Row: {
          ano: number
          confirmada_em: string | null
          confirmada_por: string | null
          created_at: string | null
          id: string
          mes: number
          setor_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          ano: number
          confirmada_em?: string | null
          confirmada_por?: string | null
          created_at?: string | null
          id?: string
          mes: number
          setor_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          ano?: number
          confirmada_em?: string | null
          confirmada_por?: string | null
          created_at?: string | null
          id?: string
          mes?: number
          setor_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ferias_folgas_escala_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "ferias_setores"
            referencedColumns: ["id"]
          },
        ]
      }
      ferias_folgas_perdas: {
        Row: {
          ano: number
          colaborador_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          mes: number
          motivo: string
          observacoes: string | null
        }
        Insert: {
          ano: number
          colaborador_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          mes: number
          motivo: string
          observacoes?: string | null
        }
        Update: {
          ano?: number
          colaborador_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          mes?: number
          motivo?: string
          observacoes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ferias_folgas_perdas_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "ferias_colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      ferias_formulario_anual: {
        Row: {
          ano_referencia: number
          colaborador_id: string | null
          created_at: string | null
          data_inicio_preferencia: string | null
          dias_vender: number | null
          id: string
          observacao: string | null
          periodo_preferencia: number | null
          periodo1_mes: number | null
          periodo1_quinzena: string | null
          periodo2_mes: number | null
          periodo2_quinzena: string | null
          periodo3_mes: number | null
          periodo3_quinzena: string | null
          status: string | null
          updated_at: string | null
          vender_dias: boolean | null
        }
        Insert: {
          ano_referencia: number
          colaborador_id?: string | null
          created_at?: string | null
          data_inicio_preferencia?: string | null
          dias_vender?: number | null
          id?: string
          observacao?: string | null
          periodo_preferencia?: number | null
          periodo1_mes?: number | null
          periodo1_quinzena?: string | null
          periodo2_mes?: number | null
          periodo2_quinzena?: string | null
          periodo3_mes?: number | null
          periodo3_quinzena?: string | null
          status?: string | null
          updated_at?: string | null
          vender_dias?: boolean | null
        }
        Update: {
          ano_referencia?: number
          colaborador_id?: string | null
          created_at?: string | null
          data_inicio_preferencia?: string | null
          dias_vender?: number | null
          id?: string
          observacao?: string | null
          periodo_preferencia?: number | null
          periodo1_mes?: number | null
          periodo1_quinzena?: string | null
          periodo2_mes?: number | null
          periodo2_quinzena?: string | null
          periodo3_mes?: number | null
          periodo3_quinzena?: string | null
          status?: string | null
          updated_at?: string | null
          vender_dias?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ferias_formulario_anual_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "ferias_colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      ferias_gozo_periodos: {
        Row: {
          created_at: string | null
          data_fim: string
          data_inicio: string
          dias: number
          ferias_id: string
          id: string
          numero: number
          referencia_periodo: number | null
          tipo: string
        }
        Insert: {
          created_at?: string | null
          data_fim: string
          data_inicio: string
          dias: number
          ferias_id: string
          id?: string
          numero?: number
          referencia_periodo?: number | null
          tipo: string
        }
        Update: {
          created_at?: string | null
          data_fim?: string
          data_inicio?: string
          dias?: number
          ferias_id?: string
          id?: string
          numero?: number
          referencia_periodo?: number | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "ferias_gozo_periodos_ferias_id_fkey"
            columns: ["ferias_id"]
            isOneToOne: false
            referencedRelation: "ferias_ferias"
            referencedColumns: ["id"]
          },
        ]
      }
      ferias_periodos_quitados: {
        Row: {
          colaborador_id: string
          created_at: string | null
          created_by: string | null
          dias_quitados: number
          id: string
          observacoes: string | null
          periodo_fim: string
          periodo_inicio: string
        }
        Insert: {
          colaborador_id: string
          created_at?: string | null
          created_by?: string | null
          dias_quitados?: number
          id?: string
          observacoes?: string | null
          periodo_fim: string
          periodo_inicio: string
        }
        Update: {
          colaborador_id?: string
          created_at?: string | null
          created_by?: string | null
          dias_quitados?: number
          id?: string
          observacoes?: string | null
          periodo_fim?: string
          periodo_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "ferias_periodos_quitados_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "ferias_colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      ferias_premiacoes: {
        Row: {
          created_at: string
          created_by: string | null
          data_fim: string
          data_inicio: string
          data_recebimento: string
          dias_gozados: number
          dias_vendidos: number
          ferias_id: string
          id: string
          observacao: string | null
          periodo: number
          recebimento_confirmado: boolean
          recebimento_confirmado_em: string | null
          recebimento_confirmado_por: string | null
          ultima_exportacao_pdf: string | null
          updated_at: string
          updated_by: string | null
          valor_premiacao: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_fim: string
          data_inicio: string
          data_recebimento: string
          dias_gozados: number
          dias_vendidos?: number
          ferias_id: string
          id?: string
          observacao?: string | null
          periodo: number
          recebimento_confirmado?: boolean
          recebimento_confirmado_em?: string | null
          recebimento_confirmado_por?: string | null
          ultima_exportacao_pdf?: string | null
          updated_at?: string
          updated_by?: string | null
          valor_premiacao: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_fim?: string
          data_inicio?: string
          data_recebimento?: string
          dias_gozados?: number
          dias_vendidos?: number
          ferias_id?: string
          id?: string
          observacao?: string | null
          periodo?: number
          recebimento_confirmado?: boolean
          recebimento_confirmado_em?: string | null
          recebimento_confirmado_por?: string | null
          ultima_exportacao_pdf?: string | null
          updated_at?: string
          updated_by?: string | null
          valor_premiacao?: number
        }
        Relationships: [
          {
            foreignKeyName: "ferias_premiacoes_ferias_id_fkey"
            columns: ["ferias_id"]
            isOneToOne: false
            referencedRelation: "ferias_ferias"
            referencedColumns: ["id"]
          },
        ]
      }
      ferias_quinzenas: {
        Row: {
          ano: number
          created_at: string | null
          data_fim: string
          data_inicio: string
          id: string
          mes: number
          quinzena: number
        }
        Insert: {
          ano: number
          created_at?: string | null
          data_fim: string
          data_inicio: string
          id?: string
          mes: number
          quinzena: number
        }
        Update: {
          ano?: number
          created_at?: string | null
          data_fim?: string
          data_inicio?: string
          id?: string
          mes?: number
          quinzena?: number
        }
        Relationships: []
      }
      ferias_setor_chefes: {
        Row: {
          colaborador_id: string | null
          created_at: string | null
          id: string
          setor_id: string | null
        }
        Insert: {
          colaborador_id?: string | null
          created_at?: string | null
          id?: string
          setor_id?: string | null
        }
        Update: {
          colaborador_id?: string | null
          created_at?: string | null
          id?: string
          setor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ferias_setor_chefes_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "ferias_colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ferias_setor_chefes_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "ferias_setores"
            referencedColumns: ["id"]
          },
        ]
      }
      ferias_setores: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          nome: string
          unidade_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          nome: string
          unidade_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          nome?: string
          unidade_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ferias_setores_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "ferias_unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      ferias_unidades: {
        Row: {
          created_at: string | null
          endereco: string | null
          id: string
          is_active: boolean | null
          nome: string
          observacoes: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          endereco?: string | null
          id?: string
          is_active?: boolean | null
          nome: string
          observacoes?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          endereco?: string | null
          id?: string
          is_active?: boolean | null
          nome?: string
          observacoes?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      generated_schedules: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
          week_end_date: string
          week_start_date: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
          week_end_date: string
          week_start_date: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
          week_end_date?: string
          week_start_date?: string
        }
        Relationships: []
      }
      location_brokers: {
        Row: {
          available_afternoon: boolean | null
          available_morning: boolean | null
          broker_id: string
          created_at: string | null
          id: string
          location_id: string
          weekday_shift_availability: Json | null
        }
        Insert: {
          available_afternoon?: boolean | null
          available_morning?: boolean | null
          broker_id: string
          created_at?: string | null
          id?: string
          location_id: string
          weekday_shift_availability?: Json | null
        }
        Update: {
          available_afternoon?: boolean | null
          available_morning?: boolean | null
          broker_id?: string
          created_at?: string | null
          id?: string
          location_id?: string
          weekday_shift_availability?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "location_brokers_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_brokers_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_periods: {
        Row: {
          created_at: string | null
          end_date: string
          id: string
          location_id: string
          parent_period_id: string | null
          period_type: string
          start_date: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_date: string
          id?: string
          location_id: string
          parent_period_id?: string | null
          period_type: string
          start_date: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_date?: string
          id?: string
          location_id?: string
          parent_period_id?: string | null
          period_type?: string
          start_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_periods_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_periods_parent_period_id_fkey"
            columns: ["parent_period_id"]
            isOneToOne: false
            referencedRelation: "location_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      location_rotation_queue: {
        Row: {
          broker_id: string
          created_at: string | null
          id: string
          last_assignment_date: string | null
          location_id: string
          queue_position: number
          times_assigned: number | null
          updated_at: string | null
        }
        Insert: {
          broker_id: string
          created_at?: string | null
          id?: string
          last_assignment_date?: string | null
          location_id: string
          queue_position?: number
          times_assigned?: number | null
          updated_at?: string | null
        }
        Update: {
          broker_id?: string
          created_at?: string | null
          id?: string
          last_assignment_date?: string | null
          location_id?: string
          queue_position?: number
          times_assigned?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_rotation_queue_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_rotation_queue_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          afternoon_end: string | null
          afternoon_start: string | null
          builder_company: string | null
          cep: string
          city: string
          complement: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          location_type: string | null
          morning_end: string | null
          morning_start: string | null
          name: string
          neighborhood: string
          number: string | null
          shift_config_mode: string | null
          state: string
          street: string
          updated_at: string | null
        }
        Insert: {
          afternoon_end?: string | null
          afternoon_start?: string | null
          builder_company?: string | null
          cep: string
          city: string
          complement?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location_type?: string | null
          morning_end?: string | null
          morning_start?: string | null
          name: string
          neighborhood: string
          number?: string | null
          shift_config_mode?: string | null
          state: string
          street: string
          updated_at?: string | null
        }
        Update: {
          afternoon_end?: string | null
          afternoon_start?: string | null
          builder_company?: string | null
          cep?: string
          city?: string
          complement?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location_type?: string | null
          morning_end?: string | null
          morning_start?: string | null
          name?: string
          neighborhood?: string
          number?: string | null
          shift_config_mode?: string | null
          state?: string
          street?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      module_audit_logs: {
        Row: {
          action: string
          changed_by: string | null
          changed_by_email: string | null
          changed_fields: string[] | null
          created_at: string | null
          id: string
          module_name: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          changed_by_email?: string | null
          changed_fields?: string[] | null
          created_at?: string | null
          id?: string
          module_name: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          changed_by_email?: string | null
          changed_fields?: string[] | null
          created_at?: string | null
          id?: string
          module_name?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      monthly_leads: {
        Row: {
          average_leads: number | null
          average_visits: number | null
          broker_id: string
          builder_visits: number | null
          created_at: string | null
          created_by: string
          gimob_key_visits: number | null
          id: string
          last_visit_date: string | null
          leads_active: number | null
          leads_archived: number | null
          leads_received: number | null
          observations: string | null
          scheduled_visits: number | null
          updated_at: string | null
          year_month: string
        }
        Insert: {
          average_leads?: number | null
          average_visits?: number | null
          broker_id: string
          builder_visits?: number | null
          created_at?: string | null
          created_by: string
          gimob_key_visits?: number | null
          id?: string
          last_visit_date?: string | null
          leads_active?: number | null
          leads_archived?: number | null
          leads_received?: number | null
          observations?: string | null
          scheduled_visits?: number | null
          updated_at?: string | null
          year_month: string
        }
        Update: {
          average_leads?: number | null
          average_visits?: number | null
          broker_id?: string
          builder_visits?: number | null
          created_at?: string | null
          created_by?: string
          gimob_key_visits?: number | null
          id?: string
          last_visit_date?: string | null
          leads_active?: number | null
          leads_archived?: number | null
          leads_received?: number | null
          observations?: string | null
          scheduled_visits?: number | null
          updated_at?: string | null
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_leads_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "sales_brokers"
            referencedColumns: ["id"]
          },
        ]
      }
      period_day_configs: {
        Row: {
          afternoon_end: string | null
          afternoon_start: string | null
          created_at: string | null
          has_afternoon: boolean | null
          has_morning: boolean | null
          id: string
          max_brokers_count: number
          morning_end: string | null
          morning_start: string | null
          period_id: string
          weekday: string
        }
        Insert: {
          afternoon_end?: string | null
          afternoon_start?: string | null
          created_at?: string | null
          has_afternoon?: boolean | null
          has_morning?: boolean | null
          id?: string
          max_brokers_count?: number
          morning_end?: string | null
          morning_start?: string | null
          period_id: string
          weekday: string
        }
        Update: {
          afternoon_end?: string | null
          afternoon_start?: string | null
          created_at?: string | null
          has_afternoon?: boolean | null
          has_morning?: boolean | null
          id?: string
          max_brokers_count?: number
          morning_end?: string | null
          morning_start?: string | null
          period_id?: string
          weekday?: string
        }
        Relationships: [
          {
            foreignKeyName: "period_day_configs_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "location_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      period_excluded_dates: {
        Row: {
          created_at: string | null
          excluded_date: string
          excluded_shifts: string[] | null
          id: string
          period_id: string
          reason: string | null
        }
        Insert: {
          created_at?: string | null
          excluded_date: string
          excluded_shifts?: string[] | null
          id?: string
          period_id: string
          reason?: string | null
        }
        Update: {
          created_at?: string | null
          excluded_date?: string
          excluded_shifts?: string[] | null
          id?: string
          period_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "period_excluded_dates_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "location_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      period_specific_day_configs: {
        Row: {
          afternoon_end: string | null
          afternoon_start: string | null
          created_at: string | null
          has_afternoon: boolean | null
          has_morning: boolean | null
          id: string
          max_brokers_count: number | null
          morning_end: string | null
          morning_start: string | null
          period_id: string
          specific_date: string
        }
        Insert: {
          afternoon_end?: string | null
          afternoon_start?: string | null
          created_at?: string | null
          has_afternoon?: boolean | null
          has_morning?: boolean | null
          id?: string
          max_brokers_count?: number | null
          morning_end?: string | null
          morning_start?: string | null
          period_id: string
          specific_date: string
        }
        Update: {
          afternoon_end?: string | null
          afternoon_start?: string | null
          created_at?: string | null
          has_afternoon?: boolean | null
          has_morning?: boolean | null
          id?: string
          max_brokers_count?: number | null
          morning_end?: string | null
          morning_start?: string | null
          period_id?: string
          specific_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "period_specific_day_configs_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "location_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          broker_id: string
          converted_to_sale_id: string | null
          created_at: string | null
          created_by: string
          id: string
          proposal_date: string
          proposal_value: number | null
          status: string | null
          updated_at: string | null
          year_month: string
        }
        Insert: {
          broker_id: string
          converted_to_sale_id?: string | null
          created_at?: string | null
          created_by: string
          id?: string
          proposal_date: string
          proposal_value?: number | null
          status?: string | null
          updated_at?: string | null
          year_month: string
        }
        Update: {
          broker_id?: string
          converted_to_sale_id?: string | null
          created_at?: string | null
          created_by?: string
          id?: string
          proposal_date?: string
          proposal_value?: number | null
          status?: string | null
          updated_at?: string | null
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "sales_brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_converted_to_sale_id_fkey"
            columns: ["converted_to_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_partners: {
        Row: {
          broker_id: string
          created_at: string | null
          id: string
          sale_id: string
        }
        Insert: {
          broker_id: string
          created_at?: string | null
          id?: string
          sale_id: string
        }
        Update: {
          broker_id?: string
          created_at?: string | null
          id?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_partners_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "sales_brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_partners_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          broker_id: string
          created_at: string | null
          created_by: string
          has_partners: boolean | null
          id: string
          property_name: string | null
          sale_date: string
          sale_value: number
          team_id: string | null
          updated_at: string | null
          year_month: string
        }
        Insert: {
          broker_id: string
          created_at?: string | null
          created_by: string
          has_partners?: boolean | null
          id?: string
          property_name?: string | null
          sale_date: string
          sale_value: number
          team_id?: string | null
          updated_at?: string | null
          year_month: string
        }
        Update: {
          broker_id?: string
          created_at?: string | null
          created_by?: string
          has_partners?: boolean | null
          id?: string
          property_name?: string | null
          sale_date?: string
          sale_value?: number
          team_id?: string | null
          updated_at?: string | null
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "sales_brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "sales_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_brokers: {
        Row: {
          birth_date: string | null
          broker_type: string
          created_at: string | null
          creci: string | null
          deactivated_month: string | null
          hire_date: string | null
          id: string
          is_active: boolean | null
          is_launch: boolean
          is_manager: boolean
          name: string
          nome_exibicao: string | null
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          birth_date?: string | null
          broker_type?: string
          created_at?: string | null
          creci?: string | null
          deactivated_month?: string | null
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          is_launch?: boolean
          is_manager?: boolean
          name: string
          nome_exibicao?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          birth_date?: string | null
          broker_type?: string
          created_at?: string | null
          creci?: string | null
          deactivated_month?: string | null
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          is_launch?: boolean
          is_manager?: boolean
          name?: string
          nome_exibicao?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_brokers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "sales_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_teams: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      saturday_rotation_queue: {
        Row: {
          broker_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          last_saturday_date: string | null
          location_id: string
          queue_position: number
          times_worked: number | null
          updated_at: string | null
        }
        Insert: {
          broker_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_saturday_date?: string | null
          location_id: string
          queue_position: number
          times_worked?: number | null
          updated_at?: string | null
        }
        Update: {
          broker_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_saturday_date?: string | null
          location_id?: string
          queue_position?: number
          times_worked?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saturday_rotation_queue_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saturday_rotation_queue_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_assignments: {
        Row: {
          assignment_date: string
          broker_id: string
          created_at: string | null
          end_time: string
          generated_schedule_id: string
          id: string
          is_manual: boolean
          location_id: string
          shift_type: string
          start_time: string
          updated_at: string | null
        }
        Insert: {
          assignment_date: string
          broker_id: string
          created_at?: string | null
          end_time: string
          generated_schedule_id: string
          id?: string
          is_manual?: boolean
          location_id: string
          shift_type: string
          start_time: string
          updated_at?: string | null
        }
        Update: {
          assignment_date?: string
          broker_id?: string
          created_at?: string | null
          end_time?: string
          generated_schedule_id?: string
          id?: string
          is_manual?: boolean
          location_id?: string
          shift_type?: string
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_assignments_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_generated_schedule_id_fkey"
            columns: ["generated_schedule_id"]
            isOneToOne: false
            referencedRelation: "generated_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_brokers: {
        Row: {
          broker_id: string
          schedule_id: string
        }
        Insert: {
          broker_id: string
          schedule_id: string
        }
        Update: {
          broker_id?: string
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_brokers_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_brokers_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_locations: {
        Row: {
          location_id: string
          schedule_id: string
        }
        Insert: {
          location_id: string
          schedule_id: string
        }
        Update: {
          location_id?: string
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_locations_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_locks: {
        Row: {
          id: string
          locked_at: string
          locked_by: string | null
          reason: string | null
          schedule_id: string
        }
        Insert: {
          id?: string
          locked_at?: string
          locked_by?: string | null
          reason?: string | null
          schedule_id: string
        }
        Update: {
          id?: string
          locked_at?: string
          locked_by?: string | null
          reason?: string | null
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_locks_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: true
            referencedRelation: "generated_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_observations: {
        Row: {
          content: string
          created_at: string | null
          id: string
          schedule_id: string
          updated_at: string | null
        }
        Insert: {
          content?: string
          created_at?: string | null
          id?: string
          schedule_id: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          schedule_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_observations_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: true
            referencedRelation: "generated_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_validation_results: {
        Row: {
          broker_eligibility_map: Json | null
          broker_reports: Json | null
          created_at: string | null
          id: string
          is_valid: boolean
          schedule_id: string
          summary: Json
          unallocated_demands: Json | null
          updated_at: string | null
          violations: Json | null
        }
        Insert: {
          broker_eligibility_map?: Json | null
          broker_reports?: Json | null
          created_at?: string | null
          id?: string
          is_valid: boolean
          schedule_id: string
          summary: Json
          unallocated_demands?: Json | null
          updated_at?: string | null
          violations?: Json | null
        }
        Update: {
          broker_eligibility_map?: Json | null
          broker_reports?: Json | null
          created_at?: string | null
          id?: string
          is_valid?: boolean
          schedule_id?: string
          summary?: Json
          unallocated_demands?: Json | null
          updated_at?: string | null
          violations?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_validation_results_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: true
            referencedRelation: "generated_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          shift_type: Database["public"]["Enums"]["shift_type"]
          updated_at: string | null
          weekdays: Database["public"]["Enums"]["weekday"][]
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          shift_type: Database["public"]["Enums"]["shift_type"]
          updated_at?: string | null
          weekdays: Database["public"]["Enums"]["weekday"][]
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          shift_type?: Database["public"]["Enums"]["shift_type"]
          updated_at?: string | null
          weekdays?: Database["public"]["Enums"]["weekday"][]
        }
        Relationships: []
      }
      system_access: {
        Row: {
          created_at: string | null
          id: string
          permission_type: string
          system_name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission_type?: string
          system_name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          permission_type?: string
          system_name?: string
          user_id?: string
        }
        Relationships: []
      }
      team_goals: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          target_vgv: number
          team_id: string
          updated_at: string | null
          year_month: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          target_vgv?: number
          team_id: string
          updated_at?: string | null
          year_month: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          target_vgv?: number
          team_id?: string
          updated_at?: string | null
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_goals_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "sales_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      broker_sales_proportional: {
        Row: {
          broker_id: string | null
          has_partners: boolean | null
          owner_broker_id: string | null
          participant_count: number | null
          property_name: string | null
          proportional_value: number | null
          role: string | null
          sale_date: string | null
          sale_id: string | null
          team_id: string | null
          total_value: number | null
          year_month: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_edits_system: {
        Args: { _admin: string; _system: string }
        Returns: boolean
      }
      admin_exists: { Args: never; Returns: boolean }
      aggregate_month_data: { Args: { p_year_month: string }; Returns: Json }
      atualizar_status_ferias: { Args: never; Returns: undefined }
      bulk_update_location_queues_after_allocation: {
        Args: { p_allocations: Json }
        Returns: Json
      }
      can_edit_system: {
        Args: { _system: string; _user_id: string }
        Returns: boolean
      }
      can_manage_role: {
        Args: {
          _caller_role: Database["public"]["Enums"]["app_role"]
          _target_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      can_view_system: {
        Args: { _system: string; _user_id: string }
        Returns: boolean
      }
      confirmar_recebimento_solicitacao: {
        Args: { p_solicitacao_id: string }
        Returns: Json
      }
      delete_weekly_stats_for_period: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: Json
      }
      despesas_centros_permitidos: {
        Args: { _user_id: string }
        Returns: string[]
      }
      despesas_detectar_duplicidades: {
        Args: {
          _centro_custo_id: string
          _conta_bancaria_id: string
          _data_venc: string
          _ignorar_id?: string
          _janela_dias?: number
          _pessoa_id: string
          _plano_conta_id: string
          _valor: number
        }
        Returns: {
          centro_nome: string
          data_vencimento: string
          descricao: string
          id: string
          pessoa_nome: string
          status: string
          valor_total: number
        }[]
      }
      despesas_gerar_encargos_imovel: {
        Args: { _ano: number; _imovel_id: string }
        Returns: number
      }
      despesas_gerar_encargos_veiculo: {
        Args: { _ano: number; _veiculo_id: string }
        Returns: number
      }
      despesas_gerar_ocorrencias: {
        Args: { _ate?: string; _serie: string }
        Returns: number
      }
      despesas_marcar_vencidos: { Args: never; Returns: number }
      despesas_montar_repasse: {
        Args: {
          _centro_custo_id: string
          _competencia: string
          _proprietario_id: string
        }
        Returns: string
      }
      despesas_nivel_aba: {
        Args: { _aba: string; _user_id: string }
        Returns: string
      }
      despesas_pode_editar_aba: {
        Args: { _aba: string; _user_id: string }
        Returns: boolean
      }
      despesas_pode_excluir_aba: {
        Args: { _aba: string; _user_id: string }
        Returns: boolean
      }
      despesas_pode_ver_aba: {
        Args: { _aba: string; _user_id: string }
        Returns: boolean
      }
      despesas_recalcular_lancamento: {
        Args: { _lancamento_id: string }
        Returns: undefined
      }
      despesas_repasse_recalcular: {
        Args: { _repasse_id: string }
        Returns: undefined
      }
      get_broker_performance: {
        Args: { end_date: string; start_date: string }
        Returns: {
          afternoon_count: number
          broker_id: string
          broker_name: string
          last_assignment: string
          morning_count: number
          total_assignments: number
          unique_locations: number
        }[]
      }
      get_broker_performance_hybrid: {
        Args: { end_date: string; start_date: string }
        Returns: {
          afternoon_count: number
          broker_id: string
          broker_name: string
          last_assignment: string
          morning_count: number
          total_assignments: number
          unique_locations: number
        }[]
      }
      get_brokers_for_manager: {
        Args: never
        Returns: {
          available_weekdays: string[]
          created_at: string
          creci: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }[]
      }
      get_dashboard_counts: { Args: never; Returns: Json }
      get_dashboard_stats_hybrid: {
        Args: { target_month: string }
        Returns: Json
      }
      get_dashboard_summary: { Args: never; Returns: Json }
      get_location_performance: {
        Args: { end_date: string; start_date: string }
        Returns: {
          afternoon_count: number
          city: string
          days_covered: number
          location_id: string
          location_name: string
          location_type: string
          morning_count: number
          state: string
          total_assignments: number
          unique_brokers: number
        }[]
      }
      get_location_performance_hybrid: {
        Args: { end_date: string; start_date: string }
        Returns: {
          afternoon_count: number
          city: string
          days_covered: number
          location_id: string
          location_name: string
          location_type: string
          morning_count: number
          state: string
          total_assignments: number
          unique_brokers: number
        }[]
      }
      get_location_rotation_queue: {
        Args: { p_location_id: string }
        Returns: {
          broker_id: string
          broker_name: string
          last_assignment_date: string
          queue_position: number
          times_assigned: number
        }[]
      }
      get_previous_week_stats: {
        Args: { p_week_start: string }
        Returns: {
          broker_id: string
          broker_name: string
          external_count: number
          internal_count: number
          saturday_count: number
        }[]
      }
      get_role_level: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: number
      }
      get_sales_broker_vgv_ranking: {
        Args: { p_year_month: string }
        Returns: {
          broker_id: string
          broker_name: string
          rank: number
          team_name: string
          total_sales: number
          total_vgv: number
        }[]
      }
      get_sales_broker_vgv_ranking_flexible: {
        Args: { p_month?: string; p_year: string }
        Returns: {
          broker_id: string
          broker_name: string
          rank: number
          team_name: string
          total_sales: number
          total_vgv: number
        }[]
      }
      get_sales_dashboard_summary: {
        Args: { p_year_month: string }
        Returns: Json
      }
      get_sales_dashboard_summary_flexible: {
        Args: { p_month?: string; p_year: string }
        Returns: Json
      }
      get_sales_team_vgv_ranking: {
        Args: { p_year_month: string }
        Returns: {
          broker_count: number
          rank: number
          team_id: string
          team_name: string
          total_sales: number
          total_vgv: number
        }[]
      }
      get_sales_team_vgv_ranking_flexible: {
        Args: { p_month?: string; p_year: string }
        Returns: {
          broker_count: number
          rank: number
          team_id: string
          team_name: string
          total_sales: number
          total_vgv: number
        }[]
      }
      get_saturday_queue: {
        Args: { p_location_id: string }
        Returns: {
          broker_id: string
          broker_name: string
          last_saturday_date: string
          queue_position: number
          times_worked: number
        }[]
      }
      get_shift_stats: {
        Args: { days_ago: number }
        Returns: {
          count: number
          shift_type: string
        }[]
      }
      get_top_brokers: {
        Args: { days_ago: number; limit_count: number }
        Returns: {
          count: number
          name: string
        }[]
      }
      get_top_brokers_hybrid: {
        Args: { limit_count: number; target_month: string }
        Returns: {
          count: number
          name: string
        }[]
      }
      get_top_locations: {
        Args: { days_ago: number; limit_count: number }
        Returns: {
          count: number
          name: string
        }[]
      }
      get_top_locations_hybrid: {
        Args: { limit_count: number; target_month: string }
        Returns: {
          count: number
          name: string
        }[]
      }
      get_user_name: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_systems: {
        Args: { _user_id: string }
        Returns: {
          system_name: string
        }[]
      }
      get_weekday_distribution: {
        Args: { end_date: string; start_date: string }
        Returns: {
          afternoon_count: number
          morning_count: number
          total_assignments: number
          weekday: number
          weekday_name: string
        }[]
      }
      get_weekday_distribution_hybrid: {
        Args: { end_date: string; start_date: string }
        Returns: {
          afternoon_count: number
          morning_count: number
          total_assignments: number
          weekday: number
          weekday_name: string
        }[]
      }
      get_weekly_assignments: {
        Args: { weeks_count: number }
        Returns: {
          count: number
          week_label: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_system_access: {
        Args: { _system: string; _user_id: string }
        Returns: boolean
      }
      is_admin_or_super: { Args: { _user_id: string }; Returns: boolean }
      is_solicitante_estoque: {
        Args: { _solicitacao_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      make_first_admin: { Args: { _user_id: string }; Returns: boolean }
      reaproveitar_codigo_placa: {
        Args: { p_placa_destino_id: string; p_placa_origem_id: string }
        Returns: string
      }
      recalcular_saldo_placas: {
        Args: { _local_id: string; _material_id: string }
        Returns: undefined
      }
      registrar_evento_ferias: {
        Args: { p_action: string; p_payload: Json; p_record_id: string }
        Returns: undefined
      }
      save_broker_weekly_stats: {
        Args: {
          p_broker_id: string
          p_external_count: number
          p_internal_count: number
          p_saturday_count: number
          p_week_end: string
          p_week_start: string
        }
        Returns: Json
      }
      set_user_role: {
        Args: {
          _new_role: Database["public"]["Enums"]["app_role"]
          _target_user_id: string
        }
        Returns: boolean
      }
      sync_location_rotation_queue: {
        Args: { p_location_id: string }
        Returns: Json
      }
      sync_saturday_queue: { Args: { p_location_id: string }; Returns: Json }
      update_location_queue_after_allocation: {
        Args: {
          p_assignment_date: string
          p_broker_id: string
          p_location_id: string
        }
        Returns: Json
      }
      update_saturday_queue_after_allocation: {
        Args: {
          p_broker_ids: string[]
          p_location_id: string
          p_saturday_date: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "manager"
        | "broker"
        | "super_admin"
        | "supervisor"
        | "collaborator"
      despesa_referencia_tipo: "pasta" | "venda" | "imovel" | "pessoa"
      shift_type: "morning" | "afternoon" | "full"
      weekday:
        | "monday"
        | "tuesday"
        | "wednesday"
        | "thursday"
        | "friday"
        | "saturday"
        | "sunday"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "manager",
        "broker",
        "super_admin",
        "supervisor",
        "collaborator",
      ],
      despesa_referencia_tipo: ["pasta", "venda", "imovel", "pessoa"],
      shift_type: ["morning", "afternoon", "full"],
      weekday: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
    },
  },
} as const
