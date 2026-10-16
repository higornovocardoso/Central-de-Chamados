-- Fase 20: isolamento entre empresas (entidades).
--
-- O esquema sempre esteve pronto para várias empresas: 43 tabelas têm
-- entity_id e existem visible_entity_ids() e has_right_in_entity(). Só que
-- quase nenhuma política usava essas funções — elas verificavam qual direito
-- o usuário tem, nunca em qual empresa. Com uma entidade só isso é invisível;
-- com duas, a Empresa A leria e gravaria dentro da Empresa B.
--
-- Levantamento antes desta migration, sobre as 43 tabelas com entity_id:
--   leitura isolada por entidade ....  4
--   leitura sem isolamento .......... 39
--   escrita isolada por entidade ....  1
--   escrita sem isolamento .......... 42
--
-- A correção não reescreve as políticas existentes. Cada tabela ganha uma
-- política RESTRITIVA, que o Postgres combina com E lógico sobre as
-- permissivas. Assim nenhum acesso atual é removido — apenas passa a valer
-- também o limite de entidade. Reescrever as ~80 políticas uma a uma teria
-- risco alto de tirar acesso de alguém sem querer.
--
-- Vale só para o papel authenticated. O caminho anônimo (formulário público
-- de abertura de chamado) é tratado na migration seguinte, porque para ele a
-- pergunta não é "quais entidades esse usuário enxerga" e sim "esta entidade
-- aceita chamado de fora".
--
-- Verificado antes de aplicar: nenhuma das 43 tabelas tem linha com
-- entity_id nulo, e visible_entity_ids() do usuário existente devolve a
-- entidade onde todos os dados estão. Ninguém perde acesso.

do $mig$
declare
  r record;
  politica text;
begin
  for r in
    select distinct c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'entity_id'
    order by c.table_name
  loop
    politica := r.table_name || '_entidade_guard';

    execute format('drop policy if exists %I on public.%I', politica, r.table_name);

    execute format($ddl$
      create policy %I on public.%I
        as restrictive
        for all
        to authenticated
        using (entity_id in (select public.visible_entity_ids(auth.uid())))
        with check (entity_id in (select public.visible_entity_ids(auth.uid())))
    $ddl$, politica, r.table_name);
  end loop;
end
$mig$;
