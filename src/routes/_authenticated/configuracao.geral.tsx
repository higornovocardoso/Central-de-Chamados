import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AvisoAcesso, useAcesso } from "@/components/AccessGate";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { looseDb, type LooseRow } from "@/integrations/supabase/glpi-db";
import { usePermissions } from "@/hooks/usePermissions";

export const Route = createFileRoute("/_authenticated/configuracao/geral")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { aba: "notificacoes" | "assistencia" | "pesquisa" } => {
    const aba = String(search["aba"] ?? "");
    return {
      aba: (["notificacoes", "assistencia", "pesquisa"] as const).includes(aba as never)
        ? (aba as "notificacoes" | "assistencia" | "pesquisa")
        : "notificacoes",
    };
  },
  head: () => ({
    meta: [
      { title: "Configurações gerais — Helpdesk T.I." },
      {
        name: "description",
        content: "Remetente das notificações, fechamento automático e pesquisa de satisfação.",
      },
    ],
  }),
  component: ConfiguracoesGerais,
});

/** No GLPI cada entidade tem sua própria configuração; a raiz serve de padrão. */
type Campo = { key: string; label: string; hint?: string };

const NOTIFICACAO: Campo[] = [
  { key: "admin_name", label: "Nome do administrador" },
  { key: "admin_email", label: "E-mail do administrador", hint: "Recebe cópia dos chamados abertos" },
  { key: "sender_name", label: "Nome do remetente" },
  { key: "sender_email", label: "E-mail do remetente" },
  { key: "reply_to", label: "Responder para" },
  { key: "notification_prefix", label: "Prefixo do assunto", hint: "Vai antes de todo assunto" },
];

const TIPOS = [
  { value: "incidente", label: "Incidente" },
  { value: "requisicao", label: "Requisição" },
];

const ATRIBUICAO = [
  { value: "nenhum", label: "Não atribuir" },
  { value: "categoria", label: "Pelo técnico da categoria" },
  { value: "menor_carga", label: "Para quem tem menos chamados" },
];

