import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Mail, Send, Building2, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ticketCode } from "@/lib/tickets";
import { supabase } from "@/integrations/supabase/client";
import { Convergencia } from "@/components/Convergencia";
import { createPublicTicket, publicTicketSchema } from "@/lib/public-tickets.functions";

/**
 * Rótulos escritos do ponto de vista de quem abre o chamado, não do manual de
 * ITIL: "paralisado" diz mais que "muito alta" para quem só quer voltar a
 * trabalhar. Os números são os mesmos que a priority_matrix espera.
 */
const URGENCIAS = [
  { valor: 1, rotulo: "Posso esperar" },
  { valor: 2, rotulo: "Pouco urgente" },
  { valor: 3, rotulo: "Normal" },
  { valor: 4, rotulo: "Urgente" },
  { valor: 5, rotulo: "Estou paralisado" },
];

export const Route = createFileRoute("/abrir-chamado")({
  head: () => ({
    meta: [
      { title: "Abrir chamado" },
      {
        name: "description",
        content:
          "Formulário para colaboradores registrarem chamados de suporte de T.I. sem precisar de login.",
      },
      { property: "og:title", content: "Abrir chamado" },
      {
        property: "og:description",
        content: "Descreva seu problema de T.I. e a equipe de suporte receberá o chamado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AbrirChamado,
});

/** O caminho do chamado, do lado de quem pede: é uma sequência de verdade. */
const PASSOS = [
  {
    titulo: "Descreva o problema",
    texto: "Assunto, o que acontece e desde quando. Quanto mais detalhe, mais rápido.",
  },
  {
    titulo: "A equipe recebe na hora",
    texto: "O chamado entra na fila com prazo de atendimento e de solução.",
  },
  {
    titulo: "Guarde o protocolo",
    texto: "Com o número do chamado, a equipe encontra o seu pedido quando você falar com ela.",
  },
];

function AbrirChamado() {
  const submit = useServerFn(createPublicTicket);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [urgency, setUrgency] = useState(3);
  const [categoriaId, setCategoriaId] = useState("");

  // As categorias cadastradas em Configuração › Categorias que estão marcadas
  // para aparecer no atendimento. Subcategoria aparece como "Pai › Filha".
  const categoriasQuery = useQuery({
    queryKey: ["categorias-publicas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itil_categories")
        .select("id,name,parent_id")
        .eq("visible_helpdesk", true);
      if (error) throw error;
      return data ?? [];
    },
  });
  const categorias = useMemo(() => {
    const lista = categoriasQuery.data ?? [];
    const porId = new Map(lista.map((c) => [c.id, c]));
    const rotulo = (id: string, guarda = 0): string => {
      const c = porId.get(id);
      if (!c) return "";
      const pai = c.parent_id && guarda < 10 ? rotulo(c.parent_id, guarda + 1) : "";
      return pai ? `${pai} › ${c.name}` : c.name;
    };
    return lista
      .map((c) => ({ id: c.id, rotulo: rotulo(c.id) }))
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  }, [categoriasQuery.data]);
  const categoriaEscolhida = categorias.find((c) => c.id === categoriaId);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    if (categorias.length > 0 && !categoriaEscolhida) {
      toast.error("Escolha a categoria do chamado");
      return;
    }

    const parsed = publicTicketSchema.safeParse({
      reporter_name: String(form.get("name") ?? ""),
      reporter_email: String(form.get("email") ?? ""),
      reporter_sector: String(form.get("sector") ?? ""),
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      // Sem nenhuma categoria cadastrada, o chamado entra como "Outros".
      category: categoriaEscolhida?.rotulo ?? "Outros",
      category_id: categoriaEscolhida?.id,
      urgency,
      site: String(form.get("site") ?? ""),
    });

    if (!parsed.success) {
      toast.error("Confira os dados do chamado", {
        description: parsed.error.issues[0]?.message,
      });
      return;
    }

    setSaving(true);
    try {
      const res = await submit({ data: parsed.data });
      setCreated(res.id);
    } catch (error) {
      // O servidor só devolve frases escritas para quem abre o chamado:
      // domínio não autorizado, muitos chamados seguidos ou falha genérica.
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Não foi possível enviar o chamado. Tente novamente em instantes.",
      );
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    // Sempre escura, como a tela de entrada, com o mesmo fundo: luz no centro,
    // grade fina e as linhas que convergem. O fundo fica parado ao rolar.
    <main className="dark relative min-h-screen bg-[#04060c] px-4 py-10 text-foreground sm:px-6 lg:flex lg:h-dvh lg:items-center lg:overflow-y-auto lg:py-4">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_50%,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_70%)]" />
        <div className="absolute inset-0 [background-image:linear-gradient(var(--grid-line)_1px,transparent_1px),linear-gradient(90deg,var(--grid-line)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_70%_65%_at_50%_50%,#000_20%,transparent_75%)]" />
        <Convergencia />
      </div>

      <div className="relative z-[1] mx-auto grid w-full max-w-6xl items-start gap-10 lg:items-center lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
        {/* Contexto: o que acontece depois de enviar */}
        <section className="rise-in">
          <h1 className="bg-[linear-gradient(180deg,#ffffff,#b9c6e4)] bg-clip-text text-[2.25rem] font-semibold leading-[1.08] tracking-[-0.04em] text-transparent [text-wrap:balance] sm:text-[2.75rem]">
            Conte o que aconteceu. A equipe de T.I. assume daqui.
          </h1>
          <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-muted-foreground">
            Preencha o formulário e guarde o protocolo que aparece no fim.
          </p>

          <ol className="relative mt-9 hidden space-y-6 sm:block">
            <span
              aria-hidden="true"
              className="absolute bottom-3 left-[0.9375rem] top-3 w-px bg-[linear-gradient(180deg,var(--primary),var(--ice),transparent)] opacity-50"
            />
            {PASSOS.map((passo, i) => (
              <li
                key={passo.titulo}
                className="rise-in relative flex gap-4"
                style={{ "--d": `${150 + i * 110}ms` } as React.CSSProperties}
              >
                <span className="relative z-[1] flex size-[1.875rem] shrink-0 items-center justify-center rounded-full border border-primary/30 bg-surface font-mono text-xs font-medium text-primary shadow-[0_0_0_4px_var(--background)]">
                  {i + 1}
                </span>
                <span className="pt-1">
                  <span className="block text-sm font-semibold">{passo.titulo}</span>
                  <span className="mt-0.5 block text-[0.8125rem] text-muted-foreground">
                    {passo.texto}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* Formulário, ou o protocolo depois de enviar */}
        {created ? (
          // A entrada fica no invólucro de fora: no mesmo elemento, ela travaria o giro do feixe.
          <div className="rise-in">
            <div
              className="feixe dark text-foreground shadow-[0_40px_100px_-30px_rgb(42_91_255/0.45)]"
              style={{ borderRadius: 20 }}
            >
              <section
                className="palco flex flex-col items-center px-7 py-12 text-center sm:px-12"
                style={{ borderRadius: 19 }}
              >
                <span className="flex size-14 items-center justify-center rounded-full bg-success/15 text-success shadow-[0_0_40px_-6px_var(--success)]">
                  <CheckCircle2 className="size-7" />
                </span>
                <h2 className="mt-5 text-2xl font-semibold tracking-tight">Chamado enviado</h2>
                <p className="mt-2 text-sm text-muted-foreground">Guarde o seu protocolo:</p>
                <p className="mt-3 rounded-xl border border-border bg-white/[0.04] px-5 py-2.5 font-mono text-2xl tracking-[0.08em] text-ice">
                  {ticketCode(created)}
                </p>
                <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  Ele já está na fila da equipe de T.I. Para falar sobre ele, informe este número.
                </p>
                <Button
                  variant="outline"
                  className="mt-8 h-11 px-6"
                  onClick={() => setCreated(null)}
                >
                  Abrir outro chamado
                </Button>
              </section>
            </div>
          </div>
        ) : (
          // Mesmo cartão da tela de entrada: o feixe gira na borda. A entrada fica
          // no invólucro de fora, senão travaria o giro do feixe.
          <div className="rise-in" style={{ "--d": "90ms" } as React.CSSProperties}>
            <div
              className="feixe shadow-[0_40px_100px_-30px_rgb(42_91_255/0.45)]"
              style={{ borderRadius: 20 }}
            >
              <section
                className="bg-[linear-gradient(180deg,#0d1424,#0a0f1c)] p-6 shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] sm:px-7 sm:py-5"
                style={{ borderRadius: 19 }}
              >
                <div className="mb-4">
                  <h2 className="text-xl font-semibold tracking-tight">Abrir chamado</h2>
                  <p className="mt-1 text-[0.8125rem] text-muted-foreground">
                    Seu nome e e-mail servem para a equipe saber quem pediu e falar com você.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Armadilha para robô: fora da tela e fora do Tab. */}
                  <div
                    aria-hidden="true"
                    className="absolute -left-[9999px] h-px w-px overflow-hidden"
                  >
                    <label htmlFor="site">Não preencha este campo</label>
                    <input id="site" name="site" type="text" tabIndex={-1} autoComplete="off" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-xs">
                        Seu nome
                      </Label>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="name"
                          name="name"
                          required
                          minLength={2}
                          placeholder="Nome completo"
                          className="h-10 pl-9"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-xs">
                        E-mail para contato
                      </Label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          required
                          placeholder="voce@empresa.com"
                          className="h-10 pl-9"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="sector" className="text-xs">
                        Setor / departamento
                      </Label>
                      <div className="relative">
                        <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="sector"
                          name="sector"
                          placeholder="Ex.: Financeiro"
                          className="h-10 pl-9"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="title" className="text-xs">
                        Assunto
                      </Label>
                      <Input
                        id="title"
                        name="title"
                        required
                        minLength={3}
                        placeholder="Resumo do problema"
                        className="h-10"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Categoria</Label>
                      <Select value={categoriaId} onValueChange={setCategoriaId}>
                        <SelectTrigger className="h-10" aria-label="Categoria">
                          <SelectValue
                            placeholder={
                              categoriasQuery.isLoading ? "Carregando…" : "Escolha a categoria"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {categorias.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.rotulo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Urgência</Label>
                      <Select value={String(urgency)} onValueChange={(v) => setUrgency(Number(v))}>
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {URGENCIAS.map((item) => (
                            <SelectItem key={item.valor} value={String(item.valor)}>
                              {item.rotulo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="-mt-2 text-xs text-muted-foreground">
                    Urgência é o quanto isso atrapalha seu trabalho agora.
                  </p>

                  <div className="space-y-1.5">
                    <Label htmlFor="description" className="text-xs">
                      Descrição
                    </Label>
                    <Textarea
                      id="description"
                      name="description"
                      rows={3}
                      placeholder="O que está acontecendo, mensagens de erro e desde quando ocorre."
                    />
                  </div>

                  <Button type="submit" disabled={saving} className="h-10 w-full text-sm">
                    {saving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    {saving ? "Enviando…" : "Enviar chamado"}
                  </Button>
                </form>
              </section>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
