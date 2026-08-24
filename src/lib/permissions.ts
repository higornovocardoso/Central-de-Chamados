import { supabase } from "@/integrations/supabase/client";

/** Ações padrão do GLPI sobre um objeto. */
export type RightAction = "read" | "update" | "create" | "delete" | "purge";

export type ObjectRights = Record<RightAction, boolean>;

export type MyProfile = {
  id: string;
  name: string;
  interface: "standard" | "simplified";
  entity_id: string;
  entity_name: string;
  is_recursive: boolean;
};

export type MyEntity = {
  id: string;
  name: string;
  level: number;
  path: string;
};

export type Permissions = {
  profiles: MyProfile[];
  rights: Record<string, Partial<ObjectRights>>;
  flags: string[];
  entities: MyEntity[];
};

export const EMPTY_PERMISSIONS: Permissions = {
  profiles: [],
  rights: {},
  flags: [],
  entities: [],
};

/** Categorias da matriz de direitos, na ordem das abas do GLPI. */
export const RIGHT_CATEGORIES = [
  { key: "ativos", label: "Ativos" },
  { key: "assistencia", label: "Assistência" },
  { key: "gestao", label: "Gestão" },
  { key: "ferramentas", label: "Ferramentas" },
  { key: "administracao", label: "Administração" },
  { key: "configuracao", label: "Configuração" },
] as const;

export const RIGHT_ACTIONS: { key: RightAction; label: string; hint: string }[] = [
  { key: "read", label: "Ler", hint: "Exibir o objeto e vê-lo no menu" },
  { key: "update", label: "Atualizar", hint: "Alterar os dados" },
  { key: "create", label: "Criar", hint: "Criar um novo registro" },
  { key: "delete", label: "Excluir", hint: "Mandar para a lixeira" },
  { key: "purge", label: "Purgar", hint: "Apagar em definitivo" },
];

/**
 * O resumo de permissões do usuário atual, numa chamada só.
 * A função my_permissions() ainda não está no types.ts gerado, daí o molde.
 */
export async function fetchMyPermissions(): Promise<Permissions> {
  // O molde vai no cliente, não no método: arrancar supabase.rpc do objeto
  // perde o `this` e a chamada estoura em vez de devolver { data, error }.
  const client = supabase as unknown as {
    rpc: (fn: string) => Promise<{ data: unknown; error: { message: string } | null }>;
  };

  const { data, error } = await client.rpc("my_permissions");

  // Enquanto a migration da fase 2 não estiver aplicada, a função não existe.
  // Nesse caso o sistema continua rodando com os três papéis antigos.
  if (error) return legacyPermissions();
  if (!data || typeof data !== "object") return EMPTY_PERMISSIONS;

  const raw = data as Partial<Permissions>;
  return {
    profiles: raw.profiles ?? [],
    rights: raw.rights ?? {},
    flags: raw.flags ?? [],
    entities: raw.entities ?? [],
  };
}

const FULL: ObjectRights = { read: true, update: true, create: true, delete: true, purge: true };
const READ_ONLY: Partial<ObjectRights> = { read: true };

async function legacyPermissions(): Promise<Permissions> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return EMPTY_PERMISSIONS;

  const { data } = await supabase.from("user_roles").select("user_id,role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role as string);
  const isAdmin = roles.includes("admin");
  const isTech = isAdmin || roles.includes("tecnico");

  const rights: Record<string, Partial<ObjectRights>> = {};
  const grant = (keys: string[], value: Partial<ObjectRights>) => {
    for (const key of keys) rights[key] = value;
  };

  grant(
    ["ticket", "followup", "task", "solution", "knowledgebase", "faq"],
    isTech ? FULL : READ_ONLY,
  );
  grant(["computer", "monitor", "printer", "phone", "software"], isTech ? FULL : READ_ONLY);
  grant(["supplier", "contract", "document"], isTech ? FULL : READ_ONLY);
  if (isAdmin) {
    grant(
      [
        "user",
        "group",
        "entity",
        "profile",
        "config",
        "sla",
        "dropdown",
        "calendar",
        "notification",
      ],
      FULL,
    );
  }

  return {
    profiles: [],
    rights,
    flags: isTech ? ["ticket_see_all", "ticket_assign", "followup_see_private"] : [],
    entities: [],
  };
}

export function can(permissions: Permissions, object: string, action: RightAction) {
  return permissions.rights[object]?.[action] === true;
}

export function hasFlag(permissions: Permissions, flag: string) {
  return permissions.flags.includes(flag);
}

/** O perfil de maior alcance do usuário, para exibir no menu do topo. */
export function mainProfileName(permissions: Permissions) {
  const order = [
    "Super-Admin",
    "Admin",
    "Supervisor",
    "Técnico",
    "Hotliner",
    "Observador",
    "Self-Service",
  ];
  for (const name of order) {
    if (permissions.profiles.some((p) => p.name === name)) return name;
  }
  return permissions.profiles[0]?.name ?? "Sem perfil";
}
