#!/usr/bin/env bash
# Recria um banco do zero com todas as migrações e roda os testes de segurança.
#
# Precisa de um Postgres 16 com o stub do pg_cron instalado (a pasta
# supabase/tests/stubs/pg_cron vai para o diretório de extensões do servidor).
# A conexão sai das variáveis padrão do psql: PGHOST, PGPORT, PGUSER, PGPASSWORD.
#
#   PGHOST=127.0.0.1 PGUSER=postgres scripts/testar-banco.sh
#
# Termina com erro se uma migração falhar ou se algum cenário não passar.
set -euo pipefail

raiz="$(cd "$(dirname "$0")/.." && pwd)"
banco="${BANCO_TESTE:-central_teste}"
psql_base=(psql -v ON_ERROR_STOP=1 -q -X)
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"

"${psql_base[@]}" -d postgres -c "drop database if exists ${banco}" -c "create database ${banco}"
psql_banco=("${psql_base[@]}" -d "$banco")

"${psql_banco[@]}" -f "$raiz/supabase/tests/stubs/supabase.sql"

for migracao in "$raiz"/supabase/migrations/*.sql; do
  echo "migração $(basename "$migracao")"
  "${psql_banco[@]}" -f "$migracao" > /dev/null
done

for teste in isolamento_entidades reforco_seguranca; do
  "${psql_banco[@]}" -f "$raiz/supabase/tests/$teste.sql"
done

falhas=0
for funcao in teste_isolamento_entidades teste_reforco_seguranca; do
  echo
  echo "== $funcao"
  "${psql_base[@]}" -d "$banco" -c "select passou, cenario, obtido from public.$funcao()"
  n=$("${psql_base[@]}" -d "$banco" -tAc "select count(*) from public.$funcao() where not passou")
  falhas=$((falhas + n))
done

echo
if [ "$falhas" -gt 0 ]; then
  echo "$falhas cenário(s) falharam."
  exit 1
fi
echo "Todos os cenários passaram."
