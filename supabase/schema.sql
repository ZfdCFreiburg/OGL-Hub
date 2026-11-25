-- Schema für den optionalen Supabase-Chat in OGL Hub
-- Im Supabase Dashboard unter "SQL Editor" ausführen.

create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  room text not null default 'general',
  author text not null check (char_length(author) between 1 and 40),
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_messages_room_created
  on public.chat_messages (room, created_at desc);

alter table public.chat_messages enable row level security;

-- Öffentlicher Lese- und Schreibzugriff (für einfache Teams ohne Login).
-- Optional später auf authenticated Users einschränken: `to authenticated`.
create policy "Jeder darf Chat-Nachrichten lesen"
  on public.chat_messages
  for select
  using (true);

create policy "Jeder darf Chat-Nachrichten schreiben"
  on public.chat_messages
  for insert
  with check (true);

-- Realtime für die Tabelle aktivieren
alter publication supabase_realtime add table public.chat_messages;
