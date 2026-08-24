# Central de chamados de T.I.

Central de atendimento de T.I. no modelo do [GLPI](https://glpi-project.org/):
chamados, ativos, base de conhecimento e SLA, com controle de permissões por
perfil e separação por entidade.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | TanStack Start (SSR) + TanStack Router |
| Interface | React 19, Tailwind CSS v4, shadcn/ui |
| Dados | TanStack Query |
| Backend | Supabase (Postgres, Auth, RLS) |
| Build | Vite 8, Nitro |
| Hospedagem | Netlify (Functions) |

## Requisitos

- Node.js 22
- Uma instância do Supabase com as migrations de `supabase/migrations` aplicadas

## Configuração

O `.env` da raiz é versionado e já vem preenchido. Para apontar para outra
instância do Supabase, copie o modelo e ajuste:

```sh
cp .env.example .env
```

Os valores saem do painel do Supabase, em Configurações > API:

| Variável | Descrição |
| --- | --- |
| `VITE_SUPABASE_URL` | URL do projeto |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave publicável (anon) |
| `VITE_SUPABASE_PROJECT_ID` | Identificador do projeto |

As três existem também sem o prefixo `VITE_`, para uso no servidor. As chaves
`VITE_*` são embutidas no bundle e ficam visíveis no navegador — por isso apenas
a chave publicável entra aqui, nunca a `service_role`.

## Desenvolvimento

```sh
npm install
npm run dev
```

O servidor sobe em http://localhost:8080.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento com recarga automática |
| `npm run build` | Build de produção (estático em `dist/`, SSR em função Netlify) |
| `npm run preview` | Serve o build de produção localmente |
| `npm run lint` | ESLint com regras do Prettier |
| `npm run format` | Aplica o Prettier em todo o projeto |
| `npx tsc --noEmit` | Verificação de tipos |

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

Hoje o build usa o `.env` versionado. Como ele guarda apenas a chave publicável
do Supabase, que é pública por definição, isso não expõe segredo nenhum. Ainda
assim, o caminho recomendado é cadastrar as seis variáveis no painel da Netlify
e então parar de versionar o arquivo — o `vite.config.ts` lê `process.env` além
dos arquivos `.env`, então a troca é transparente. Feito isso, qualquer chave
que venha a ser secreta (`SERVICE_ROLE_KEY`, por exemplo) não corre o risco de
entrar no repositório por descuido.
