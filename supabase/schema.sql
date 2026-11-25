-- Schema, Storage-Policies & abgesicherter Workshop-Chat für OGL Hub

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
      lower(auth.jwt() ->> 'email') = 'zfdc@janboelmann.de'
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
      lower(auth.jwt() ->> 'email') = 'zfdc@janboelmann.de'
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
      lower(auth.jwt() ->> 'email') = 'zfdc@janboelmann.de'
      or lower(auth.jwt() -> 'user_metadata' ->> 'user_name') = 'zfdcfreiburg'
    )
  );

-- 2. Chat-Einstellungen (Workshop-Code, nur für Admin les- und schreibbar)
create table if not exists public.chat_settings (
  room text primary key default 'general',
  workshop_code text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.chat_settings (room, workshop_code)
values ('general', '')
on conflict (room) do nothing;

alter table public.chat_settings enable row level security;

grant select, insert, update on public.chat_settings to authenticated;

drop policy if exists "Nur Admin darf chat_settings verwalten" on public.chat_settings;
create policy "Nur Admin darf chat_settings verwalten"
  on public.chat_settings
  for all
  to authenticated
  using (
    lower(auth.jwt() ->> 'email') = 'zfdc@janboelmann.de'
    or lower(auth.jwt() -> 'user_metadata' ->> 'user_name') = 'zfdcfreiburg'
  )
  with check (
    lower(auth.jwt() ->> 'email') = 'zfdc@janboelmann.de'
    or lower(auth.jwt() -> 'user_metadata' ->> 'user_name') = 'zfdcfreiburg'
  );

-- 3. Chat-Nachrichten (direkter Zugriff gesperrt; Zugriff läuft über RPC mit Code-Prüfung)
create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  room text not null default 'general',
  author text not null check (char_length(author) between 1 and 40),
  content text not null check (char_length(content) between 1 and 1000),
  color text not null default '',
  created_at timestamptz not null default now()
);

alter table public.chat_messages add column if not exists color text not null default '';

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
    lower(auth.jwt() ->> 'email') = 'zfdc@janboelmann.de'
    or lower(auth.jwt() -> 'user_metadata' ->> 'user_name') = 'zfdcfreiburg'
  );

-- 4. Serverseitige RPC-Funktionen für den Workshop-Code (Code ist immer Pflicht)
create or replace function public.chat_status(p_room text default 'general')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return jsonb_build_object('code_required', true);
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

create or replace function public.chat_send_message(
  p_room text,
  p_code text,
  p_author text,
  p_content text,
  p_color text default ''
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
  v_last_author_at timestamptz;
  v_last_content text;
  v_recent_room_count int;
  v_row public.chat_messages;
begin
  select workshop_code into v_code from public.chat_settings where room = p_room;
  if coalesce(v_code, '') = '' or coalesce(p_code, '') <> v_code then
    raise exception 'Falscher Workshop-Code';
  end if;

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

  insert into public.chat_messages (room, author, content, color)
  values (p_room, v_author, v_content, v_color)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.chat_status(text) to anon, authenticated;
grant execute on function public.chat_get_messages(text, text) to anon, authenticated;
grant execute on function public.chat_send_message(text, text, text, text, text) to anon, authenticated;

create or replace function public.verify_portal_code(p_room text default 'general', p_code text default '')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  select workshop_code into v_code from public.chat_settings where room = p_room;
  return coalesce(v_code, '') <> '' and coalesce(p_code, '') = v_code;
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
    lower(auth.jwt() ->> 'email') = 'zfdc@janboelmann.de'
    or lower(auth.jwt() -> 'user_metadata' ->> 'user_name') = 'zfdcfreiburg'
  )
  with check (
    lower(auth.jwt() ->> 'email') = 'zfdc@janboelmann.de'
    or lower(auth.jwt() -> 'user_metadata' ->> 'user_name') = 'zfdcfreiburg'
  );
