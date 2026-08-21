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

async function assertCanManageUsers(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> },
  userId: string,
  action: "create" | "update" | "delete",
) {
  const { data } = await supabase.rpc("has_right", {
    _user_id: userId,
    _object: "user",
    _action: action,
  });
  if (data !== true) {
    throw new Error("Você não tem permissão para gerenciar usuários.");
  }
}

/** Cria um usuário já confirmado, com perfil e entidade opcionais. */
export const createSystemUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertCanManageUsers(context.supabase as never, context.userId, "create");
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
    await assertCanManageUsers(context.supabase as never, context.userId, "update");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const attrs: Record<string, unknown> = {};
    if (data.email) attrs["email"] = data.email;
    if (data.password) attrs["password"] = data.password;
    if (data.full_name) attrs["user_metadata"] = { full_name: data.full_name };

    if (Object.keys(attrs).length > 0) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, attrs);
      if (error) throw new Error(error.message);
    }

    const patch: Record<string, string> = {};
    if (data.full_name) patch["full_name"] = data.full_name;
    if (data.email) patch["email"] = data.email;
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
    await assertCanManageUsers(context.supabase as never, context.userId, "delete");
    if (data.user_id === context.userId) {
      throw new Error("Você não pode excluir a própria conta.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
