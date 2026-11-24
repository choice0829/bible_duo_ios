-- 선한성경 계정 서버: 표 · 접근 규칙 · 함수 · 증빙 서류 보관함  (Supabase SQL Editor에 파일 전체를 붙여 넣어 실행. 여러 번 실행해도 안전)
-- v77 결정 사항(2026-11-24, docs/HANDOFF-church-accounts.md 7장):
--   · 개인 계정을 먼저 만든다(이메일 = 아이디). 이름·이메일·소속 교회·증빙 서류는 필수, 성별·생년월일·전화번호는 선택.
--   · 가입할 때 소속 교회 이름을 적고 교인 증빙 서류를 올린다 → 계정은 바로 쓰고, 교회 소속은 운영자가 서류를 확인한 뒤 승인한다.
--   · 교회는 운영자가 승인할 때 만든다(같은 이름이 있으면 그 교회에 연결). 교회 관리자는 운영자가 승인된 성도 중에서 지정한다.
--   · 승인 전: 성경·노트 등 기본 기능만. 승인 후: 그 교회의 설교 영상(그리고 2단계의 교회 게시판).
--   · 증빙 서류는 비공개 보관함 'proofs' 의 <사용자 ID>/ 폴더에 본인만 올리고·보고·지울 수 있다. 승인·반려 후 앱이 지운다(최소 보관).
-- 운영자 작업(SQL Editor에서): select * from public.pending_members;  →  select public.approve_member('이메일');  /  select public.reject_member('이메일', '사유');
-- ※ 개인정보: 교회 소속·교인 증빙 서류는 종교에 관한 정보라 민감정보로 볼 소지가 큼 → 배포 전 법률 전문가 확인 필요(이 파일은 법률 판단이 아님).

create extension if not exists pgcrypto;

-- ---------- 표 ----------
create table if not exists public.churches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 2 and 40),
  status      text not null default 'active' check (status in ('pending', 'active', 'rejected')),
  invite_code text unique,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
-- v75 까지의 표를 v77 모양으로 (초대코드·개설자 없이 운영자가 만든다)
alter table public.churches alter column invite_code drop not null;
alter table public.churches alter column created_by drop not null;
alter table public.churches alter column status set default 'active';
do $$ begin
  if exists (select 1 from information_schema.table_constraints
             where table_schema = 'public' and table_name = 'churches' and constraint_name = 'churches_created_by_fkey') then
    alter table public.churches drop constraint churches_created_by_fkey;
    alter table public.churches add constraint churches_created_by_fkey foreign key (created_by) references auth.users (id) on delete set null;
  end if;
end $$;
create unique index if not exists churches_name_uq on public.churches (lower(btrim(name)));

create table if not exists public.memberships (
  user_id    uuid primary key references auth.users (id) on delete cascade,   -- 한 사람 = 한 교회 (운영자 승인으로만 생김)
  church_id  uuid not null references public.churches (id) on delete cascade,
  role       text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now()
);
create index if not exists memberships_church_idx on public.memberships (church_id);

