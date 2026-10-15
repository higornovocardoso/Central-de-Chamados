import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AvisoAcesso, useAcesso } from "@/components/AccessGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  head: () => ({
    meta: [
      { title: "Configurações gerais" },
      {
        name: "description",
        content: "Fechamento automático dos chamados solucionados, por empresa.",
      },
    ],
  }),
  component: ConfiguracoesGerais,
});

/**
 * Fica só o que o sistema de fato executa: o fechamento automático, que a
 * rotina de hora em hora aplica em cada empresa. auto_close_days = -1 desliga.
 */
function ConfiguracoesGerais() {
  const { can } = usePermissions();
  const acesso = useAcesso("config");
  const queryClient = useQueryClient();
  const podeEditar = can("config", "update");

  const [entidadeId, setEntidadeId] = useState("");
  const [ligado, setLigado] = useState(false);
  const [dias, setDias] = useState("7");

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
  const salvoDias = Number(atual?.["auto_close_days"] ?? -1);

  // Recarrega o formulário só quando troca de empresa (ou o valor salvo muda),
  // para um refetch em segundo plano não apagar o que está sendo digitado.
  useEffect(() => {
    if (!atual) return;
    setEntidadeId(atual.id);
    setLigado(salvoDias >= 0);
    setDias(String(salvoDias >= 0 ? salvoDias : 7));
  }, [atual?.id, salvoDias]); // eslint-disable-line react-hooks/exhaustive-deps

  const valorNovo = ligado ? Number(dias) : -1;
  const alterado = valorNovo !== salvoDias;

  const salvar = useMutation({
    mutationFn: async () => {
      if (!atual) throw new Error("Nenhuma empresa selecionada.");
      if (ligado && (!Number.isInteger(valorNovo) || valorNovo < 0)) {
        throw new Error("Informe um número inteiro de dias, zero ou mais.");
      }
      const { error } = await looseDb
        .from("entities")
        .update({ auto_close_days: valorNovo })
        .eq("id", atual.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Configuração salva");
      queryClient.invalidateQueries({ queryKey: ["entities"] });
    },
    onError: (e: Error) => toast.error("Não foi possível salvar", { description: e.message }),
  });

  if (acesso !== "liberado") {
    return (
      <AvisoAcesso
        titulo="Configurações gerais"
        estado={acesso}
        mensagem="Seu perfil não tem acesso à configuração."
      />
    );
  }

  return (
    <AppShell
      title="Configurações gerais"
      subtitle="Cada empresa tem a sua."
      breadcrumbTail="Configurações gerais"
    >
      {lista.length > 1 && (
        <div className="panel mb-3 flex flex-wrap items-center gap-2 p-3">
          <Label className="text-xs text-muted-foreground">Empresa</Label>
          <Select value={entidadeId} onValueChange={setEntidadeId}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Escolha a empresa" />
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
      )}

      <section className="panel max-w-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">Fechamento automático</h2>
            <p className="mt-1 text-[0.8125rem] text-muted-foreground">
              Fecha o chamado solucionado que ninguém fechou depois de alguns dias. A verificação
              roda de hora em hora.
            </p>
          </div>
          <Switch
            checked={ligado}
            disabled={!podeEditar}
            onCheckedChange={setLigado}
            aria-label="Fechar automaticamente os chamados solucionados"
          />
        </div>

        {ligado && (
          <div className="mt-4 flex items-center gap-2">
            <Label htmlFor="dias" className="text-[0.8125rem]">
              Fechar depois de
            </Label>
            <Input
              id="dias"
              inputMode="numeric"
              value={dias}
              disabled={!podeEditar}
              onChange={(e) => setDias(e.target.value)}
              className="w-20 tabular-nums"
            />
            <span className="text-[0.8125rem] text-muted-foreground">dias solucionado</span>
          </div>
        )}

        {podeEditar && (
          <div className="mt-5 flex justify-end">
            <Button onClick={() => salvar.mutate()} disabled={!alterado || salvar.isPending}>
              {salvar.isPending && <Loader2 className="size-4 animate-spin" />}
              Salvar
            </Button>
          </div>
        )}
      </section>
    </AppShell>
  );
}
