-- Varredura de campos: acha dado guardado que nenhuma tela mostra, e coluna
-- que o código lê mas que está sempre vazia.
--
-- Nasceu de três problemas encontrados por acaso, usando o sistema: o setor do
-- solicitante estava gravado em 21 chamados e não aparecia em lugar nenhum, e
-- a atribuição era escrita em ticket_actors enquanto quatro telas liam
-- tickets.assignee_id. Em vez de esperar esbarrar no próximo, esta função
-- responde as duas perguntas de uma vez.
--
--   select * from public.varredura_campos();
--
-- A saída é o lado do banco. Para fechar o diagnóstico, cruze com o código:
-- um campo em "tem_dado" que não aparece em nenhum arquivo de src/ é dado
-- invisível; um campo em "sempre_vazio" que aparece no código é candidato ao
-- bug da atribuição — alguém lê o que ninguém escreve.
--
-- Nem toda linha é problema. Coluna sempre vazia pode ser recurso ainda não
-- usado, e não defeito. A função aponta onde olhar, não o que consertar.
--
-- Tabelas com menos de três linhas são ignoradas: com pouco dado, "sempre
-- vazio" não significa nada.

create or replace function public.varredura_campos()
returns table(situacao text, tabela text, coluna text, linhas_preenchidas bigint, linhas_na_tabela bigint)
language plpgsql
set search_path = public
as $varre$
declare
  t record;
  c record;
  n bigint;
  total bigint;
begin
  for t in
    select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
     order by table_name
  loop
    execute format('select count(*) from public.%I', t.table_name) into total;
    continue when total < 3;

    for c in
      select column_name from information_schema.columns
       where table_schema = 'public' and table_name = t.table_name
       order by ordinal_position
    loop
      execute format(
        'select count(*) from public.%I where %I is not null and (%I::text) <> %L',
        t.table_name, c.column_name, c.column_name, ''
      ) into n;

      tabela := t.table_name;
      coluna := c.column_name;
      linhas_preenchidas := n;
      linhas_na_tabela := total;
      situacao := case when n = 0 then 'sempre_vazio' else 'tem_dado' end;
      return next;
    end loop;
  end loop;
end;
$varre$;

revoke all on function public.varredura_campos() from public, anon, authenticated;
