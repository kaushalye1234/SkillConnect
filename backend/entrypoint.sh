#!/bin/sh
set -eu

if [ -n "${DATABASE_URL:-}" ]; then
  case "$DATABASE_URL" in
    postgresql://*)
      db_target="${DATABASE_URL#postgresql://}"
      db_target="${db_target#*@}"
      export SPRING_DATASOURCE_URL="jdbc:postgresql://${db_target}"
      ;;
    postgres://*)
      db_target="${DATABASE_URL#postgres://}"
      db_target="${db_target#*@}"
      export SPRING_DATASOURCE_URL="jdbc:postgresql://${db_target}"
      ;;
  esac
fi

exec java -jar /app/app.jar
