-- 책장성경 교회 계정 1단계(최소판) 서버 표 · 접근 규칙 · 함수  (Supabase SQL Editor에 그대로 붙여 넣어 한 번 실행)
-- 결정 사항(2026-11-24, docs/HANDOFF-church-accounts.md 7장):
--   · 교회 개설 = 승인제: 누구나 신청 → 운영자가 Supabase 표 편집기에서 churches.status 를 'active' 로 바꿔 승인
--   · 교회 가입 = 초대코드, 한 사람은 한 교회만 (memberships 의 기본 키가 user_id)
--   · 설교 영상 = 교회 관리자가 직접 입력(유튜브 영상 ID + 책·장·절 범위). 자동 연동은 3단계
-- 모든 표는 행 단위 접근 규칙(RLS)을 켜고, 같은 교회 사람만 읽고 관리자만 영상을 쓴다.
-- 가입·탈퇴·개설 신청은 아래 함수로만 한다(표에 직접 쓰는 규칙은 두지 않음).
-- ※ 개인정보: 교회 소속은 종교 관련 정보라 민감정보로 볼 소지가 있음 → 배포 전 법률 전문가 확인 필요(이 파일은 법률 판단이 아님).

create extension if not exists pgcrypto;

-- ---------- 표 ----------
create table if not exists public.churches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 2 and 40),
  status      text not null default 'pending' check (status in ('pending', 'active', 'rejected')),
  invite_code text not null unique,                 -- 숫자·대문자 8자리(헷갈리는 0·O·1·I 제외)
  created_by  uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.memberships (
  user_id    uuid primary key references auth.users (id) on delete cascade,   -- 한 사람 = 한 교회
  church_id  uuid not null references public.churches (id) on delete cascade,
  role       text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now()
);
create index if not exists memberships_church_idx on public.memberships (church_id);

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

-- ※ gen_random_bytes 는 pgcrypto 함수다. Supabase 는 확장을 'extensions' 폴더(스키마)에 두므로 search_path 에 extensions 도 넣어야 찾는다
--   (public 만 쓰면 'function gen_random_bytes(integer) does not exist' 로 교회 개설 신청이 첫 번째부터 실패한다).
create or replace function public.new_invite_code() returns text
language plpgsql volatile set search_path = public, extensions as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  code text;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + (get_byte(gen_random_bytes(1), 0) % 32), 1);
    end loop;
    exit when not exists (select 1 from public.churches where invite_code = code);
  end loop;
  return code;
end $$;

-- ---------- 앱이 부르는 함수 (rpc) ----------
-- 교회 개설 신청: 신청자는 그 교회의 관리자가 되지만, 운영자가 승인하기 전까지(status='pending') 영상은 쓸 수 없다.
create or replace function public.request_church(p_name text) returns public.churches
language plpgsql security definer set search_path = public as $$
declare ch public.churches;
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  if exists (select 1 from public.memberships where user_id = auth.uid()) then
    raise exception 'already in a church' using errcode = 'P0001';
  end if;
  -- 스팸 방지: 한 사람이 승인 대기 중인 신청은 하나만
  if exists (select 1 from public.churches where created_by = auth.uid() and status = 'pending') then
    raise exception 'request pending' using errcode = 'P0001';
  end if;
  insert into public.churches (name, invite_code, created_by)
  values (btrim(p_name), public.new_invite_code(), auth.uid()) returning * into ch;
  insert into public.memberships (user_id, church_id, role) values (auth.uid(), ch.id, 'admin');
  return ch;
end $$;

-- 초대코드로 가입: 승인된(active) 교회만, 한 사람은 한 교회만.
create or replace function public.join_church(p_code text) returns table (church_id uuid, church_name text)
language plpgsql security definer set search_path = public as $$
declare ch public.churches;
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  if exists (select 1 from public.memberships where user_id = auth.uid()) then
    raise exception 'already in a church' using errcode = 'P0001';
  end if;
  select * into ch from public.churches c
  where c.invite_code = upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Za-z]', '', 'g')) and c.status = 'active';
  if ch.id is null then raise exception 'invalid code' using errcode = 'P0001'; end if;
  insert into public.memberships (user_id, church_id, role) values (auth.uid(), ch.id, 'member');
  return query select ch.id, ch.name;
