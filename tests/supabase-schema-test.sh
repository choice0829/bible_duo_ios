#!/bin/bash
# supabase/schema.sql 시험: 이 컴퓨터(샌드박스)의 임시 Postgres에 Supabase의 auth(auth.uid·auth.users)·역할(anon·authenticated)을
# 흉내 내어 만들고, 개설 신청 → 승인 → 초대코드 가입 → 관리자만 영상 쓰기 → 다른 교회는 못 봄 … 을 확인한다.
# 실제 Supabase와 완전히 같지는 않으므로 실제 프로젝트에 넣은 뒤 한 번 더 확인해야 한다.
# 사용: bash tests/supabase-schema-test.sh   (Postgres 16 필요)
set -u
cd "$(dirname "$0")/.."
PGBIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)
[ -x "$PGBIN/initdb" ] || { echo "SKIP: postgres not installed"; exit 0; }
D=$(mktemp -d); PORT=55433
RUNAS=""; [ "$(id -u)" = 0 ] && { chown -R postgres "$D"; RUNAS="runuser -u postgres --"; }
$RUNAS "$PGBIN/initdb" -D "$D/db" -A trust -U postgres >/dev/null || exit 1
$RUNAS "$PGBIN/pg_ctl" -D "$D/db" -o "-p $PORT -k $D -c listen_addresses=''" -l "$D/log" start -w >/dev/null || { cat "$D/log"; exit 1; }
trap '$RUNAS "$PGBIN/pg_ctl" -D "$D/db" stop -m fast >/dev/null; rm -rf "$D"' EXIT
export PGOPTIONS='-c client_min_messages=warning'
Q() { psql -h "$D" -p $PORT -U postgres -d postgres -v ON_ERROR_STOP=1 -qAt "$@"; }

Q <<'SQL' || exit 1
create role anon nologin; create role authenticated nologin;
create schema auth; grant usage on schema auth to anon, authenticated;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
insert into auth.users values ('00000000-0000-0000-0000-00000000000a'),('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c'),('00000000-0000-0000-0000-00000000000d');
SQL
Q -f supabase/schema.sql >/dev/null || { echo "FAIL schema.sql did not apply"; exit 1; }
# 두 번 실행해도 되는지(다시 붙여 넣는 경우)
Q -f supabase/schema.sql >/dev/null || { echo "FAIL schema.sql is not re-runnable"; exit 1; }

