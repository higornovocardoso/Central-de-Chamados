import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Sem isto toda query nasce obsoleta e refaz a busca a cada montagem,
        // o que transforma ir e voltar entre telas em espera com esqueleto.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        // O padrão são 3 tentativas com espera exponencial: um erro leva
        // cerca de sete segundos para aparecer na tela.
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Carrega a rota assim que o ponteiro encosta no link, então o clique
    // costuma cair numa tela já pronta.
    defaultPreload: "intent",
    // Recomendado com React Query: o router não guarda o resultado do loader
    // e deixa a validade do dado por conta do cache das queries.
    defaultPreloadStaleTime: 0,
  });

  return router;
};
