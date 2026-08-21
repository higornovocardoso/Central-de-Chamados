import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tag } from "@/components/Tag";
import { looseDb, type LooseRow } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";
import { useSessionUser } from "@/hooks/useSession";
import { formatDate } from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/ferramentas/buscas-salvas")({
  head: () => ({
    meta: [
      { title: "Buscas salvas — Helpdesk T.I." },
      {
        name: "description",
        content: "As pesquisas guardadas em cada tela, com contador e visibilidade.",
      },
    ],
  }),
  component: BuscasSalvas,
});

/** Nome de cada tela, para não mostrar o nome cru da tabela. */
const ITEM_LABEL: Record<string, string> = {
  ticket: "Chamados",
  asset: "Ativos",
  problem: "Problemas",
  change: "Mudanças",
  contract: "Contratos",
  supplier: "Fornecedores",
  system_log: "Logs",
  notification_queue: "Fila de e-mails",
  project: "Projetos",
  document: "Documentos",
};

function BuscasSalvas() {
  const { can } = usePermissions();
  const { user } = useSessionUser();
  const queryClient = useQueryClient();

  const buscas = useQuery({
    queryKey: ["saved_searches_todas"],
    queryFn: async () => {
      const { data, error } = await looseDb
        .from("saved_searches")
        .select("*")
        .order("item_type");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, campo, valor }: { id: string; campo: string; valor: boolean }) => {
      const payload: Record<string, boolean> = {};
      payload[campo] = valor;
      const { error } = await looseDb.from("saved_searches").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved_searches_todas"] }),
    onError: (e: Error) => toast.error("Não foi possível alterar", { description: e.message }),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await looseDb.from("saved_searches").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Busca removida.");
      queryClient.invalidateQueries({ queryKey: ["saved_searches_todas"] });
    },
    onError: (e: Error) => toast.error("Não foi possível remover", { description: e.message }),
  });

  const linhas = (buscas.data ?? []) as LooseRow[];
  const podePublicar = can("public_bookmark", "update");

  /** Quantos critérios a busca guarda, para dar noção do que ela filtra. */
  const criterios = (row: LooseRow) => {
    const c = row["criteria"];
    return Array.isArray(c) ? c.length : 0;
  };

  return (
    <AppShell
      title="Buscas salvas"
      subtitle="As pesquisas que você guardou em cada tela, e quais aparecem com contador."
      breadcrumbTail="Buscas salvas"
    >
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="glpi-table">
            <thead>
              <tr>
                <th>Busca</th>
                <th>Tela</th>
                <th>Critérios</th>
                <th>Pública</th>
                <th>Contador</th>
                <th>Criada em</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {buscas.isError && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    A tabela de buscas salvas ainda não existe no banco.
                  </td>
                </tr>
              )}
              {!buscas.isError && linhas.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Nenhuma busca salva. Elas nascem na barra de pesquisa de cada tela, no botão
                    “Salvar busca”.
                  </td>
                </tr>
              )}
              {linhas.map((b) => {
                const minha = b["user_id"] === user?.id;
                const posso = minha || podePublicar;
                return (
                  <tr key={b.id}>
                    <td className="font-medium">{String(b["name"])}</td>
                    <td>
                      <Tag className="border-border bg-secondary text-muted-foreground">
                        {ITEM_LABEL[String(b["item_type"])] ?? String(b["item_type"])}
                      </Tag>
                    </td>
                    <td className="tabular-nums text-muted-foreground">{criterios(b)}</td>
                    <td>
                      <Checkbox
                        checked={b["is_public"] === true}
                        disabled={!posso}
                        onCheckedChange={(v) =>
                          atualizar.mutate({ id: b.id, campo: "is_public", valor: v === true })
                        }
                      />
                    </td>
                    <td>
                      <Checkbox
                        checked={b["show_counter"] === true}
                        disabled={!posso}
                        onCheckedChange={(v) =>
                          atualizar.mutate({ id: b.id, campo: "show_counter", valor: v === true })
                        }
                      />
                    </td>
                    <td className="whitespace-nowrap text-muted-foreground">
                      {formatDate(String(b["created_at"]))}
                    </td>
                    <td>
                      {posso && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          aria-label="Remover busca"
                          onClick={() => remover.mutate(b.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-2 text-[0.7rem] text-muted-foreground">
        Busca pública aparece para todo mundo; sem isso, só para quem a criou. O contador é o número
        que o GLPI mostra ao lado do nome no painel.
      </p>
    </AppShell>
  );
}