function ConfiguracoesGerais() {
  const { can } = usePermissions();
  const acesso = useAcesso("config");
  const { aba } = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const podeEditar = can("config", "update");

  const [entidadeId, setEntidadeId] = useState("");
  const [form, setForm] = useState<Record<string, unknown>>({});

  const entidades = useQuery({
    queryKey: ["entities"],
    queryFn: async () => {
      const { data, error } = await looseDb.from("entities").select("*").order("path");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const lista = (entidades.data ?? []) as LooseRow[];
  const atual = lista.find((e) => e.id === entidadeId) ?? lista[0];

  useEffect(() => {
    if (atual) {
      setEntidadeId(atual.id);
      setForm({ ...atual });
    }
  }, [atual?.id]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!atual) throw new Error("Nenhuma entidade selecionada.");
      const campos = [
        ...NOTIFICACAO.map((c) => c.key),
        "email_signature",
        "notifications_enabled",
        "default_ticket_type",
        "auto_assign_mode",
        "auto_close_days",
        "auto_purge_days",
        "survey_enabled",
        "survey_delay_days",
        "survey_rate",
        "survey_max_score",
        "survey_comment_below",
      ];
      const payload: Record<string, unknown> = {};
      for (const c of campos) payload[c] = form[c] ?? (typeof form[c] === "number" ? 0 : "");
      const { error } = await looseDb.from("entities").update(payload).eq("id", atual.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Configuração salva.");
      queryClient.invalidateQueries({ queryKey: ["entities"] });
    },
    onError: (e: Error) => toast.error("Não foi possível salvar", { description: e.message }),
  });

  const texto = (key: string) => String(form[key] ?? "");
  const numero = (key: string) => Number(form[key] ?? 0);
  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  if (acesso !== "liberado") {
    return <AvisoAcesso titulo="Configurações gerais" estado={acesso} mensagem="Seu perfil não tem acesso à configuração." />;
  }

  return (
    <AppShell
      title="Configurações gerais"
      subtitle="Cada entidade tem a sua; a raiz vale como padrão para as filhas."
      breadcrumbTail="Configurações gerais"
      actions={
        podeEditar ? (
          <Button
            size="sm"
            className="h-8"
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending}
          >
            <Save className="size-3.5" /> Salvar
          </Button>
        ) : null
      }
    >
      <div className="panel mb-3 flex flex-wrap items-center gap-2 p-2">
        <Label className="text-[0.72rem] text-muted-foreground">Entidade</Label>
        <Select value={entidadeId} onValueChange={setEntidadeId}>
          <SelectTrigger className="h-8 w-[260px] text-xs">
            <SelectValue placeholder="Escolha a entidade" />
          </SelectTrigger>
          <SelectContent>
            {lista.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {"— ".repeat(Number(e["level"] ?? 0))}
                {String(e["name"])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={aba} onValueChange={(v) => navigate({ search: { aba: v as never } })}>
        <TabsList className="min-h-8">
          <TabsTrigger value="notificacoes" className="text-xs">
            Notificações
          </TabsTrigger>
          <TabsTrigger value="assistencia" className="text-xs">
            Assistência
          </TabsTrigger>
          <TabsTrigger value="pesquisa" className="text-xs">
            Pesquisa de satisfação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notificacoes" className="mt-3">
          <section className="panel p-4">
            <label className="mb-4 flex items-center gap-2 text-xs">
              <Checkbox
                checked={form["notifications_enabled"] === true}
                disabled={!podeEditar}
                onCheckedChange={(v) => set("notifications_enabled", v === true)}
              />
              Enviar notificações por e-mail nesta entidade
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              {NOTIFICACAO.map((c) => (
                <div key={c.key} className="space-y-1">
                  <Label className="text-[0.72rem]">{c.label}</Label>
                  <Input
                    value={texto(c.key)}
                    disabled={!podeEditar}
                    onChange={(e) => set(c.key, e.target.value)}
                    className="h-8 text-xs"
                  />
                  {c.hint && <p className="text-[0.68rem] text-muted-foreground">{c.hint}</p>}
                </div>
              ))}
            </div>

            <div className="mt-3 space-y-1">
              <Label className="text-[0.72rem]">Assinatura do e-mail</Label>
              <Textarea
                rows={3}
                value={texto("email_signature")}
                disabled={!podeEditar}
                onChange={(e) => set("email_signature", e.target.value)}
                className="text-xs"
              />
              <p className="text-[0.68rem] text-muted-foreground">
                Entra no lugar da etiqueta <code>##assinatura##</code> dos modelos.
              </p>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="assistencia" className="mt-3">
          <section className="panel grid gap-3 p-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-[0.72rem]">Tipo padrão do chamado</Label>
              <Select
                value={String(form["default_ticket_type"] ?? "incidente")}
                disabled={!podeEditar}
                onValueChange={(v) => set("default_ticket_type", v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[0.72rem]">Atribuição automática</Label>
              <Select
                value={String(form["auto_assign_mode"] ?? "nenhum")}
                disabled={!podeEditar}
                onValueChange={(v) => set("auto_assign_mode", v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ATRIBUICAO.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[0.72rem]">Fechar automaticamente depois de (dias)</Label>
              <Input
                type="number"
                value={numero("auto_close_days")}
                disabled={!podeEditar}
                onChange={(e) => set("auto_close_days", Number(e.target.value))}
                className="h-8 text-xs"
              />
              <p className="text-[0.68rem] text-muted-foreground">
                −1 desliga. Vale para chamado solucionado que ninguém fechou.
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-[0.72rem]">Purgar da lixeira depois de (dias)</Label>
              <Input
                type="number"
                value={numero("auto_purge_days")}
                disabled={!podeEditar}
                onChange={(e) => set("auto_purge_days", Number(e.target.value))}
                className="h-8 text-xs"
              />
              <p className="text-[0.68rem] text-muted-foreground">−1 desliga.</p>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="pesquisa" className="mt-3">
          <section className="panel p-4">
            <label className="mb-4 flex items-center gap-2 text-xs">
              <Checkbox
                checked={form["survey_enabled"] === true}
                disabled={!podeEditar}
                onCheckedChange={(v) => set("survey_enabled", v === true)}
              />
              Gerar pesquisa de satisfação ao fechar o chamado
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[0.72rem]">Enviar depois de (dias)</Label>
                <Input
                  type="number"
                  value={numero("survey_delay_days")}
                  disabled={!podeEditar}
                  onChange={(e) => set("survey_delay_days", Number(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[0.72rem]">Percentual dos chamados (%)</Label>
                <Input
                  type="number"
                  value={numero("survey_rate")}
                  disabled={!podeEditar}
                  onChange={(e) => set("survey_rate", Number(e.target.value))}
                  className="h-8 text-xs"
                />
                <p className="text-[0.68rem] text-muted-foreground">
                  100 pesquisa todos; 20 sorteia um em cada cinco.
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-[0.72rem]">Nota máxima</Label>
                <Input
                  type="number"
                  value={numero("survey_max_score")}
                  disabled={!podeEditar}
                  onChange={(e) => set("survey_max_score", Number(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[0.72rem]">Pedir comentário abaixo de</Label>
                <Input
                  type="number"
                  value={numero("survey_comment_below")}
                  disabled={!podeEditar}
                  onChange={(e) => set("survey_comment_below", Number(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
