// Recebe um e-mail encaminhado por webhook e vira chamado ou acompanhamento.
//
// Aponte o webhook do seu provedor de e-mail de entrada (Resend Inbound,
// Postmark, Cloudflare Email Worker) para:
//   POST /functions/v1/inbound-email?token=<secret_token do coletor>
//
// Corpo aceito (o que a maioria dos provedores manda):
//   { "from": "...", "to": "...", "subject": "...", "text": "...", "html": "..." }
//
// Assunto contendo o número de um chamado (#ABCD1234) vira acompanhamento
// daquele chamado; o resto abre chamado novo, como o coletor do GLPI.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? req.headers.get("x-collector-token");
  if (!token) return json({ error: "Token do coletor ausente" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Ambiente não configurado" }, 500);

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: collector } = await supabase
    .from("mail_collectors")
    .select("*")
    .eq("secret_token", token)
    .eq("is_active", true)
    .maybeSingle();

  if (!collector) return json({ error: "Coletor não encontrado ou inativo" }, 403);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Corpo inválido" }, 400);
  }

  const fromRaw = String(payload["from"] ?? "");
  const email = extractEmail(fromRaw);
  const name = extractName(fromRaw) || email.split("@")[0] || "Remetente";
  const subject = String(payload["subject"] ?? "").trim() || "Chamado por e-mail";
  const text = String(payload["text"] ?? payload["html"] ?? "").trim();

  if (!email) return json({ error: "Remetente sem e-mail" }, 400);

  // Lista negra: domínios e endereços que não devem abrir chamado.
  const { data: blacklist } = await supabase.from("collector_blacklist").select("value");
  const blocked = (blacklist ?? []).some((b: { value: string }) => {
    const v = b.value.toLowerCase().trim();
    return v && (email.toLowerCase() === v || email.toLowerCase().endsWith(v));
  });
  if (blocked) return json({ skipped: "Remetente na lista negra" });

  // Assunto com o número de um chamado vira acompanhamento.
  const match = subject.match(/#([0-9A-Fa-f]{8})/);
  if (match) {
    const prefix = match[1].toLowerCase();
    const { data: existing } = await supabase
      .from("tickets")
      .select("id")
      .ilike("id", `${prefix}%`)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase.from("ticket_comments").insert({
        ticket_id: existing.id,
        author_id: null,
        body: `De: ${fromRaw}\n\n${text}`,
        is_private: false,
        source_id: collector.default_source_id,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ followup_on: existing.id });
    }
  }

  // Usuário conhecido vira requerente; desconhecido entra pelos campos livres.
  const { data: person } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert({
      title: subject.slice(0, 140),
      description: text,
      type: collector.default_type,
      category_id: collector.default_category_id,
      request_source_id: collector.default_source_id,
      entity_id: collector.entity_id,
      requester_id: person?.id ?? null,
      reporter_name: person ? "" : name,
      reporter_email: person ? "" : email,
      status: "aberto",
    })
    .select("id")
    .single();

  if (error) return json({ error: error.message }, 500);

  await supabase
    .from("mail_collectors")
    .update({ last_run_at: new Date().toISOString() })
    .eq("id", collector.id);

  return json({ ticket: ticket.id });
});

function extractEmail(value: string) {
  const angle = value.match(/<([^>]+)>/);
  const raw = angle ? angle[1] : value;
  const found = raw.match(/[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+/);
  return found ? found[0].trim() : "";
}

function extractName(value: string) {
  const angle = value.indexOf("<");
  return angle > 0 ? value.slice(0, angle).replace(/"/g, "").trim() : "";
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
