import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/useRoles";
import { KB_CATEGORIES } from "@/lib/glpi";
import { Tag } from "@/components/Tag";

export const Route = createFileRoute("/_authenticated/base-conhecimento")({
  head: () => ({
    meta: [
      { title: "Base de conhecimento" },
      {
        name: "description",
        content:
          "Artigos e soluções padronizadas de T.I. para resolver problemas recorrentes com mais rapidez.",
      },
      { property: "og:title", content: "Base de conhecimento" },
      {
        property: "og:description",
        content: "Procedimentos e soluções de T.I. pesquisáveis pela equipe.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BaseConhecimento,
});

type Article = {
  id: string;
  title: string;
  category: string;
  summary: string;
  body: string;
  published: boolean;
};

const EMPTY = {
  title: "",
  category: "Geral",
  summary: "",
  body: "",
  published: true,
};

function BaseConhecimento() {
  const { isStaff } = useRoles();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Article | null>(null);
  const [form, setForm] = useState(EMPTY);

  const articlesQuery = useQuery({
    queryKey: ["kb_articles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kb_articles")
        .select("id,title,category,summary,body,published")
        .order("title");
      if (error) throw error;
      return data as Article[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Informe o título do artigo.");
      if (editing) {
        const { error } = await supabase.from("kb_articles").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("kb_articles").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Artigo salvo.");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["kb_articles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kb_articles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Artigo removido.");
      queryClient.invalidateQueries({ queryKey: ["kb_articles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (articlesQuery.data ?? []).filter(
      (a) =>
        !term ||
        [a.title, a.category, a.summary, a.body].join(" ").toLowerCase().includes(term),
    );
  }, [articlesQuery.data, search]);

  return (
    <AppShell
      title="Base de conhecimento"
      subtitle="Soluções padronizadas para os problemas mais frequentes."
      actions={
        isStaff ? (
          <Button
            size="sm"
            className="h-8"
            onClick={() => {
              setEditing(null);
              setForm(EMPTY);
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> Adicionar
          </Button>
        ) : null
      }
    >
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Pesquisar artigos..."
        className="mb-4 sm:max-w-sm"
      />

      <div className="panel p-2">
        {articlesQuery.isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Carregando artigos...</p>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <BookOpen className="mx-auto mb-2 size-6 opacity-60" />
            Nenhum artigo encontrado.
          </div>
        ) : (
          <Accordion type="single" collapsible>
            {filtered.map((a) => (
              <AccordionItem key={a.id} value={a.id}>
                <AccordionTrigger className="px-3">
                  <div className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{a.title}</span>
                      <Tag className="border-border bg-secondary text-muted-foreground">
                        {a.category}
                      </Tag>
                      {!a.published && (
                        <Tag className="border-warning/30 bg-warning/15 text-warning">Rascunho</Tag>
                      )}
                    </div>
                    {a.summary && (
                      <span className="text-xs font-normal text-muted-foreground">{a.summary}</span>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-3">
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>
                  {isStaff && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(a);
                          setForm({
                            title: a.title,
                            category: a.category,
                            summary: a.summary,
                            body: a.body,
                            published: a.published,
                          });
                          setOpen(true);
                        }}
                      >
                        <Pencil className="size-4" /> Editar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove.mutate(a.id)}>
                        <Trash2 className="size-4" /> Excluir
                      </Button>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar artigo" : "Novo artigo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Título *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KB_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Resumo</Label>
              <Input
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Conteúdo</Label>
              <Textarea
                rows={10}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.published}
                onCheckedChange={(v) => setForm({ ...form, published: v })}
              />
              <span className="text-sm">Publicado para toda a equipe</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
