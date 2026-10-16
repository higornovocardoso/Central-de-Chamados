import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  password: z.string().min(8).max(72),
  profile_id: z.string().uuid().optional(),
  entity_id: z.string().uuid().optional(),
  is_recursive: z.boolean().default(true),
});

const updateSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().max(180).optional(),
  password: z.string().min(8).max(72).optional(),
});

type ClienteRpc = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

/**
 * O banco decide se quem está logado pode mexer naquela conta: precisa ter o
 * direito em todas as empresas da pessoa, e todos os perfis dela têm que caber
 * nos seus. Assim quem cuida das pessoas de uma empresa não troca a senha de
 * um administrador nem de alguém de outra empresa.
 */
async function assertPodeGerenciar(supabase: ClienteRpc, alvo: string, acao: "update" | "delete") {
  const { data, error } = await supabase.rpc("pode_gerenciar_usuario", {
    _alvo: alvo,
    _acao: acao,
  });
  if (error || data !== true) {
    throw new Error("Você não tem permissão para alterar esta conta.");
  }
}

/** Cria um usuário já confirmado, com perfil e entidade opcionais. */
export const createSystemUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as ClienteRpc;
    const { data: podeCriar } = await supabase.rpc("has_right", {
      _user_id: context.userId,
      _object: "user",
      _action: "create",
    });
    if (podeCriar !== true) {
      throw new Error("Você não tem permissão para criar contas.");
    }
    // Confere antes de criar a conta, para não sobrar conta sem acesso quando
    // o perfil pedido for maior que o de quem está criando.
    if (data.profile_id && data.entity_id) {
      const { data: podeConceder } = await supabase.rpc("pode_conceder_perfil", {
        _profile_id: data.profile_id,
        _entity_id: data.entity_id,
      });
      if (podeConceder !== true) {
        throw new Error("Você não pode conceder este perfil nesta empresa.");
      }
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) {
      throw new Error(error?.message ?? "Não foi possível criar o usuário.");
    }

    const newId = created.user.id;
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: newId, full_name: data.full_name, email: data.email });

    if (data.profile_id && data.entity_id) {
      const { error: authError } = await supabaseAdmin.from("user_authorizations").insert({
        user_id: newId,
        profile_id: data.profile_id,
        entity_id: data.entity_id,
        is_recursive: data.is_recursive,
      });
      if (authError) throw new Error(authError.message);
    }

    return { id: newId };
  });

/** Atualiza nome, e-mail e/ou senha de um usuário existente. */
export const updateSystemUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => updateSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertPodeGerenciar(context.supabase as unknown as ClienteRpc, data.user_id, "update");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const attrs: Record<string, unknown> = {};
    if (data.email) attrs["email"] = data.email;
    if (data.password) attrs["password"] = data.password;
    if (data.full_name) attrs["user_metadata"] = { full_name: data.full_name };

    if (Object.keys(attrs).length > 0) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, attrs);
      if (error) throw new Error(error.message);
    }

    const patch: { full_name?: string; email?: string } = {};
    if (data.full_name) patch.full_name = data.full_name;
    if (data.email) patch.email = data.email;
    if (Object.keys(patch).length > 0) {
      await supabaseAdmin.from("profiles").update(patch).eq("id", data.user_id);
    }

    return { ok: true };
  });

/** Exclui um usuário do sistema. */
export const deleteSystemUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ user_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    if (data.user_id === context.userId) {
      throw new Error("Você não pode excluir a própria conta.");
    }
    await assertPodeGerenciar(context.supabase as unknown as ClienteRpc, data.user_id, "delete");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
