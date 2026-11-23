-- Copiloto Travel Experience · esquema de la base
-- Se pega en Supabase > SQL Editor y se ejecuta una vez.
-- Es seguro volver a correrlo: no borra datos.

-- 1) Servicios de proveedores (los mantiene el equipo desde el SQL Editor)
create table if not exists public.servicios (
  id           integer primary key,
  nombre       text    not null,
  tipo         text    not null check (tipo in ('alojamiento', 'traslado', 'excursion', 'actividad')),
  region       text    not null check (region in ('norte', 'mendoza')),
  lugar        text    not null,
  precio_usd   numeric(10,2) not null check (precio_usd >= 0),
  unidad       text    not null,
  detalle      text,
  hora_salida  time,
  proveedor    text    not null,
  activo       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- 2) Consultas que pega el asesor
create table if not exists public.consultas (
  id            uuid primary key default gen_random_uuid(),
  creado_por    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  conversacion  text not null,
  ficha         jsonb,
  created_at    timestamptz not null default now()
);

-- 3) Versiones del itinerario de cada consulta
create table if not exists public.itinerarios (
  id           uuid primary key default gen_random_uuid(),
  consulta_id  uuid not null references public.consultas (id) on delete cascade,
  version      integer not null check (version >= 1),
  ajuste       text,
  contenido    jsonb not null,
  modelo       text,
  duracion_ms  integer,
  creado_por   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (consulta_id, version)
);
create index if not exists itinerarios_consulta_idx on public.itinerarios (consulta_id);

-- 4) Lo que se pidió y no estaba en la base
create table if not exists public.pedidos_sin_cubrir (
  id           uuid primary key default gen_random_uuid(),
  consulta_id  uuid references public.consultas (id) on delete set null,
  pedido       text not null,
  destino      text,
  motivo       text,
  creado_por   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now()
);
create index if not exists pedidos_consulta_idx on public.pedidos_sin_cubrir (consulta_id);

-- 5) Protección: sin sesión no se ve ni se escribe nada
alter table public.servicios          enable row level security;
alter table public.consultas          enable row level security;
alter table public.itinerarios        enable row level security;
alter table public.pedidos_sin_cubrir enable row level security;

-- Servicios: cualquier usuario con sesión los lee; nadie los modifica desde la app
drop policy if exists "servicios: leer con sesion" on public.servicios;
create policy "servicios: leer con sesion" on public.servicios
  for select to authenticated using (true);

-- Consultas: cada usuario ve y maneja solo las suyas
drop policy if exists "consultas: propias" on public.consultas;
create policy "consultas: propias" on public.consultas
  for all to authenticated
  using (creado_por = (select auth.uid()))
  with check (creado_por = (select auth.uid()));

-- Itinerarios: solo los de consultas propias
drop policy if exists "itinerarios: de consultas propias" on public.itinerarios;
create policy "itinerarios: de consultas propias" on public.itinerarios
  for all to authenticated
  using (creado_por = (select auth.uid()))
  with check (
    creado_por = (select auth.uid())
    and exists (
      select 1 from public.consultas c
      where c.id = consulta_id and c.creado_por = (select auth.uid())
    )
  );

-- Pedidos sin cubrir: cada usuario registra y ve los suyos
drop policy if exists "pedidos: propios" on public.pedidos_sin_cubrir;
create policy "pedidos: propios" on public.pedidos_sin_cubrir
  for all to authenticated
  using (creado_por = (select auth.uid()))
  with check (creado_por = (select auth.uid()));

-- Sin acceso para visitantes sin sesión
revoke all on public.servicios, public.consultas, public.itinerarios, public.pedidos_sin_cubrir from anon;

-- 6) Permisos para usuarios con sesión
-- Supabase ya no los otorga solo en tablas nuevas. Estos permisos habilitan la tabla;
-- las reglas de arriba deciden qué filas ve y toca cada usuario.
grant select on public.servicios to authenticated;
grant select, insert, update, delete
  on public.consultas, public.itinerarios, public.pedidos_sin_cubrir
  to authenticated;
