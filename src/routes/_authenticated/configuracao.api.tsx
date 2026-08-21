import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AvisoAcesso, useAcesso } from "@/components/AccessGate";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";

export const Route = createFileRoute("/_authenticated/configuracao/api")({
  head: () => ({
    meta: [
      { title: "API — Helpdesk T.I." },
      {
        name: "description",
        content: "Como consultar e gravar dados do sistema por fora, pela API REST.",
      },
    ],
  }),
  component: Api,
});

const ENDPOINTS = [
  { path: "/rest/v1/tickets", desc: "Chamados" },
  { path: "/rest/v1/assets", desc: "Ativos" },
  { path: "/rest/v1/contracts", desc: "Contratos" },
  { path: "/rest/v1/problems", desc: "Problemas" },
  { path: "/rest/v1/changes", desc: "Mudanças" },
  { path: "/rest/v1/projects", desc: "Projetos" },
  { path: "/rest/v1/rpc/my_permissions", desc: "Permissões do usuário atual" },
  { path: "/rest/v1/rpc/run_automatic_action", desc: "Executa uma ação automática" },
];

function Api() {
  const { can } = usePermissions();
  const acesso = useAcesso("config");
  const [copied, setCopied] = useState("");
  const baseUrl = String(import.meta.env["VITE_SUPABASE_URL"] ?? "");

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      toast.error("Não foi possível copiar", { description: value });
    }
  }

  if (acesso !== "liberado") {
    return <AvisoAcesso titulo="API" estado={acesso} mensagem="Seu perfil não tem acesso à configuração." />;
  }

  const exampleCurl = `curl "${baseUrl}/rest/v1/tickets?select=id,title,status&status=eq.aberto" \\
  -H "apikey: SUA_CHAVE" \\
  -H "Authorization: Bearer SEU_TOKEN"`;

  return (
    <AppShell
      title="API"
      subtitle="Ler e gravar de fora — para integrar com planilha, script ou outro sistema."
      breadcrumbTail="API"
    >
      <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          <section className="panel p-4">
            <h2 className="mb-2 text-xs font-semibold">Endereço base</h2>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-secondary px-2 py-1.5 text-[0.72rem]">
                {baseUrl || "não configurado"}
              </code>
              <Button
                size="icon"
                variant="outline"
                className="size-8"
                aria-label="Copiar endereço"
                onClick={() => copy(baseUrl, "base")}
              >
                {copied === "base" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              </Button>
            </div>
            <p className="mt-2 text-[0.72rem] text-muted-foreground">
              A API é a do próprio Supabase (PostgREST). Toda tabela vira endereço, e as mesmas
              políticas de segurança do sistema valem aqui — um token de técnico enxerga o que o
              técnico enxerga na tela.
            </p>
          </section>

          <section className="panel overflow-hidden">
            <header className="panel-header">Principais endereços</header>
            <div className="overflow-x-auto">
              <table className="glpi-table">
                <thead>
                  <tr>
                    <th>Endereço</th>
                    <th>O que devolve</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {ENDPOINTS.map((e) => (
                    <tr key={e.path}>
                      <td className="font-mono text-[0.72rem]">{e.path}</td>
                      <td className="text-muted-foreground">{e.desc}</td>
                      <td>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          aria-label="Copiar endereço completo"
                          onClick={() => copy(baseUrl + e.path, e.path)}
                        >
                          {copied === e.path ? (
                            <Check className="size-3.5" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel p-4">
            <h2 className="mb-2 text-xs font-semibold">Exemplo</h2>
            <pre className="overflow-x-auto rounded bg-secondary p-3 text-[0.7rem] leading-relaxed">
              {exampleCurl}
            </pre>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 h-8"
              onClick={() => copy(exampleCurl, "curl")}
            >
              {copied === "curl" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              Copiar exemplo
            </Button>
          </section>
        </div>

        <div className="space-y-3">
          <section className="panel p-4 text-[0.72rem] text-muted-foreground">
            <h2 className="mb-2 text-xs font-semibold text-foreground">Como autenticar</h2>
            <p className="mb-2">
              São dois cabeçalhos. O <code>apikey</code> identifica o projeto e é a chave pública
              que já está no aplicativo. O <code>Authorization</code> carrega o token do usuário,
              obtido no login.
            </p>
            <p>
              Para um script que roda sozinho, o caminho é criar um usuário próprio de integração,
              com um perfil restrito ao que ele precisa — e não usar a chave de serviço, que ignora
              todas as políticas de segurança.
            </p>
          </section>

          <section className="panel p-4 text-[0.72rem] text-muted-foreground">
            <h2 className="mb-2 text-xs font-semibold text-foreground">Filtros</h2>
            <p className="mb-1">
              <code>?status=eq.aberto</code> — igual
            </p>
            <p className="mb-1">
              <code>?priority_level=gte.4</code> — maior ou igual
            </p>
            <p className="mb-1">
              <code>?title=ilike.*impressora*</code> — contém
            </p>
            <p className="mb-1">
              <code>?order=created_at.desc&amp;limit=50</code> — ordem e limite
            </p>
            <p className="mt-2">
              <code>?select=id,title,status</code> escolhe as colunas. É o mesmo formato que o
              aplicativo usa por dentro.
            </p>
          </section>

          <section className="panel p-4 text-[0.72rem] text-muted-foreground">
            <h2 className="mb-2 text-xs font-semibold text-foreground">Diferença para o GLPI</h2>
            <p>
              O GLPI tem uma API própria, com sessão e <code>app_token</code>. Aqui a API é a do
              banco, o que dá acesso a tudo sem escrever endpoint — mas os nomes dos campos são os
              do banco, não os do GLPI.
            </p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