-- 개인 정보(본인만 읽음, 쓰기는 함수로만)
create table if not exists public.profiles (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  name           text not null check (char_length(btrim(name)) between 1 and 30),
  gender         text check (gender is null or gender in ('M', 'F')),
  birth          date check (birth is null or birth >= date '1900-01-01'),   -- 오늘 이후인지는 save_my_profile 에서 본다
  phone          text check (phone is null or phone ~ '^[0-9]{2,3}-?[0-9]{3,4}-?[0-9]{4}$'),
  church_name    text check (church_name is null or char_length(btrim(church_name)) between 2 and 40),   -- 가입할 때 적은 교회 이름
  church_status  text not null default 'none' check (church_status in ('none', 'pending', 'approved', 'rejected')),
  reject_reason  text check (reject_reason is null or char_length(reject_reason) <= 200),
  proof_path     text,                       -- 'proofs' 보관함 안의 경로(<사용자 ID>/파일). 확인이 끝나면 비운다
  requested_at   timestamptz,
  reviewed_at    timestamptz,
  consent_at     timestamptz not null,       -- 개인정보 수집·이용(민감정보 포함) 동의 시각
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.sermons (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches (id) on delete cascade,
  yt_id       text not null check (yt_id ~ '^[A-Za-z0-9_-]{11}$'),
  bk          text not null check (bk ~ '^[0-9a-z]{3}$'),                       -- 앱의 책 ID(gen, exo, 1jn …)
  c1 int not null check (c1 >= 1), v1 int not null check (v1 >= 1),
  c2 int not null check (c2 >= 1), v2 int not null check (v2 >= 1),
  title       text not null check (char_length(btrim(title)) between 1 and 80),
  preacher    text check (preacher is null or char_length(preacher) <= 30),
  preached_on date,
  start_sec   int check (start_sec is null or start_sec between 0 and 36000),  -- 영상 시작 시각(초)
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (c2 > c1 or (c2 = c1 and v2 >= v1))
);
create index if not exists sermons_church_idx on public.sermons (church_id, bk);

-- ---------- 증빙 서류 보관함 (비공개, 10MB, 사진·PDF) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 10485760, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists proofs_insert_own on storage.objects;
create policy proofs_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists proofs_read_own on storage.objects;
create policy proofs_read_own on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists proofs_delete_own on storage.objects;
create policy proofs_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- 도우미 (접근 규칙에서 씀. security definer 라 규칙이 서로를 다시 부르며 막히지 않음) ----------
create or replace function public.my_church_id() returns uuid
language sql stable security definer set search_path = public as $$
  select church_id from public.memberships where user_id = auth.uid()
$$;

create or replace function public.my_active_church_id() returns uuid
language sql stable security definer set search_path = public as $$
  select m.church_id from public.memberships m join public.churches c on c.id = m.church_id
  where m.user_id = auth.uid() and c.status = 'active'
$$;

create or replace function public.am_church_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m join public.churches c on c.id = m.church_id
    where m.user_id = auth.uid() and m.role = 'admin' and c.status = 'active')
$$;

-- v75 까지의 함수(교회 개설 신청·초대코드 가입)는 없앤다
drop function if exists public.request_church(text);
drop function if exists public.join_church(text);
drop function if exists public.my_church_bundle();
drop function if exists public.new_invite_code();

