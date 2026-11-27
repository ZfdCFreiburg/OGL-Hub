-- Schema, Storage-Policies & abgesicherter Workshop-Chat für OGL Hub

create or replace function public.is_admin_jwt()
returns boolean
language sql
stable
set search_path = public
as $$
  select (
    lower(coalesce(auth.jwt() ->> 'email', '')) in ('zfdc@janboelmann.de', 'admin@ogl-hub.local')
    or lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'user_name', '')) = 'zfdcfreiburg'
  );
$$;

-- 1. Storage-Policies für den Bucket "hub-files"
drop policy if exists "Öffentlicher Lesezugriff auf hub-files" on storage.objects;
create policy "Öffentlicher Lesezugriff auf hub-files"
  on storage.objects for select
  using (bucket_id = 'hub-files');

drop policy if exists "Admin darf in hub-files hochladen" on storage.objects;
create policy "Admin darf in hub-files hochladen"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'hub-files'
    and (
      lower(auth.jwt() ->> 'email') in ('zfdc@janboelmann.de', 'admin@ogl-hub.local')
      or lower(auth.jwt() -> 'user_metadata' ->> 'user_name') = 'zfdcfreiburg'
    )
  );

drop policy if exists "Admin darf in hub-files aktualisieren" on storage.objects;
create policy "Admin darf in hub-files aktualisieren"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'hub-files'
    and (
      lower(auth.jwt() ->> 'email') in ('zfdc@janboelmann.de', 'admin@ogl-hub.local')
      or lower(auth.jwt() -> 'user_metadata' ->> 'user_name') = 'zfdcfreiburg'
    )
  );

drop policy if exists "Admin darf aus hub-files löschen" on storage.objects;
create policy "Admin darf aus hub-files löschen"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'hub-files'
    and (
      lower(auth.jwt() ->> 'email') in ('zfdc@janboelmann.de', 'admin@ogl-hub.local')
      or lower(auth.jwt() -> 'user_metadata' ->> 'user_name') = 'zfdcfreiburg'
    )
  );

-- 2. Chat-Einstellungen (Workshop-Code & angepinnte Nachricht, nur für Admin schreibbar)
create table if not exists public.chat_settings (
  room text primary key default 'general',
  workshop_code text not null default '',
  pinned_message text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.chat_settings add column if not exists pinned_message text not null default '';

insert into public.chat_settings (room, workshop_code)
values ('general', '')
on conflict (room) do nothing;

alter table public.chat_settings add column if not exists session_active boolean not null default false;
alter table public.chat_settings add column if not exists admin_last_seen timestamptz default null;
alter table public.chat_settings add column if not exists session_started_at timestamptz default null;
alter table public.chat_settings add column if not exists session_id text not null default '';

alter table public.chat_settings enable row level security;

grant select, insert, update on public.chat_settings to authenticated;

drop policy if exists "Nur Admin darf chat_settings verwalten" on public.chat_settings;
create policy "Nur Admin darf chat_settings verwalten"
  on public.chat_settings
  for all
  to authenticated
  using (
public.is_admin_jwt()
  )
  with check (
public.is_admin_jwt()
  );

-- 3. Chat-Nachrichten (direkter Zugriff gesperrt; Zugriff läuft über RPC mit Code-Prüfung)
create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  room text not null default 'general',
  author text not null check (char_length(author) between 1 and 40),
  content text not null check (char_length(content) between 1 and 1000),
  color text not null default '',
  avatar text not null default '',
  reactions jsonb not null default '{}'::jsonb,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.chat_messages add column if not exists color text not null default '';
alter table public.chat_messages add column if not exists avatar text not null default '';
alter table public.chat_messages add column if not exists reactions jsonb not null default '{}'::jsonb;
alter table public.chat_messages add column if not exists is_admin boolean not null default false;
alter table public.chat_messages add column if not exists reply_to jsonb default null;

create index if not exists idx_chat_messages_room_created
  on public.chat_messages (room, created_at desc);

alter table public.chat_messages enable row level security;

grant select, delete on public.chat_messages to authenticated;

drop policy if exists "Jeder darf Chat-Nachrichten lesen" on public.chat_messages;
drop policy if exists "Jeder darf Chat-Nachrichten schreiben" on public.chat_messages;
drop policy if exists "Admin darf chat_messages verwalten" on public.chat_messages;
create policy "Admin darf chat_messages verwalten"
  on public.chat_messages
  for all
  to authenticated
  using (
public.is_admin_jwt()
  );

-- 4. Serverseitige RPC-Funktionen für den Workshop-Code (Code ist immer Pflicht)
create or replace function public.is_workshop_session_active(p_room text default 'general')
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_settings
    where room = p_room
      and session_active = true
      and session_started_at is not null
      and session_started_at > now() - interval '24 hours'
  );
$$;

grant execute on function public.is_workshop_session_active(text) to anon, authenticated;

