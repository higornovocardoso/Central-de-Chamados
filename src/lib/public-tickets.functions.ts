import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const publicTicketSchema = z.object({
  reporter_name: z.string().trim().min(2, "Informe seu nome completo.").max(120),
  reporter_email: z
    .string()
    .trim()
    .min(1, "Informe um e-mail para contato.")
    .email("Informe um e-mail válido, como voce@empresa.com.")
    .max(180),
  reporter_sector: z.string().trim().max(120).default(""),
  title: z.string().trim().min(3, "Descreva o assunto do chamado.").max(160),
  description: z.string().trim().max(4000).default(""),
  category: z.string().trim().min(1).max(60),
  priority: z.enum(["baixa", "media", "alta", "critica"]),
});

const schema = publicTicketSchema;

/** Mensagem única para domínio desconhecido, reaproveitada nos dois pontos. */
const DOMINIO_NAO_AUTORIZADO =
  "Este e-mail não está autorizado a abrir chamados. Use o endereço da sua empresa, " +
  "ou fale com o suporte para cadastrá-lo.";

export const createPublicTicket = createServerFn({ method: "POST" })
  .validator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"]!;
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const id = crypto.randomUUID();

    // O domínio do e-mail decide de qual empresa é o chamado. Sem isto o
    // entity_id cairia no default da coluna e todo chamado de fora iria parar
    // na mesma empresa, seja qual for o solicitante.
    const rota = await fetch(`${url}/rest/v1/rpc/entidade_por_email_publico`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ _email: data.reporter_email }),
    });

    if (!rota.ok) {
      throw new Error(`Falha ao identificar a empresa (${rota.status})`);
    }

    const entity_id = (await rota.json()) as string | null;
    if (!entity_id) {
      throw new Error(DOMINIO_NAO_AUTORIZADO);
    }

    // Insere como visitante (papel anon). Sem "return=representation": o papel
    // anon pode criar chamados, mas não pode lê-los de volta.
    const response = await fetch(`${url}/rest/v1/tickets`, {
      method: "POST",
      headers: {
        apikey: key,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ ...data, id, entity_id, status: "aberto" }),
    });

    if (!response.ok) {
      // A política do banco confere a mesma regra de domínio. Chegar aqui com
      // 401 ou 403 significa que a entidade parou de aceitar chamado de fora
      // entre a consulta acima e a gravação.
      if (response.status === 401 || response.status === 403) {
        throw new Error(DOMINIO_NAO_AUTORIZADO);
      }
      throw new Error(`Falha ao registrar chamado (${response.status})`);
    }

    return { id };
  });
