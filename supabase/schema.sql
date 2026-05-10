-- Profiles table (extends auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text not null unique,
  created_at timestamptz default now() not null
);

-- Games table
create table public.games (
  id uuid default gen_random_uuid() primary key,
  created_by uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  location text not null,
  date_time timestamptz not null,
  player_limit integer not null default 10,
  description text,
  sport text not null default 'basketball' check (sport in ('basketball', 'badminton', 'pickleball', 'tennis')),
  status text not null default 'open' check (status in ('open', 'full', 'cancelled')),
  created_at timestamptz default now() not null
);

-- Game players junction table
create table public.game_players (
  id uuid default gen_random_uuid() primary key,
  game_id uuid references public.games(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  joined_at timestamptz default now() not null,
  unique (game_id, user_id)
);

-- Auto-create profile on signup via trigger (runs as security definer, bypasses RLS)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.game_players enable row level security;

-- Profiles policies
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- Games policies
create policy "Games are viewable by everyone"
  on public.games for select using (true);

create policy "Authenticated users can create games"
  on public.games for insert with check (auth.uid() = created_by);

create policy "Creators can update their own games"
  on public.games for update using (auth.uid() = created_by);

create policy "Creators can delete their own games"
  on public.games for delete using (auth.uid() = created_by);

-- Game players policies
create policy "Game players are viewable by everyone"
  on public.game_players for select using (true);

create policy "Authenticated users can join games"
  on public.game_players for insert with check (auth.uid() = user_id);

create policy "Users can leave games they joined"
  on public.game_players for delete using (auth.uid() = user_id);

-- Indexes for performance
create index on public.games (date_time);
create index on public.games (status);
create index on public.game_players (game_id);
create index on public.game_players (user_id);
