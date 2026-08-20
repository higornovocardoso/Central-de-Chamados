// Entrega as notificações pendentes da fila usando o Resend.
//
// Segredos esperados:
//   RESEND_API_KEY   — chave do Resend
//   NOTIFY_FROM      — remetente, ex.: "Helpdesk T.I. <chamados@suaempresa.com.br>"
//
// Sem RESEND_API_KEY a função não falha: apenas responde que o envio está
// desligado e deixa a fila intacta, para nada se perder.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BATCH_SIZE = 50;

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ error: "Método não suportado" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Ambiente do Supabase não configurado" }, 500);
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("NOTIFY_FROM") ?? "Helpdesk T.I. <onboarding@resend.dev>";

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: pending, error } = await supabase
    .from("notification_queue")
    .select("*")
    .eq("state", "pendente")
    .lt("attempts", 5)
    .order("created_at")
    .limit(BATCH_SIZE);

  if (error) return json({ error: error.message }, 500);
  if (!pending || pending.length === 0) return json({ sent: 0, pending: 0 });

  if (!apiKey) {
    return json({
      sent: 0,
      pending: pending.length,
      warning: "RESEND_API_KEY não configurada. A fila segue aguardando.",
    });
  }

  let sent = 0;
  const failures: string[] = [];

  for (const item of pending) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [item.recipient_email],
          subject: item.subject,
          text: item.body_text,
          ...(item.body_html ? { html: item.body_html } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${await response.text()}`);
      }

      await supabase
        .from("notification_queue")
        .update({ state: "enviado", sent_at: new Date().toISOString() })
        .eq("id", item.id);
      sent++;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      failures.push(`${item.recipient_email}: ${message}`);
      await supabase
        .from("notification_queue")
        .update({
          state: item.attempts >= 4 ? "erro" : "pendente",
          attempts: item.attempts + 1,
          error: message,
        })
        .eq("id", item.id);
    }
  }

  return json({ sent, failed: failures.length, failures });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
