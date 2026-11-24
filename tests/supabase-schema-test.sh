#!/bin/bash
# supabase/schema.sql 시험 (v77 개인 계정 + 교회 소속 승인 방식)
# 이 컴퓨터(샌드박스)의 임시 Postgres에 Supabase의 auth(auth.uid·auth.users)·storage(buckets·objects·foldername)·역할(anon·authenticated)을
# 흉내 내어 만들고, ① v75 서버 위에 새 파일을 실행(마이그레이션) ② 개인 정보 저장 → 서류 올리기 → 소속 신청 → 운영자 승인 → 영상
# ③ 다른 사람 서류·정보는 못 봄 ④ 운영자 함수는 앱에서 못 부름 … 을 확인한다.
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
-- Supabase 는 pgcrypto 같은 확장을 'extensions' 폴더에 둔다(public 이 아님) → 그 배치를 그대로 흉내 낸다.
create schema extensions; grant usage on schema extensions to anon, authenticated; create extension pgcrypto with schema extensions;
create schema auth; grant usage on schema auth to anon, authenticated;
create table auth.users (id uuid primary key, email text, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
-- storage 흉내: 보관함·파일 표, 폴더 이름 함수. 파일 표는 Supabase 처럼 행 단위 규칙이 켜져 있다.
create schema storage; grant usage on schema storage to anon, authenticated;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid default auth.uid(), unique (bucket_id, name));
alter table storage.objects enable row level security;
grant select, insert, delete on storage.objects to authenticated;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant execute on function storage.foldername(text) to anon, authenticated;
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','a@ex.com'),('00000000-0000-0000-0000-00000000000b','b@ex.com'),
  ('00000000-0000-0000-0000-00000000000c','c@ex.com'),('00000000-0000-0000-0000-00000000000d','d@ex.com'),('00000000-0000-0000-0000-00000000000e','e@ex.com');
SQL
# ① 사용자가 이미 실행해 둔 v75 서버(교회 개설 신청·초대코드 방식)와 그 데이터가 있는 상태에서 시작
Q -f tests/fixtures/schema-v75.sql >/dev/null || { echo "FAIL v75 fixture did not apply"; exit 1; }
Q <<'SQL' >/dev/null || exit 1
insert into public.churches (id, name, status, invite_code, created_by) values ('11111111-1111-1111-1111-111111111111', '옛날교회', 'active', 'OLDCODE2', '00000000-0000-0000-0000-00000000000e');
insert into public.memberships values ('00000000-0000-0000-0000-00000000000e', '11111111-1111-1111-1111-111111111111', 'admin', now());
insert into public.sermons (church_id, yt_id, bk, c1, v1, c2, v2, title) values ('11111111-1111-1111-1111-111111111111', 'OLDOLDOLD01', 'gen', 1, 1, 1, 2, '옛 영상');
SQL
# 사용자가 실행해 둔 v77 서버를 거쳐(v75 → v77 → 지금) 새 파일을 실행
Q -f tests/fixtures/schema-v77.sql >/dev/null || { echo "FAIL v77 fixture did not apply over v75"; exit 1; }
Q -f supabase/schema.sql >/dev/null || { echo "FAIL schema.sql did not apply over v77"; Q -f supabase/schema.sql 2>&1 | tail -3; exit 1; }
Q -f supabase/schema.sql >/dev/null || { echo "FAIL schema.sql is not re-runnable"; exit 1; }