end $$;

-- 교회 나가기. 마지막 관리자는 나갈 수 없다(교회가 관리자 없이 남지 않게).
create or replace function public.leave_church() returns void
language plpgsql security definer set search_path = public as $$
declare m public.memberships;
begin
  select * into m from public.memberships where user_id = auth.uid();
  if m.user_id is null then return; end if;
  if m.role = 'admin' and not exists (
       select 1 from public.memberships where church_id = m.church_id and role = 'admin' and user_id <> auth.uid())
     and exists (select 1 from public.memberships where church_id = m.church_id and user_id <> auth.uid()) then
    raise exception 'last admin' using errcode = 'P0001';
  end if;
  delete from public.memberships where user_id = auth.uid();
  -- 아무도 남지 않은 교회는 지운다(그 교회의 영상도 함께 지워짐)
  delete from public.churches c where c.id = m.church_id
    and not exists (select 1 from public.memberships x where x.church_id = m.church_id);
end $$;

-- 앱이 한 번에 받아 기기에 저장하는 모양: { church: {id, name, status, role, invite_code(관리자만)}, items: [...] }
create or replace function public.my_church_bundle() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when m.user_id is null then jsonb_build_object('church', null, 'items', '[]'::jsonb) else
    jsonb_build_object(
      'church', jsonb_build_object('id', c.id, 'name', c.name, 'status', c.status, 'role', m.role,
                                   'invite_code', case when m.role = 'admin' and c.status = 'active' then c.invite_code end),
      'items', case when c.status <> 'active' then '[]'::jsonb else coalesce((
        select jsonb_agg(jsonb_build_object('id', s.id, 'yt', s.yt_id, 'bk', s.bk, 'c1', s.c1, 'v1', s.v1, 'c2', s.c2, 'v2', s.v2,
                 'title', s.title, 'preacher', s.preacher, 'date', to_char(s.preached_on, 'YYYY-MM-DD'), 't', s.start_sec)
                 order by s.preached_on desc nulls last, s.created_at desc)
        from public.sermons s where s.church_id = c.id), '[]'::jsonb) end)
  end
  from (select auth.uid() as uid) u
  left join public.memberships m on m.user_id = u.uid
  left join public.churches c on c.id = m.church_id
$$;

-- ---------- 행 단위 접근 규칙 ----------
alter table public.churches    enable row level security;
alter table public.memberships enable row level security;
alter table public.sermons     enable row level security;

-- 교회: 내 교회만 볼 수 있다(초대코드 열은 아래에서 따로 막음). 쓰기는 함수와 운영자(대시보드)만.
drop policy if exists churches_read on public.churches;
create policy churches_read on public.churches for select to authenticated using (id = public.my_church_id());

-- 소속: 내 줄만 보인다(같은 교회 사람 목록은 1단계에서는 보이지 않음 — 최소한만 공개).
drop policy if exists memberships_read on public.memberships;
create policy memberships_read on public.memberships for select to authenticated using (user_id = auth.uid());

-- 설교 영상: 승인된 내 교회 것만 읽고, 그 교회 관리자만 넣고·고치고·지운다.
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
revoke all on public.churches, public.memberships, public.sermons from anon, authenticated;
grant select (id, name, status, created_at) on public.churches to authenticated;   -- 초대코드는 my_church_bundle 로 관리자에게만
grant select on public.memberships to authenticated;
grant select, insert, update, delete on public.sermons to authenticated;
revoke all on function public.my_church_id(), public.my_active_church_id(), public.am_church_admin(), public.new_invite_code() from public, anon;
revoke all on function public.request_church(text), public.join_church(text), public.leave_church(), public.my_church_bundle() from public, anon;
grant execute on function public.my_church_id(), public.my_active_church_id(), public.am_church_admin() to authenticated;
grant execute on function public.request_church(text), public.join_church(text), public.leave_church(), public.my_church_bundle() to authenticated;
