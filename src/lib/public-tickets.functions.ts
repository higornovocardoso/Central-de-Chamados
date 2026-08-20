import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

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
    const supabase = createClient<Database>(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    console.log("PUBKEY", (process.env["SUPABASE_PUBLISHABLE_KEY"]||"none").slice(0,12), "URL", process.env["SUPABASE_URL"]);
    const id = crypto.randomUUID();
    const { error } = await supabase.from("tickets").insert({ ...data, id, status: "aberto" });

    if (error) throw new Error(error.message);
    return { id };
  });