fails=0
ok() { if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1 (got: $2 / want: $3)"; fails=$((fails+1)); fi; }
# 사용자로 실행: as <a|b|c|d|e|anon> "SQL"  → 결과 한 줄(오류면 ERR:메시지)
as() {
  local who=$1; shift
  local role=authenticated sub="00000000-0000-0000-0000-00000000000$who"
  [ "$who" = anon ] && { role=anon; sub=""; }
  psql -h "$D" -p $PORT -U postgres -d postgres -qAt -v ON_ERROR_STOP=1 \
    -c "set role $role; select set_config('request.jwt.claim.sub', '$sub', false);" -c "$1" 2>&1 | awk '/ERROR:/ { sub(/^.*ERROR: +/, "ERR:"); print; e=1; exit } { last=$0 } END { if (!e) print last }'
}
UA=00000000-0000-0000-0000-00000000000a; UB=00000000-0000-0000-0000-00000000000b

ok "migration: old church/membership/sermon kept, old functions removed" "$(Q -c "select count(*) from churches")$(Q -c "select count(*) from sermons")$(Q -c "select count(*) from pg_proc where proname in ('request_church','join_church','my_church_bundle','new_invite_code')")" "110"
ok "migration: old admin (no profile yet) still sees own church videos" "$(as e "select jsonb_array_length(my_account()->'items') || ' ' || (my_account()->'profile' is null or my_account()->>'profile' is null)")" "1 true"
ok "proofs bucket is private, 10MB, images/pdf" "$(Q -c "select public::text || ' ' || file_size_limit || ' ' || array_to_string(allowed_mime_types, ',') from storage.buckets where id='proofs'")" "false 10485760 image/jpeg,image/png,application/pdf"

# ② 개인 정보 저장
ok "profile without consent is refused" "$(as a "select save_my_profile('김하나', 'F', '19900101', '010-1234-5678', false)")" "ERR:consent required"
ok "bad birth (not a date) is refused" "$(as a "select save_my_profile('김하나', 'F', '19901340', null, true)")" "ERR:bad birth"
ok "future birth is refused" "$(as a "select save_my_profile('김하나', null, to_char(current_date + 1, 'YYYYMMDD'), null, true)")" "ERR:bad birth"
ok "bad phone is refused" "$(as a "select save_my_profile('김하나', null, null, '12-34', true)")" "ERR:bad phone"
ok "bad gender is refused" "$(as a "select save_my_profile('김하나', 'X', null, null, true)")" "ERR:bad gender"
ok "empty name is refused" "$(as a "select save_my_profile('  ', null, null, null, true)")" "ERR:bad name"
as a "select save_my_profile('김하나', 'F', '19900101', '010-1234-5678', true)" >/dev/null
ok "profile saved with consent; optional fields stored" "$(as a "select (my_account()->'profile'->>'name') || '/' || (my_account()->'profile'->>'gender') || '/' || (my_account()->'profile'->>'birth') || '/' || (my_account()->'profile'->>'phone') || '/' || (my_account()->'profile'->>'church_status')")" "김하나/F/19900101/010-1234-5678/none"
as b "select save_my_profile('이둘', '', '', '', true)" >/dev/null
ok "optional fields may be empty (stored as null)" "$(as b "select coalesce(my_account()->'profile'->>'gender','null') || coalesce(my_account()->'profile'->>'birth','null') || coalesce(my_account()->'profile'->>'phone','null')")" "nullnullnull"
ok "editing profile later does not need consent again" "$(as a "select save_my_profile('김하나님', 'F', '19900101', '01012345678', false)" >/dev/null; as a "select my_account()->'profile'->>'name'")" "김하나님"

# 서류 올리기(보관함 규칙)
ok "A uploads a proof into own folder" "$(as a "insert into storage.objects (bucket_id, name) values ('proofs', '$UA/1.jpg') returning 'ok'")" "ok"
ok "A cannot upload into B's folder" "$(as a "insert into storage.objects (bucket_id, name) values ('proofs', '$UB/x.jpg')")" 'ERR:new row violates row-level security policy for table "objects"'
as b "insert into storage.objects (bucket_id, name) values ('proofs', '$UB/2.pdf')" >/dev/null
ok "A sees only own proof files" "$(as a "select count(*) from storage.objects")" "1"
ok "A cannot delete B's proof (0 rows)" "$(as a "with d as (delete from storage.objects where name like '$UB/%' returning 1) select count(*) from d")" "0"

# 소속 신청
ok "request needs an uploaded proof in own folder (B's path refused)" "$(as a "select request_church_membership('한사람교회', '$UB/2.pdf')")" "ERR:proof required"
ok "request with a path that was never uploaded is refused" "$(as a "select request_church_membership('한사람교회', '$UA/none.jpg')")" "ERR:proof required"
ok "request without a profile is refused" "$(as c "select request_church_membership('한사람교회', 'x')")" "ERR:profile required"
as a "select request_church_membership(' 한사람교회 ', '$UA/1.jpg')" >/dev/null
ok "A request → pending; no church, no videos yet" "$(as a "select (my_account()->'profile'->>'church_status') || ' ' || (my_account()->>'church' is null) || ' ' || jsonb_array_length(my_account()->'items')")" "pending true 0"
ok "while pending A cannot clear the proof path" "$(as a "select clear_my_proof()" >/dev/null; as a "select my_account()->'profile'->>'proof_path'")" "$UA/1.jpg"
ok "pending list (operator view) shows A" "$(Q -c "select email || ' ' || church_name from pending_members")" "a@ex.com 한사람교회"
ok "app users cannot read the pending list" "$(as a "select count(*) from pending_members" | grep -c 'permission denied')" "1"
ok "app users cannot call approve_member" "$(as a "select approve_member('a@ex.com')" | grep -c 'permission denied')" "1"
ok "app users cannot change own profile row directly" "$(as a "update profiles set church_status='approved'" | grep -c 'permission denied')" "1"
ok "app users cannot add themselves to a church directly" "$(as a "insert into memberships values ('$UA', '11111111-1111-1111-1111-111111111111', 'admin', now())" | grep -c 'permission denied')" "1"
ok "B cannot read A's profile" "$(as b "select count(*) from profiles")" "1"

# 운영자 승인
ok "approve unknown email → message" "$(Q -c "select approve_member('zz@ex.com')")" "없는 이메일: zz@ex.com"
ok "approve A (as admin) creates the church" "$(Q -c "select approve_member('A@EX.COM', null, true)")" "승인: 한사람교회 (관리자) ← A@EX.COM"
ok "A: approved, church with admin role" "$(as a "select (my_account()->'profile'->>'church_status') || ' ' || (my_account()->'church'->>'name') || ' ' || (my_account()->'church'->>'role')")" "approved 한사람교회 admin"
ok "after approval A can clear the proof path (app deletes the file first)" "$(as a "delete from storage.objects where name='$UA/1.jpg'; select clear_my_proof()" >/dev/null; as a "select coalesce(my_account()->'profile'->>'proof_path','null') || (select count(*) from storage.objects)")" "null0"
ok "A (admin) adds a sermon" "$(as a "insert into sermons (church_id,yt_id,bk,c1,v1,c2,v2,title) values ((my_account()->'church'->>'id')::uuid,'AAAAAAAAAA1','1jn',1,1,1,4,'생명의 말씀') returning title")" "생명의 말씀"
# B: 같은 교회 이름(띄어쓰기·대소문자만 다름)으로 신청 → 같은 교회에 연결, 성도
as b "select request_church_membership('한사람교회', '$UB/2.pdf')" >/dev/null
ok "B (not approved) sees no videos" "$(as b "select count(*) from sermons")" "0"
ok "approve B joins the existing church as member" "$(Q -c "select approve_member('b@ex.com')"; Q -c "select count(*) from churches where name='한사람교회'")" "승인: 한사람교회 ← b@ex.com
1"
ok "B sees the video in my_account, member role" "$(as b "select (my_account()->'items'->0->>'yt') || ' ' || (my_account()->'church'->>'role')")" "AAAAAAAAAA1 member"
ok "B (member) cannot add a sermon" "$(as b "insert into sermons (church_id,yt_id,bk,c1,v1,c2,v2,title) values ((my_account()->'church'->>'id')::uuid,'BBBBBBBBBB1','gen',1,1,1,2,'x')")" 'ERR:new row violates row-level security policy for table "sermons"'
ok "operator makes B an admin" "$(Q -c "select set_church_admin('b@ex.com')"; as b "select my_account()->'church'->>'role'")" "교회 관리자로 지정했습니다 ← b@ex.com
admin"
ok "B cannot request another church while in one" "$(as b "select request_church_membership('다른교회', '$UB/2.pdf')")" "ERR:already in a church"
# 반려
as c "select save_my_profile('박셋', null, null, null, true)" >/dev/null
as c "insert into storage.objects (bucket_id, name) values ('proofs', '00000000-0000-0000-0000-00000000000c/3.png')" >/dev/null
as c "select request_church_membership('셋째교회', '00000000-0000-0000-0000-00000000000c/3.png')" >/dev/null
ok "reject C with a reason" "$(Q -c "select reject_member('c@ex.com', '서류가 흐립니다')" >/dev/null; echo 반려: c@ex.com; as c "select (my_account()->'profile'->>'church_status') || ' ' || (my_account()->'profile'->>'reject_reason') || ' ' || (my_account()->>'church' is null)")" "반려: c@ex.com
rejected 서류가 흐립니다 true"
ok "rejected C can request again (pending, reason cleared)" "$(as c "select request_church_membership('셋째교회', '00000000-0000-0000-0000-00000000000c/3.png')" >/dev/null; as c "select (my_account()->'profile'->>'church_status') || coalesce(my_account()->'profile'->>'reject_reason','-')")" "pending-"
# ---- v78 운영자(앱 화면) ----
UC=00000000-0000-0000-0000-00000000000c; UD=00000000-0000-0000-0000-00000000000d
ok "non-operator: my_account says operator false, pending_count 0" "$(as d "select (my_account()->>'operator') || ' ' || (my_account()->>'pending_count')")" "false 0"
ok "non-operator cannot list accounts" "$(as d "select op_list_accounts('all')")" "ERR:operator only"
ok "non-operator cannot approve" "$(as d "select op_approve('$UC')")" "ERR:operator only"
ok "app users cannot call make_operator" "$(as d "select make_operator('d@ex.com')" | grep -c 'permission denied')" "1"
ok "app users cannot read the operator table" "$(as d "select count(*) from app_operators" | grep -c 'permission denied')" "1"
ok "make D operator (SQL Editor)" "$(Q -c "select make_operator('D@ex.com')")" "운영자 지정: D@ex.com"
ok "operator: my_account operator true, pending_count 1 (C)" "$(as d "select (my_account()->>'operator') || ' ' || (my_account()->>'pending_count')")" "true 1"
ok "operator: pending list has only C with church name and proof path" "$(as d "select jsonb_array_length(op_list_accounts('pending')) || ' ' || (op_list_accounts('pending')->0->>'email') || ' ' || (op_list_accounts('pending')->0->>'church_name') || ' ' || (op_list_accounts('pending')->0->>'proof_path')")" "1 c@ex.com 셋째교회 $UC/3.png"
ok "operator: all list has every account (D has no profile → noprofile, operator true)" "$(as d "select jsonb_array_length(op_list_accounts('all')) || ' ' || (select x->>'church_status' || '/' || (x->>'operator') from jsonb_array_elements(op_list_accounts('all')) x where x->>'email'='d@ex.com')")" "5 noprofile/true"
ok "operator can read C's proof file (for the signed link)" "$(as d "select count(*) from storage.objects where name='$UC/3.png'")" "1"
ok "operator still cannot delete C's proof" "$(as d "with x as (delete from storage.objects where name='$UC/3.png' returning 1) select count(*) from x")" "0"
ok "operator approves C under a corrected church name, as admin" "$(as d "select op_approve('$UC', '셋째 교회', true)")" "승인: 셋째 교회 (관리자)"
ok "C: approved, admin of '셋째 교회'" "$(as c "select (my_account()->'profile'->>'church_status') || ' ' || (my_account()->'church'->>'name') || ' ' || (my_account()->'church'->>'role')")" "approved 셋째 교회 admin"
ok "operator: reject when nothing is pending → message" "$(as d "select op_reject('$UC', 'x')")" "승인 대기 중인 신청이 없습니다"
ok "operator: unset admin" "$(as d "select op_set_admin('$UC', false)"; as c "select my_account()->'church'->>'role'")" "교회 관리자에서 해제했습니다
member"
ok "operator: pending_count back to 0" "$(as d "select my_account()->>'pending_count'")" "0"
ok "remove operator → op functions refused again" "$(Q -c "select make_operator('d@ex.com', false)" >/dev/null; as d "select op_list_accounts('all')")" "ERR:operator only"
# 나가기·계정 삭제
ok "B leaves: no church, status none, videos gone" "$(as b "select leave_church()" >/dev/null; as b "select (my_account()->'profile'->>'church_status') || ' ' || (my_account()->>'church' is null) || ' ' || (select count(*) from sermons)")" "none true 0"
ok "A deletes own account: auth user, profile, membership gone; sermon stays" "$(as a "select delete_my_account()" >/dev/null; Q -c "select (select count(*) from auth.users where id='$UA') || '' || (select count(*) from profiles where user_id='$UA') || (select count(*) from memberships where user_id='$UA') || (select count(*) from sermons where title='생명의 말씀')")" "0001"
ok "anon cannot read anything or call app functions" "$(as anon "select my_account()" | grep -c 'permission denied')$(as anon "select count(*) from profiles" | grep -c 'permission denied')" "11"
echo
[ $fails = 0 ] && echo "ALL PASS" || echo "FAILS $fails"
