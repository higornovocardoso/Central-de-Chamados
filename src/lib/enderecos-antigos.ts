/**
 * Endereços antigos das telas, de antes de as URLs ganharem o nome de cada
 * tela. Favoritos e links salvos continuam funcionando: a hospedagem responde
 * 301 para o novo (vite.config.ts) e, se o pedido chegar ao app mesmo assim,
 * a tela de "não encontrada" leva direto para o novo (__root.tsx).
 */
export const ENDERECOS_ANTIGOS: Record<string, string> = {
  "/auth": "/entrar",
  "/administracao/entidades": "/empresas",
  "/administracao/usuarios": "/pessoas",
  "/administracao/grupos": "/pessoas/grupos",
  "/administracao/perfis": "/perfis-de-acesso",
  "/administracao/regras": "/regras-de-atribuicao",
  "/administracao/logs": "/configuracoes/logs",
  "/configuracao/geral": "/configuracoes",
  "/configuracao/slas": "/prazos",
  "/configuracao/calendarios": "/prazos/calendarios",
  "/configuracao/categorias": "/categorias",
  "/assistencia/kanban": "/chamados/quadro",
  "/assistencia/planejamento": "/agenda",
  "/chamados/recorrentes": "/recorrentes",
  "/base-conhecimento": "/base-de-conhecimento",
};
