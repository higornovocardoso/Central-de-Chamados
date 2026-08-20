import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ClipboardList, LifeBuoy, MessagesSquare, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Helpdesk T.I. — Controle de chamados de suporte" },
      {
        name: "description",
        content:
          "Sistema de controle de chamados de T.I.: abertura de tickets, painel com métricas, atribuição a técnicos e histórico de comentários.",
      },
      { property: "og:title", content: "Helpdesk T.I. — Controle de chamados de suporte" },
      {
        property: "og:description",
        content:
          "Abra, acompanhe e resolva chamados de T.I. com painel de métricas e atribuição a técnicos.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="grid-lines min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <LifeBuoy className="size-4" />
          </span>
          <span className="font-display text-sm font-semibold">Helpdesk T.I.</span>
        </div>
        <Button asChild size="sm" variant="secondary">
          <Link to="/auth">Entrar</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-3xl px-4 pt-20 pb-16 text-center">
        <p className="font-mono text-xs tracking-widest text-accent uppercase">
          Suporte técnico interno
        </p>
        <h1 className="mt-4 text-4xl leading-tight font-semibold sm:text-5xl">
          Todo chamado de T.I. sob controle, do registro à solução.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground">
          Centralize as solicitações da equipe, priorize o que é crítico, atribua responsáveis e
          acompanhe o tempo de resposta em um painel único.
        </p>
        <div className="mt-8 flex justify-center">
          <Button asChild size="lg">
            <Link to="/auth">Acessar o sistema</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-24 sm:grid-cols-2 lg:grid-cols-4">
        <Feature
          icon={<ClipboardList className="size-5" />}
          title="Abertura de chamados"
          text="Formulário com categoria, prioridade e descrição detalhada do problema."
        />
        <Feature
          icon={<Activity className="size-5" />}
          title="Painel com métricas"
          text="Abertos, em andamento, resolvidos, críticos e tempo médio de solução."
        />
        <Feature
          icon={<UserCog className="size-5" />}
          title="Atribuição a técnicos"
          text="Defina o responsável e atualize o status a cada etapa do atendimento."
        />
        <Feature
          icon={<MessagesSquare className="size-5" />}
          title="Histórico de interações"
          text="Comentários registrados no chamado mantêm todo o contexto do atendimento."
        />
      </section>
    </div>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="panel p-5">
      <span className="flex size-9 items-center justify-center rounded-md bg-secondary text-accent">
        {icon}
      </span>
      <h2 className="mt-4 text-sm font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