create or replace function public.chat_status(p_room text default 'general')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pinned text;
  v_session_id text;
begin
  select pinned_message, session_id
    into v_pinned, v_session_id
  from public.chat_settings
  where room = p_room;
  return jsonb_build_object(
    'code_required', true,
    'session_active', public.is_workshop_session_active(p_room),
    'session_id', coalesce(v_session_id, ''),
    'pinned_message', coalesce(v_pinned, '')
  );
end;
$$;

create or replace function public.chat_get_messages(p_room text default 'general', p_code text default '')
returns setof public.chat_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if not public.is_workshop_session_active(p_room) then
    raise exception 'Workshop-Session beendet';
  end if;

  select workshop_code into v_code from public.chat_settings where room = p_room;
  if coalesce(v_code, '') = '' or coalesce(p_code, '') <> v_code then
    raise exception 'Falscher Workshop-Code';
  end if;

  return query
  select *
  from public.chat_messages
  where room = p_room
    and created_at >= now() - interval '3 hours'
  order by created_at asc
  limit 50;
end;
$$;

drop function if exists public.chat_send_message(text, text, text, text, text, text);

create or replace function public.chat_send_message(
  p_room text,
  p_code text,
  p_author text,
  p_content text,
  p_color text default '',
  p_avatar text default '',
  p_reply_to jsonb default null
)
returns public.chat_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_author text := trim(coalesce(p_author, ''));
  v_content text := regexp_replace(trim(coalesce(p_content, '')), '\s+', ' ', 'g');
  v_color text := case when coalesce(p_color, '') ~ '^#[0-9a-fA-F]{6}$' then lower(p_color) else '' end;
  v_avatar text := case when coalesce(p_avatar, '') ~ '^[a-z0-9_-]{1,20}$' then lower(p_avatar) else '' end;
  v_reply_to jsonb := null;
  v_last_author_at timestamptz;
  v_last_content text;
  v_recent_room_count int;
  v_is_admin boolean := false;
  v_row public.chat_messages;
begin
  if not public.is_workshop_session_active(p_room) then
    raise exception 'Workshop-Session beendet';
  end if;

  select workshop_code into v_code from public.chat_settings where room = p_room;
  if coalesce(v_code, '') = '' or coalesce(p_code, '') <> v_code then
    raise exception 'Falscher Workshop-Code';
  end if;

  v_is_admin := public.is_admin_jwt();

  if char_length(v_author) < 1 or char_length(v_author) > 40 then
    raise exception 'Ungültiger Name';
  end if;
  if char_length(v_content) < 1 or char_length(v_content) > 500 then
    raise exception 'Nachricht muss zwischen 1 und 500 Zeichen lang sein';
  end if;

  -- Alte Nachrichten (> 3 Stunden) automatisch bereinigen
  delete from public.chat_messages
  where created_at < now() - interval '3 hours';

  -- Anti-Spam 1: Cooldown pro Name (min. 3 Sekunden zwischen Nachrichten)
  select created_at, content
    into v_last_author_at, v_last_content
  from public.chat_messages
  where room = p_room and lower(author) = lower(v_author)
  order by created_at desc
  limit 1;

  if v_last_author_at is not null and v_last_author_at > now() - interval '3 seconds' then
    raise exception 'Bitte warte kurz vor der nächsten Nachricht';
  end if;

  -- Anti-Spam 2: Duplikat-Schutz innerhalb von 30 Sekunden
  if v_last_author_at is not null
     and v_last_author_at > now() - interval '30 seconds'
     and lower(v_last_content) = lower(v_content) then
    raise exception 'Doppelte Nachricht blockiert';
  end if;

  -- Anti-Spam 3: Globales Raum-Limit (max. 25 Nachrichten pro Minute)
  select count(*) into v_recent_room_count
  from public.chat_messages
  where room = p_room and created_at > now() - interval '1 minute';

  if v_recent_room_count >= 25 then
    raise exception 'Zu viele Nachrichten im Chat – bitte kurz warten';
  end if;

  if p_reply_to is not null and coalesce(trim(p_reply_to ->> 'author'), '') <> '' then
    v_reply_to := jsonb_build_object(
      'id', p_reply_to ->> 'id',
      'author', left(trim(p_reply_to ->> 'author'), 40),
      'preview', left(trim(coalesce(p_reply_to ->> 'preview', '')), 80)
    );
  end if;

  insert into public.chat_messages (room, author, content, color, avatar, is_admin, reply_to)
  values (p_room, v_author, v_content, v_color, v_avatar, v_is_admin, v_reply_to)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.chat_status(text) to anon, authenticated;
grant execute on function public.chat_get_messages(text, text) to anon, authenticated;
grant execute on function public.chat_send_message(text, text, text, text, text, text, jsonb) to anon, authenticated;

