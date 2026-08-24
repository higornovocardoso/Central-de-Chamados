import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSession lê do armazenamento local; getUser ia à rede a cada chamada.
    // O router roda este guarda a cada navegação e a cada pré-carregamento por
    // hover, então getUser custava uma viagem ao Supabase por link tocado.
    //
    // Trocar não afasta segurança: quem decide o que pode ser lido ou gravado
    // é o RLS e o middleware requireSupabaseAuth, que validam o token no
    // servidor. Este guarda só escolhe entre mostrar a tela e mandar ao login.
    const { data, error } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (error || !user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: () => <Outlet />,
});
