# Central de chamados de T.I.

Central de chamados de T.I. inspirada no [GLPI](https://glpi-project.org/), só
com a parte de atendimento: fila de chamados, prazos (SLA), regras de
atribuição, e-mail que vira chamado e base de conhecimento, com controle de
permissões por perfil e separação por empresa.

## Stack

| Camada     | Tecnologia                             |
| ---------- | -------------------------------------- |
| Framework  | TanStack Start (SSR) + TanStack Router |
| Interface  | React 19, Tailwind CSS v4, shadcn/ui   |
| Dados      | TanStack Query                         |
| Backend    | Supabase (Postgres, Auth, RLS)         |
| Build      | Vite 8, Nitro                          |
| Hospedagem | Netlify (Functions)                    |

## Requisitos

- Node.js 22
- Uma instância do Supabase com as migrations de `supabase/migrations` aplicadas

## Configuração

O `.env` não é versionado. Crie o seu a partir do modelo:

```sh
cp .env.example .env
```

Os valores saem do painel do Supabase, em Configurações > API:

| Variável                        | Lida onde | Descrição                          |
| ------------------------------- | --------- | ---------------------------------- |
| `SUPABASE_URL`                  | Servidor  | URL do projeto                     |
| `SUPABASE_PUBLISHABLE_KEY`      | Servidor  | Chave publicável                   |
| `SUPABASE_SERVICE_ROLE_KEY`     | Servidor  | Chave administrativa, ignora o RLS |
| `VITE_SUPABASE_URL`             | Navegador | Mesma URL, embutida no bundle      |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Navegador | Mesma chave publicável, no bundle  |

Tudo que começa com `VITE_` é embutido no código enviado ao navegador e fica
visível para qualquer visitante. Só a chave publicável pode entrar ali — a
`SUPABASE_SERVICE_ROLE_KEY` nunca, em hipótese alguma.

Sem a `SUPABASE_SERVICE_ROLE_KEY` o sistema roda normalmente, mas criar, editar
e excluir usuários falha com "variável de ambiente ausente".

## Desenvolvimento

```sh
npm install
npm run dev
```

O servidor sobe em http://localhost:8080.

## Scripts

| Comando            | O que faz                                                      |
| ------------------ | -------------------------------------------------------------- |
| `npm run dev`      | Servidor de desenvolvimento com recarga automática             |
| `npm run build`    | Build de produção (estático em `dist/`, SSR em função Netlify) |
| `npm run preview`  | Serve o build de produção localmente                           |
| `npm run lint`     | ESLint com regras do Prettier                                  |
| `npm run format`   | Aplica o Prettier em todo o projeto                            |
| `npx tsc --noEmit` | Verificação de tipos                                           |

## Estrutura

```
src/
  components/     Componentes da aplicação (AppShell, tabelas, diálogos)
    ui/           Primitivos do shadcn/ui
  routes/         Rotas por arquivo (TanStack Router)
    _authenticated/  Rotas que exigem sessão
  hooks/          Hooks de sessão, permissões e opções de formulário
  lib/            Regras de negócio (chamados, ITIL, permissões, busca)
  integrations/   Cliente e tipos do Supabase
  contexts/       Contexto de entidade selecionada
supabase/
  migrations/     Esquema e políticas de RLS
```

## Deploy

O deploy é automático: todo push na `main` dispara um build na Netlify, que
publica o estático de `dist/` e a função de SSR.

As variáveis de ambiente ficam no painel da Netlify, em Project configuration >
Environment variables. O `vite.config.ts` lê `process.env` além dos arquivos
`.env`, então o build usa as do painel sem depender de arquivo no repositório.

Variável nova, ou valor alterado, **só passa a valer em um build novo**. Depois
de mexer no painel, dispare um deploy em Deploys > Trigger deploy.