create or replace function public.chat_react_message(
  p_room text,
  p_code text,
  p_message_id bigint,
  p_emoji text,
  p_delta int default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_reactions jsonb;
  v_cur int;
  v_next int;
begin
  if not public.is_workshop_session_active(p_room) then
    raise exception 'Workshop-Session beendet';
  end if;

  select workshop_code into v_code from public.chat_settings where room = p_room;
  if coalesce(v_code, '') = '' or coalesce(p_code, '') <> v_code then
    raise exception 'Falscher Workshop-Code';
  end if;

  if p_emoji not in ('👍', '✅', '❤️', '🎉', '❓') then
    raise exception 'Ungültige Reaktion';
  end if;

  select reactions into v_reactions from public.chat_messages where id = p_message_id and room = p_room;
  if v_reactions is null then
    raise exception 'Nachricht nicht gefunden';
  end if;

  v_cur := coalesce((v_reactions ->> p_emoji)::int, 0);
  v_next := greatest(0, v_cur + (case when p_delta >= 0 then 1 else -1 end));

  if v_next = 0 then
    v_reactions := v_reactions - p_emoji;
  else
    v_reactions := jsonb_set(v_reactions, array[p_emoji], to_jsonb(v_next), true);
  end if;

  update public.chat_messages
  set reactions = v_reactions
  where id = p_message_id and room = p_room;

  return v_reactions;
end;
$$;

grant execute on function public.chat_react_message(text, text, bigint, text, int) to anon, authenticated;

create table if not exists public.portal_code_attempts (
  id bigserial primary key,
  room text not null,
  attempted_at timestamptz not null default now()
);

alter table public.portal_code_attempts enable row level security;

create or replace function public.verify_portal_code(p_room text default 'general', p_code text default '')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_fails int;
  v_ok boolean;
begin
  if not public.is_workshop_session_active(p_room) then
    raise exception 'Aktuell ist kein Workshop aktiv.';
  end if;

  delete from public.portal_code_attempts
  where attempted_at < now() - interval '10 minutes';

  select count(*) into v_fails
  from public.portal_code_attempts
  where room = p_room and attempted_at > now() - interval '5 minutes';

  if v_fails >= 15 then
    raise exception 'Zu viele Fehlversuche – bitte 5 Minuten warten.';
  end if;

  select workshop_code into v_code from public.chat_settings where room = p_room;
  v_ok := coalesce(v_code, '') <> '' and coalesce(p_code, '') = v_code;

  if v_ok then
    delete from public.portal_code_attempts where room = p_room;
    return true;
  end if;

  insert into public.portal_code_attempts (room) values (p_room);
  return false;
end;
$$;

grant execute on function public.verify_portal_code(text, text) to anon, authenticated;

-- 5. Workshop-Infos (sofort live ohne GitHub-Pages-Build)
create table if not exists public.site_settings (
  id text primary key default 'default',
  page_title text not null default '',
  workshop_leader text not null default '',
  description text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id, page_title, workshop_leader, description)
values (
  'default',
  'Workshop Digital Independence',
  'bene',
  'Dokumente, Vorlagen und Materialien einfach herunterladen.'
)
on conflict (id) do nothing;

alter table public.site_settings enable row level security;

grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;

drop policy if exists "Jeder darf site_settings lesen" on public.site_settings;
create policy "Jeder darf site_settings lesen"
  on public.site_settings for select
  using (true);

drop policy if exists "Admin darf site_settings bearbeiten" on public.site_settings;
create policy "Admin darf site_settings bearbeiten"
  on public.site_settings for all
  to authenticated
  using (
public.is_admin_jwt()
  )
  with check (
public.is_admin_jwt()
  );

-- 6. Geteilte Links & Ressourcen (geschützt durch Workshop-Code)
create table if not exists public.hub_links (
  id bigint generated always as identity primary key,
  room text not null default 'general',
  title text not null check (char_length(trim(title)) between 1 and 120),
  url text not null check (url ~ '^https?://'),
  folder text not null default 'Links',
  description text not null default '',
  created_at timestamptz not null default now()
);

alter table public.hub_links enable row level security;

grant select, insert, delete on public.hub_links to authenticated;

drop policy if exists "Admin darf hub_links verwalten" on public.hub_links;
create policy "Admin darf hub_links verwalten"
  on public.hub_links for all
  to authenticated
  using (
public.is_admin_jwt()
  )
  with check (
public.is_admin_jwt()
  );

create or replace function public.get_portal_links(p_room text default 'general', p_code text default '')
returns setof public.hub_links
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if not public.is_workshop_session_active(p_room) then
    raise exception 'Workshop-Session beendet';
  end if;

  select workshop_code into v_code from public.chat_settings where room = p_room;
  if coalesce(v_code, '') = '' or coalesce(p_code, '') <> v_code then
    raise exception 'Falscher Workshop-Code';
  end if;

  return query
  select *
  from public.hub_links
  where room = p_room
  order by created_at desc
  limit 100;
end;
$$;

grant execute on function public.get_portal_links(text, text) to anon, authenticated;