fails=0
ok() { if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1 (got: $2 / want: $3)"; fails=$((fails+1)); fi; }
# 사용자로 실행: as <a|b|c|d|anon> "SQL"  → 결과 한 줄(오류면 ERR:메시지)
as() {
  local who=$1; shift
  local role=authenticated sub="00000000-0000-0000-0000-00000000000$who"
  [ "$who" = anon ] && { role=anon; sub=""; }
  psql -h "$D" -p $PORT -U postgres -d postgres -qAt -v ON_ERROR_STOP=1 \
    -c "set role $role; select set_config('request.jwt.claim.sub', '$sub', false);" -c "$1" 2>&1 | awk '/ERROR:/ { sub(/^.*ERROR: +/, "ERR:"); print; e=1; exit } { last=$0 } END { if (!e) print last }'
}

ok "A requests a church (pending)" "$(as a "select status from request_church('한사람교회')")" "pending"
ok "A cannot request a second one while in a church" "$(as a "select status from request_church('또다른교회')")" "ERR:already in a church"
ok "pending church: bundle has no items and no invite code" "$(as a "select (my_church_bundle()->'church'->>'invite_code') is null and jsonb_array_length(my_church_bundle()->'items')=0")" "t"
ok "pending church: admin cannot add a sermon yet" "$(as a "insert into sermons (church_id,yt_id,bk,c1,v1,c2,v2,title) select id,'AAAAAAAAAA1','1jn',1,1,1,4,'생명의 말씀' from churches")" "ERR:new row violates row-level security policy for table \"sermons\""
CODE=$(Q -c "select invite_code from churches limit 1")
ok "B cannot join a pending church with its code" "$(as b "select church_name from join_church('$CODE')")" "ERR:invalid code"
Q -c "update churches set status='active'"   # 운영자 승인(대시보드에서 하는 일)
ok "after approval A sees the invite code" "$(as a "select my_church_bundle()->'church'->>'invite_code'")" "$CODE"
ok "A (admin) adds a sermon" "$(as a "insert into sermons (church_id,yt_id,bk,c1,v1,c2,v2,title,preacher,preached_on,start_sec) select id,'AAAAAAAAAA1','1jn',1,1,1,4,'생명의 말씀','김목사','2026-11-22',95 from churches returning title")" "생명의 말씀"
ok "bad YouTube id is rejected" "$(as a "insert into sermons (church_id,yt_id,bk,c1,v1,c2,v2,title) select id,'bad','1jn',1,1,1,4,'x' from churches" | grep -c 'check constraint')" "1"
ok "reversed range is rejected" "$(as a "insert into sermons (church_id,yt_id,bk,c1,v1,c2,v2,title) select id,'AAAAAAAAAA2','1jn',2,1,1,4,'x' from churches" | grep -c 'check constraint')" "1"
LOWER=$(echo "$CODE" | tr 'A-Z' 'a-z' | sed 's/^\(....\)/\1-/')
ok "B joins with the code (lowercase, with a dash)" "$(as b "select church_name from join_church('$LOWER')")" "한사람교회"
ok "B cannot join twice" "$(as b "select church_name from join_church('$CODE')")" "ERR:already in a church"
ok "B (member) sees the sermon in the bundle" "$(as b "select my_church_bundle()->'items'->0->>'yt' || ' ' || (my_church_bundle()->'items'->0->>'date') || ' ' || (my_church_bundle()->'items'->0->>'t')")" "AAAAAAAAAA1 2026-11-22 95"
ok "B (member) does not get the invite code" "$(as b "select my_church_bundle()->'church'->>'invite_code' is null")" "t"
ok "B (member) cannot add a sermon" "$(as b "insert into sermons (church_id,yt_id,bk,c1,v1,c2,v2,title) select id,'BBBBBBBBBB1','gen',1,1,1,2,'x' from churches")" "ERR:new row violates row-level security policy for table \"sermons\""
ok "B (member) cannot delete the sermon (0 rows)" "$(as b "with d as (delete from sermons returning 1) select count(*) from d")" "0"
ok "B cannot read invite_code column directly" "$(as b "select invite_code from churches" | grep -c 'permission denied')" "1"
ok "B sees only own membership row" "$(as b "select count(*) from memberships")" "1"
ok "B cannot make self admin" "$(as b "update memberships set role='admin'" | grep -c 'permission denied')" "1"
ok "B cannot approve churches" "$(as b "update churches set status='active'" | grep -c 'permission denied')" "1"
# 다른 교회
ok "C requests another church" "$(as c "select status from request_church('다른교회')")" "pending"
ok "C leaves (the empty pending church is deleted) and can request again" "$(as c "select leave_church(); select status from request_church('다른교회2')")" "pending"
Q -c "update churches set status='active' where name like '다른교회%'"
ok "C sees no sermons of A's church" "$(as c "select count(*) from sermons")" "0"
ACH=$(Q -c "select id from churches where name='한사람교회'")
ok "C cannot insert into A's church" "$(as c "insert into sermons (church_id,yt_id,bk,c1,v1,c2,v2,title) values ('$ACH','CCCCCCCCCC1','gen',1,1,1,2,'x')")" "ERR:new row violates row-level security policy for table \"sermons\""
ok "C does not see A's church row" "$(as c "select count(*) from churches")" "1"
ok "user with no church: empty bundle" "$(as d "select my_church_bundle()::text")" '{"items": [], "church": null}'
ok "anon cannot read sermons" "$(as anon "select count(*) from sermons" | grep -c 'permission denied')" "1"
ok "anon cannot call join_church" "$(as anon "select * from join_church('$CODE')" | grep -c 'permission denied')" "1"
ok "A (last admin with members) cannot leave" "$(as a "select leave_church()")" "ERR:last admin"
ok "B leaves; bundle becomes empty" "$(as b "select leave_church(); select my_church_bundle()->>'church' is null")" "t"
ok "A (now alone) leaves; empty church and its sermons are deleted" "$(as a "select leave_church()" >/dev/null; Q -c "select count(*) from churches where name='한사람교회'")$(Q -c "select count(*) from sermons")" "00"
ok "deleting a user removes their membership (account deletion)" "$(Q -c "delete from auth.users where id='00000000-0000-0000-0000-00000000000c'; select count(*) from memberships")" "0"
echo
[ $fails = 0 ] && echo "ALL PASS" || echo "FAILS $fails"
