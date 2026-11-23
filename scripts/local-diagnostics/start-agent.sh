#!/bin/bash
set -a
source /home/adnan/viewers-tube/web/.env.local
set +a
exec /usr/bin/node /home/adnan/viewers-tube/web/scripts/local-diagnostics/server.mjs
