import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  reporter_name: z.string().trim().min(2).max(120),
  reporter_email: z.string().trim().email().max(180),
  reporter_sector: z.string().trim().max(120).default(""),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(4000).default(""),
  category: z.string().trim().min(1).max(60),
  priority: z.enum(["baixa", "media", "alta", "critica"]),
});

export const createPublicTicket = createServerFn({ method: "POST" })
  .validator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"]!;
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const id = crypto.randomUUID();

    // Insere como visitante (papel anon). Sem "return=representation": o papel
    // anon pode criar chamados, mas não pode lê-los de volta.
    const response = await fetch(`${url}/rest/v1/tickets`, {
      method: "POST",
      headers: {
        apikey: key,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ ...data, id, status: "aberto" }),
    });

    if (!response.ok) {
      throw new Error(`Falha ao registrar chamado (${response.status})`);
    }

    return { id };
  });
