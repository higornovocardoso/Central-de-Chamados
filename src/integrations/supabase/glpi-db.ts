import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./client";

/**
 * As tabelas da fase 2 (entidades, perfis, grupos, autorizações) ainda não
 * aparecem em types.ts, que é gerado pelo Lovable. Este arquivo declara o
 * formato delas e expõe o mesmo cliente com esse esquema, para que o código
 * novo continue com tipo em vez de cair em `any`.
 *
 * Quando o Lovable regerar types.ts com as tabelas, este arquivo pode sumir.
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
  created_at: string;
  updated_at: string;
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
      access_profiles: Table<AccessProfileRow>;
      right_definitions: Table<RightDefinitionRow>;
      flag_definitions: Table<FlagDefinitionRow>;
      profile_rights: Table<ProfileRightRow>;
      profile_flags: Table<ProfileFlagRow>;
      profile_lifecycle: Table<ProfileLifecycleRow>;
      user_groups: Table<UserGroupRow>;
      group_members: Table<GroupMemberRow>;
      user_authorizations: Table<UserAuthorizationRow>;
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
