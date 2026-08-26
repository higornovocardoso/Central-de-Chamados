import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./client";

/**
 * As tabelas da fase 2 (entidades, perfis, grupos, autorizações) ainda não
 * aparecem em types.ts, gerado a partir do banco. Este arquivo declara o
 * formato delas e expõe o mesmo cliente com esse esquema, para que o código
 * novo continue com tipo em vez de cair em `any`.
 *
 * Quando types.ts for regerado com todas as tabelas, este arquivo pode sumir.
 */

export type EntityRow = {
  id: string;
  name: string;
  parent_id: string | null;
  path: string;
  level: number;
  comment: string;
  phone: string;
  administrative_number: string;
  fax: string;
  website: string;
  email: string;
  postal_code: string;
  address: string;
  city: string;
  state: string;
  country: string;
  accepts_public_tickets: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * Domínios de e-mail que identificam a empresa dona de um chamado aberto pelo
 * formulário público. O domínio é único no sistema inteiro: dois clientes com
 * o mesmo domínio tornariam o roteamento ambíguo.
 */
export type EntityEmailDomainRow = {
  id: string;
  entity_id: string;
  domain: string;
  created_at: string;
};

export type AccessProfileRow = {
  id: string;
  name: string;
  interface: "standard" | "simplified";
  is_default: boolean;
  is_system: boolean;
  comment: string;
  sort: number;
  created_at: string;
  updated_at: string;
};

export type RightDefinitionRow = {
  key: string;
  label: string;
  category: string;
  sort: number;
  has_notes: boolean;
};

export type FlagDefinitionRow = {
  key: string;
  label: string;
  category: string;
  sort: number;
};

export type ProfileRightRow = {
  id: string;
  profile_id: string;
  object_key: string;
  can_read: boolean;
  can_update: boolean;
  can_create: boolean;
  can_delete: boolean;
  can_purge: boolean;
  can_read_notes: boolean;
  can_update_notes: boolean;
};

export type ProfileFlagRow = {
  id: string;
  profile_id: string;
  flag_key: string;
  enabled: boolean;
};

export type ProfileLifecycleRow = {
  id: string;
  profile_id: string;
  object_type: string;
  from_status: string;
  to_status: string;
  allowed: boolean;
};

export type UserGroupRow = {
  id: string;
  name: string;
  parent_id: string | null;
  entity_id: string;
  is_recursive: boolean;
  visible_in_ticket: boolean;
  can_be_notified: boolean;
  can_be_manager: boolean;
  contains_assets: boolean;
  contains_users: boolean;
  comment: string;
  created_at: string;
  updated_at: string;
};

export type GroupMemberRow = {
  id: string;
  group_id: string;
  user_id: string;
  is_manager: boolean;
  is_delegate: boolean;
};

export type UserAuthorizationRow = {
  id: string;
  user_id: string;
  profile_id: string;
  entity_id: string;
  is_recursive: boolean;
  is_dynamic: boolean;
  created_at: string;
};

// --- Fase 3: chamado ITIL -------------------------------------------------

export type ItilCategoryRow = {
  id: string;
  name: string;
  parent_id: string | null;
  path: string;
  level: number;
  entity_id: string;
  is_recursive: boolean;
  technician_id: string | null;
  group_id: string | null;
  kb_category: string;
  visible_incident: boolean;
  visible_request: boolean;
  visible_problem: boolean;
  visible_change: boolean;
  visible_helpdesk: boolean;
  comment: string;
  created_at: string;
  updated_at: string;
};

export type TaskCategoryRow = {
  id: string;
  name: string;
  entity_id: string;
  comment: string;
  created_at: string;
};

export type SolutionTypeRow = {
  id: string;
  name: string;
  entity_id: string;
  created_at: string;
};

export type RequestSourceRow = {
  id: string;
  name: string;
  is_default: boolean;
  created_at: string;
};

export type TicketActorRow = {
  id: string;
  ticket_id: string;
  role: "requerente" | "observador" | "atribuido";
  user_id: string | null;
  group_id: string | null;
  supplier_id: string | null;
  alternative_email: string;
  use_notification: boolean;
  created_at: string;
};

export type TicketTaskRow = {
  id: string;
  ticket_id: string;
  category_id: string | null;
  content: string;
  state: "informacao" | "a_fazer" | "concluida";
  is_private: boolean;
  author_id: string | null;
  assigned_user_id: string | null;
  assigned_group_id: string | null;
  planned_start: string | null;
  planned_end: string | null;
  duration_minutes: number;
  created_at: string;
  updated_at: string;
};

export type TicketSolutionRow = {
  id: string;
  ticket_id: string;
  solution_type_id: string | null;
  content: string;
  state: "aguardando" | "aprovada" | "recusada";
  author_id: string | null;
  answer_comment: string;
  answered_by: string | null;
  answered_at: string | null;
  created_at: string;
};

export type TicketValidationRow = {
  id: string;
  ticket_id: string;
  requested_by: string | null;
  approver_user_id: string | null;
  approver_group_id: string | null;
  state: "nao_sujeito" | "aguardando" | "aprovado" | "recusado";
  request_comment: string;
  answer_comment: string;
  requested_at: string;
  answered_at: string | null;
};

export type TicketLinkRow = {
  id: string;
  ticket_id: string;
  linked_ticket_id: string;
  link_type: "ligado" | "duplicado" | "filho" | "pai";
  created_at: string;
};

export type TicketItemRow = {
  id: string;
  ticket_id: string;
  asset_id: string;
  created_at: string;
};

export type TicketCostRow = {
  id: string;
  ticket_id: string;
  name: string;
  begin_date: string | null;
  end_date: string | null;
  duration_minutes: number;
  cost_time: number;
  cost_fixed: number;
  cost_material: number;
  comment: string;
  created_at: string;
};

export type DocumentRow = {
  id: string;
  name: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  entity_id: string;
  uploaded_by: string | null;
  created_at: string;
};

export type DocumentTicketRow = {
  id: string;
  document_id: string;
  ticket_id: string;
};

export type ItemHistoryRow = {
  id: string;
  item_type: string;
  item_id: string;
  user_id: string | null;
  field: string;
  old_value: string;
  new_value: string;
  created_at: string;
};

export type PriorityMatrixRow = {
  urgency: number;
  impact: number;
  priority: number;
};

type Table<R> = {
  Row: R;
  Insert: Partial<R>;
  Update: Partial<R>;
  Relationships: [];
};

export type GlpiDatabase = {
  public: {
    Tables: {
      entities: Table<EntityRow>;
      entity_email_domains: Table<EntityEmailDomainRow>;
      access_profiles: Table<AccessProfileRow>;
      right_definitions: Table<RightDefinitionRow>;
      flag_definitions: Table<FlagDefinitionRow>;
      profile_rights: Table<ProfileRightRow>;
      profile_flags: Table<ProfileFlagRow>;
      profile_lifecycle: Table<ProfileLifecycleRow>;
      user_groups: Table<UserGroupRow>;
      group_members: Table<GroupMemberRow>;
      user_authorizations: Table<UserAuthorizationRow>;
      itil_categories: Table<ItilCategoryRow>;
      task_categories: Table<TaskCategoryRow>;
      solution_types: Table<SolutionTypeRow>;
      request_sources: Table<RequestSourceRow>;
      ticket_actors: Table<TicketActorRow>;
      ticket_tasks: Table<TicketTaskRow>;
      ticket_solutions: Table<TicketSolutionRow>;
      ticket_validations: Table<TicketValidationRow>;
      ticket_links: Table<TicketLinkRow>;
      ticket_items: Table<TicketItemRow>;
      ticket_costs: Table<TicketCostRow>;
      documents: Table<DocumentRow>;
      document_tickets: Table<DocumentTicketRow>;
      item_history: Table<ItemHistoryRow>;
      priority_matrix: Table<PriorityMatrixRow>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      glpi_interface: "standard" | "simplified";
    };
    CompositeTypes: Record<string, never>;
  };
};

/** Mesmo cliente do resto do app, com o esquema da fase 2 declarado. */
export const db = supabase as unknown as SupabaseClient<GlpiDatabase>;

/**
 * Acesso por nome de tabela em tempo de execução, para telas genéricas em
 * que a tabela vem de uma variável.
 *
 * O molde é escrito à mão de propósito: apoiá-lo no cliente do Supabase faz
 * o `select("*")` perder a inferência, porque a linha aqui é um tipo com
 * assinatura de índice. O que mudou é a cobertura — antes eram quatro
 * métodos, e faltavam `.not()`, `.in()`, `.limit()` e dois `.order()`
 * encadeados, o que obrigava a contornar no cliente.
 */
export type LooseRow = Record<string, unknown> & { id: string };

type LooseError = { message: string } | null;
type LooseData = { data: LooseRow[] | null; error: LooseError };
type LooseSingle = { data: LooseRow | null; error: LooseError };

/** Encadeável e aguardável: cada filtro devolve a própria consulta. */
export interface LooseQuery extends PromiseLike<LooseData> {
  eq: (column: string, value: unknown) => LooseQuery;
  neq: (column: string, value: unknown) => LooseQuery;
  gt: (column: string, value: unknown) => LooseQuery;
  gte: (column: string, value: unknown) => LooseQuery;
  lt: (column: string, value: unknown) => LooseQuery;
  lte: (column: string, value: unknown) => LooseQuery;
  like: (column: string, pattern: string) => LooseQuery;
  ilike: (column: string, pattern: string) => LooseQuery;
  is: (column: string, value: unknown) => LooseQuery;
  in: (column: string, values: readonly unknown[]) => LooseQuery;
  not: (column: string, operator: string, value: unknown) => LooseQuery;
  order: (column: string, options?: { ascending?: boolean }) => LooseQuery;
  limit: (count: number) => LooseQuery;
  single: () => Promise<LooseSingle>;
  maybeSingle: () => Promise<LooseSingle>;
}

type LooseWrite = PromiseLike<{ error: LooseError }> & {
  eq: (column: string, value: unknown) => PromiseLike<{ error: LooseError }>;
  select: (columns?: string) => LooseQuery;
};

export type LooseTable = {
  select: (columns?: string) => LooseQuery;
  insert: (values: Record<string, unknown> | Record<string, unknown>[]) => LooseWrite;
  update: (values: Record<string, unknown>) => LooseWrite;
  delete: () => LooseWrite;
  upsert: (values: Record<string, unknown> | Record<string, unknown>[]) => LooseWrite;
};

export const looseDb = db as unknown as { from: (table: string) => LooseTable };
