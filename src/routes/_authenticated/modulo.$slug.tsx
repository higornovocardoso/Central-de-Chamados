import { createFileRoute, Link } from "@tanstack/react-router";
import { Construction } from "lucide-react";
import { AppShell } from "@/components/AppShell";

/**
 * Tela única para os módulos do GLPI que ainda não foram construídos.
 * O menu já leva a eles para que a navegação fique completa desde a etapa 1.
 */
const MODULES: Record<string, { title: string; description: string; note?: string }> = {
  "fila-de-emails": {
    title: "Fila de e-mails",
    description:
      "As notificações aguardando envio, as que saíram e as que falharam, com reenvio manual.",
    note: "Depende da entrega de e-mail, que ainda não foi configurada. A tela já existe no código e volta ao menu quando o envio for ligado.",
  },
  notificacoes: {
    title: "Notificações",
    description:
      "Quais eventos avisam quem, e o texto de cada modelo de mensagem enviado por e-mail.",
    note: "Depende da entrega de e-mail, que ainda não foi configurada. A tela já existe no código e volta ao menu quando o envio for ligado.",
  },
  coletores: {
    title: "Coletores de e-mail",
    description:
      "Caixas de entrada lidas pelo sistema para abrir chamado a partir de e-mail recebido.",
    note: "Depende da entrega de e-mail, que ainda não foi configurada. A tela já existe no código e volta ao menu quando o envio for ligado.",
  },
  contratos: {
    title: "Contratos",
    description:
      "Contratos de suporte e locação com fornecedor, vigência, valor e alerta de vencimento, vinculados aos ativos.",
  },
  contatos: {
    title: "Contatos",
    description: "Agenda de contatos dos fornecedores e prestadores, ligada a cada fornecedor.",
  },
  documentos: {
    title: "Documentos",
    description:
      "Arquivos anexados a chamados, ativos e contratos: notas fiscais, manuais e termos de responsabilidade.",
  },
  notas: {
    title: "Notas",
    description: "Anotações internas da equipe de T.I., públicas ou privadas.",
  },
  relatorios: {
    title: "Relatórios",
    description:
      "Relatórios de chamados por período, técnico, categoria e cumprimento de SLA, com exportação.",
  },
  usuarios: {
    title: "Usuários",
    description:
      "Lista de usuários com perfil, entidade, grupo e histórico de chamados abertos por cada um.",
  },
  grupos: {
    title: "Grupos",
    description:
      "Grupos de técnicos e de solicitantes, para atribuir chamados a um time em vez de a uma pessoa.",
  },
  entidades: {
    title: "Entidades",
    description:
      "Árvore de entidades do GLPI: cada empresa ou filial com seus próprios chamados, ativos e usuários.",
  },
  perfis: {
    title: "Perfis",
    description: "Perfis de acesso e as permissões de cada um sobre chamados, ativos e configurações.",
  },
  categorias: {
    title: "Categorias de chamado",
    description:
      "Árvore de categorias ITIL, hoje fixa no código, para você editar sem depender de alteração no sistema.",
  },
  slas: {
    title: "SLAs",
    description:
      "Definição dos prazos de resposta e de solução por prioridade, com horário de atendimento.",
  },
  status: {
    title: "Status",
    description: "Situações do chamado e as transições permitidas entre elas.",
  },
  configuracoes: {
    title: "Configurações gerais",
    description: "Nome da instalação, logotipo, fuso horário, notificações por e-mail e preferências.",
  },
};

export const Route = createFileRoute("/_authenticated/modulo/$slug")({
  head: () => ({
    meta: [{ title: "Módulo — Helpdesk T.I." }, { name: "robots", content: "noindex" }],
  }),
  component: Modulo,
});

function Modulo() {
  const { slug } = Route.useParams();
  const module = MODULES[slug];

  return (
    <AppShell
      title={module?.title ?? "Módulo"}
      breadcrumbTail={module?.title ?? slug}
      subtitle="Módulo do GLPI ainda não construído"
    >
      <div className="panel flex flex-col items-center gap-2 p-12 text-center">
        <Construction className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium">{module?.title ?? slug}</p>
        <p className="max-w-lg text-xs text-muted-foreground">
          {module?.description ?? "Este módulo ainda não foi construído."}
        </p>
        <p className="mt-2 text-[0.7rem] text-muted-foreground">
          {module?.note ?? "Entra na etapa 2, junto com o restante das funcionalidades ITIL."}
        </p>
        <Link to="/chamados" className="mt-3 text-xs text-link hover:underline">
          Ir para os chamados
        </Link>
      </div>
    </AppShell>
  );
}