-- ---------- 앱이 부르는 함수 (rpc) ----------
-- 내 정보 저장(처음 저장할 때는 동의가 필요). 빈 칸은 null 로 저장한다.
create or replace function public.save_my_profile(p_name text, p_gender text, p_birth text, p_phone text, p_consent boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  b date;
  ph text := nullif(btrim(coalesce(p_phone, '')), '');
  g text := nullif(btrim(coalesce(p_gender, '')), '');
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  if nullif(btrim(coalesce(p_birth, '')), '') is not null then
    if p_birth !~ '^[0-9]{8}$' then raise exception 'bad birth' using errcode = 'P0001'; end if;
    begin b := to_date(p_birth, 'YYYYMMDD'); exception when others then raise exception 'bad birth' using errcode = 'P0001'; end;
    if to_char(b, 'YYYYMMDD') <> p_birth or b < date '1900-01-01' or b > current_date then raise exception 'bad birth' using errcode = 'P0001'; end if;
  end if;
  if ph is not null and ph !~ '^[0-9]{2,3}-?[0-9]{3,4}-?[0-9]{4}$' then raise exception 'bad phone' using errcode = 'P0001'; end if;
  if g is not null and g not in ('M', 'F') then raise exception 'bad gender' using errcode = 'P0001'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 30 then raise exception 'bad name' using errcode = 'P0001'; end if;
  if exists (select 1 from public.profiles where user_id = auth.uid()) then
    update public.profiles set name = btrim(p_name), gender = g, birth = b, phone = ph, updated_at = now() where user_id = auth.uid();
  else
    if not coalesce(p_consent, false) then raise exception 'consent required' using errcode = 'P0001'; end if;
    insert into public.profiles (user_id, name, gender, birth, phone, consent_at) values (auth.uid(), btrim(p_name), g, b, ph, now());
  end if;
end $$;

-- 소속 교회 신청: 교회 이름 + 먼저 올린 증빙 서류의 경로. 운영자가 확인할 때까지 '승인 대기'.
create or replace function public.request_church_membership(p_church_name text, p_proof_path text)
returns void language plpgsql security definer set search_path = public, storage as $$
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  if not exists (select 1 from public.profiles where user_id = auth.uid()) then raise exception 'profile required' using errcode = 'P0001'; end if;
  if exists (select 1 from public.memberships where user_id = auth.uid()) then raise exception 'already in a church' using errcode = 'P0001'; end if;
  if char_length(btrim(coalesce(p_church_name, ''))) not between 2 and 40 then raise exception 'bad church name' using errcode = 'P0001'; end if;
  if coalesce(p_proof_path, '') not like auth.uid()::text || '/%'
     or not exists (select 1 from storage.objects o where o.bucket_id = 'proofs' and o.name = p_proof_path) then
    raise exception 'proof required' using errcode = 'P0001';
  end if;
  update public.profiles set church_name = btrim(p_church_name), church_status = 'pending', proof_path = p_proof_path,
    reject_reason = null, requested_at = now(), reviewed_at = null, updated_at = now()
  where user_id = auth.uid();
end $$;

-- 확인이 끝난(승인·반려) 뒤 앱이 서류 파일을 지우고 나서 경로를 비운다.
create or replace function public.clear_my_proof() returns void
language sql security definer set search_path = public as $$
  update public.profiles set proof_path = null, updated_at = now()
  where user_id = auth.uid() and church_status <> 'pending'
$$;

-- 교회 나가기(소속만 지움. 계정과 개인 정보는 남는다)
create or replace function public.leave_church() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  delete from public.memberships where user_id = auth.uid();
  update public.profiles set church_status = 'none', reject_reason = null, updated_at = now() where user_id = auth.uid();
end $$;

-- 앱 안에서 계정 삭제(Apple 심사 요건): 로그인 계정을 지우면 개인 정보·소속이 함께 지워진다(넣은 영상은 교회에 남음).
-- 증빙 서류 파일은 앱이 이 함수를 부르기 전에 지운다.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  delete from auth.users where id = auth.uid();
end $$;

-- 앱이 한 번에 받아 기기에 저장하는 모양:
-- { profile: {name, gender, birth, phone, church_name, church_status, reject_reason, proof_path} | null,
--   church: {id, name, role} | null,   items: [설교 영상…](승인된 교회만) }
create or replace function public.my_account() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'profile', case when p.user_id is null then null else jsonb_build_object(
        'name', p.name, 'gender', p.gender, 'birth', to_char(p.birth, 'YYYYMMDD'), 'phone', p.phone,
        'church_name', p.church_name, 'church_status', p.church_status, 'reject_reason', p.reject_reason, 'proof_path', p.proof_path) end,
    'church', case when c.id is null then null else jsonb_build_object('id', c.id, 'name', c.name, 'role', m.role) end,
    'items', case when c.id is null then '[]'::jsonb else coalesce((
        select jsonb_agg(jsonb_build_object('id', s.id, 'yt', s.yt_id, 'bk', s.bk, 'c1', s.c1, 'v1', s.v1, 'c2', s.c2, 'v2', s.v2,
                 'title', s.title, 'preacher', s.preacher, 'date', to_char(s.preached_on, 'YYYY-MM-DD'), 't', s.start_sec)
                 order by s.preached_on desc nulls last, s.created_at desc)
        from public.sermons s where s.church_id = c.id), '[]'::jsonb) end)
  from (select auth.uid() as uid) u
  left join public.profiles p on p.user_id = u.uid
  left join public.memberships m on m.user_id = u.uid
  left join public.churches c on c.id = m.church_id and c.status = 'active'
$$;

-- ---------- 운영자 함수 (SQL Editor 에서만. 앱·로그인 사용자는 부를 수 없음) ----------
-- 승인 대기 목록: 서류는 Storage › proofs › <user_id> 폴더에서 확인
create or replace view public.pending_members as
  select u.email, p.name, p.church_name, p.requested_at, p.proof_path, p.user_id
  from public.profiles p join auth.users u on u.id = p.user_id
  where p.church_status = 'pending'
  order by p.requested_at;

