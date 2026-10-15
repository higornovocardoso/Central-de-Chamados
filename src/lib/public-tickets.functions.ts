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
  category: z.string().trim().min(1).max(160),
  /** Categoria cadastrada; o texto acima é o nome dela, para a lista e o histórico. */
  category_id: z.string().uuid().optional(),
  /**
   * Urgência, não prioridade. Quem abre o chamado diz o quanto aquilo o atrapalha;
   * o impacto — quantas pessoas foram afetadas — é julgamento de quem atende. A
   * prioridade sai do cruzamento dos dois, pela priority_matrix, num gatilho do
   * banco.
   *
   * Antes o formulário mandava priority direto, e o gatilho recalculava por cima
   * a partir de urgência e impacto que nunca recebia. Na prática a escolha da
   * pessoa era descartada e todo chamado nascia "média".
   */
  urgency: z.number().int().min(1).max(5),
  /**
   * Armadilha para robô: campo escondido de quem usa a tela. Gente deixa
   * vazio; robô que preenche tudo o que acha cai aqui.
   */
  site: z.string().max(200).optional(),
});

const schema = publicTicketSchema;

/** Mensagem única para domínio desconhecido, reaproveitada nos dois pontos. */
const DOMINIO_NAO_AUTORIZADO =
  "Este e-mail não está autorizado a abrir chamados. Use o endereço da sua empresa, " +
  "ou fale com o suporte para cadastrá-lo.";

/**
 * O que volta para a tela é sempre uma frase para quem está abrindo o
 * chamado; o detalhe técnico fica só no log do servidor.
 */
const FALHA_GENERICA = "Não foi possível enviar o chamado. Tente novamente em instantes.";

export const createPublicTicket = createServerFn({ method: "POST" })
  .validator((data: unknown) => schema.parse(data))
  .handler(async ({ data: { site, ...data } }) => {
    // Robô: responde como se tivesse dado certo, para ele não aprender a
    // contornar, e não grava nada.
    if (site) {
      return { id: crypto.randomUUID() };
    }

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
      console.error(`[chamado público] rota da empresa respondeu ${rota.status}`);
      throw new Error(FALHA_GENERICA);
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
      // impact fica no meio da escala: quem abre o chamado não tem como saber
      // quantas pessoas foram afetadas. Quem atende ajusta depois, e a
      // prioridade se recalcula sozinha.
      body: JSON.stringify({ ...data, id, entity_id, impact: 3, status: "aberto" }),
    });

    if (!response.ok) {
      // A política do banco confere a mesma regra de domínio. Chegar aqui com
      // 401 ou 403 significa que a entidade parou de aceitar chamado de fora
      // entre a consulta acima e a gravação.
      if (response.status === 401 || response.status === 403) {
        throw new Error(DOMINIO_NAO_AUTORIZADO);
      }
      // P0001 é o limite de chamados por e-mail do banco (fase 31): a
      // mensagem dele já é escrita para quem está abrindo.
      const erro = (await response.json().catch(() => null)) as {
        code?: string;
        message?: string;
      } | null;
      if (erro?.code === "P0001" && erro.message) {
        throw new Error(erro.message);
      }
      console.error(`[chamado público] gravação respondeu ${response.status}`, erro?.code);
      throw new Error(FALHA_GENERICA);
    }

    return { id };
  });