-- 승인: 교회 이름(생략하면 신청한 이름)과 같은 교회가 있으면 연결, 없으면 만든다. p_admin = true 면 그 교회 관리자.
create or replace function public.approve_member(p_email text, p_church_name text default null, p_admin boolean default false)
returns text language plpgsql security definer set search_path = public, auth as $$
declare uid uuid; nm text; cid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(btrim(p_email));
  if uid is null then return '없는 이메일: ' || p_email; end if;
  select coalesce(nullif(btrim(p_church_name), ''), church_name) into nm from public.profiles where user_id = uid;
  if nm is null then return '교회 이름이 없습니다(신청 전이거나 개인 정보가 없음): ' || p_email; end if;
  select id into cid from public.churches where lower(btrim(name)) = lower(nm);
  if cid is null then insert into public.churches (name, status) values (nm, 'active') returning id into cid;
  else update public.churches set status = 'active' where id = cid; end if;
  insert into public.memberships (user_id, church_id, role) values (uid, cid, case when p_admin then 'admin' else 'member' end)
  on conflict (user_id) do update set church_id = excluded.church_id, role = excluded.role;
  update public.profiles set church_status = 'approved', church_name = nm, reject_reason = null, reviewed_at = now(), updated_at = now()
  where user_id = uid;
  return '승인: ' || p_email || ' → ' || nm || case when p_admin then ' (관리자)' else '' end;
end $$;

create or replace function public.reject_member(p_email text, p_reason text default null)
returns text language plpgsql security definer set search_path = public, auth as $$
declare uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(btrim(p_email));
  if uid is null then return '없는 이메일: ' || p_email; end if;
  update public.profiles set church_status = 'rejected', reject_reason = left(nullif(btrim(p_reason), ''), 200), reviewed_at = now(), updated_at = now()
  where user_id = uid;
  return '반려: ' || p_email;
end $$;

create or replace function public.set_church_admin(p_email text, p_admin boolean default true)
returns text language plpgsql security definer set search_path = public, auth as $$
declare uid uuid; n int;
begin
  select id into uid from auth.users where lower(email) = lower(btrim(p_email));
  update public.memberships set role = case when p_admin then 'admin' else 'member' end where user_id = uid;
  get diagnostics n = row_count;
  return case when n = 0 then '승인된 소속이 없는 이메일: ' || p_email else '관리자 ' || case when p_admin then '지정: ' else '해제: ' end || p_email end;
end $$;

-- ---------- 행 단위 접근 규칙 ----------
alter table public.churches    enable row level security;
alter table public.memberships enable row level security;
alter table public.profiles    enable row level security;
alter table public.sermons     enable row level security;

drop policy if exists churches_read on public.churches;
create policy churches_read on public.churches for select to authenticated using (id = public.my_church_id());

drop policy if exists memberships_read on public.memberships;
create policy memberships_read on public.memberships for select to authenticated using (user_id = auth.uid());

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (user_id = auth.uid());

drop policy if exists sermons_read on public.sermons;
create policy sermons_read on public.sermons for select to authenticated using (church_id = public.my_active_church_id());
drop policy if exists sermons_admin_ins on public.sermons;
create policy sermons_admin_ins on public.sermons for insert to authenticated
  with check (public.am_church_admin() and church_id = public.my_active_church_id());
drop policy if exists sermons_admin_upd on public.sermons;
create policy sermons_admin_upd on public.sermons for update to authenticated
  using (public.am_church_admin() and church_id = public.my_active_church_id())
  with check (public.am_church_admin() and church_id = public.my_active_church_id());
drop policy if exists sermons_admin_del on public.sermons;
create policy sermons_admin_del on public.sermons for delete to authenticated
  using (public.am_church_admin() and church_id = public.my_active_church_id());

-- ---------- 권한 (로그인 안 한 사용자 = anon 은 아무것도 못 함) ----------
revoke all on public.churches, public.memberships, public.profiles, public.sermons, public.pending_members from anon, authenticated;
grant select (id, name, status, created_at) on public.churches to authenticated;
grant select on public.memberships to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.sermons to authenticated;
revoke all on function public.my_church_id(), public.my_active_church_id(), public.am_church_admin() from public, anon;
grant execute on function public.my_church_id(), public.my_active_church_id(), public.am_church_admin() to authenticated;
revoke all on function public.save_my_profile(text, text, text, text, boolean), public.request_church_membership(text, text),
  public.clear_my_proof(), public.leave_church(), public.delete_my_account(), public.my_account() from public, anon;
grant execute on function public.save_my_profile(text, text, text, text, boolean), public.request_church_membership(text, text),
  public.clear_my_proof(), public.leave_church(), public.delete_my_account(), public.my_account() to authenticated;
revoke all on function public.approve_member(text, text, boolean), public.reject_member(text, text), public.set_church_admin(text, boolean)
  from public, anon, authenticated;
