-- Copiloto Travel Experience · link para el cliente (etapa 13)
-- Se pega en Supabase > SQL Editor y se ejecuta una vez. Es seguro volver a correrlo.
-- Crea la tabla compartidos (el link) y una función pública que devuelve solo lo que
-- puede ver el cliente. No toca ninguna tabla existente.
-- Las métricas de apertura (dispositivos, tiempo) y sus topes se deciden y suman después.

-- 1) El link: una versión congelada de un itinerario
create table if not exists public.compartidos (
  id            uuid primary key default gen_random_uuid(),
  itinerario_id uuid not null references public.itinerarios (id) on delete cascade,
  -- 32 caracteres al azar (122 bits): no se puede adivinar
  codigo        text not null unique default replace(gen_random_uuid()::text, '-', ''),
  creado_por    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vence_at      timestamptz not null default now() + interval '30 days',  -- el link deja de abrirse
  valido_hasta  timestamptz not null default now() + interval '48 hours', -- el presupuesto deja de valer
  revocado_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists compartidos_itinerario_idx on public.compartidos (itinerario_id);
create index if not exists compartidos_creado_por_idx on public.compartidos (creado_por);

-- 2) Protección: el asesor crea y ve solo sus links, y solo de itinerarios propios
alter table public.compartidos enable row level security;

drop policy if exists "compartidos: propios" on public.compartidos;
create policy "compartidos: propios" on public.compartidos
  for all to authenticated
  using (creado_por = (select auth.uid()))
  with check (
    creado_por = (select auth.uid())
    and exists (
      select 1 from public.itinerarios i
      where i.id = itinerario_id and i.creado_por = (select auth.uid())
    )
  );

revoke all on public.compartidos from anon;
revoke all on public.compartidos from authenticated;
grant select, insert on public.compartidos to authenticated;
grant update (revocado_at) on public.compartidos to authenticated;  -- revocar

-- 3) Lo que ve el cliente: solo campos permitidos. Sin notas para el asesor, conversación,
--    ficha, pedidos sin cubrir ni proveedores. Sí incluye el precio de cada servicio.
--    Devuelve null si el código no existe, venció o fue revocado (el mismo null para los tres).
create or replace function public.ver_compartido(p_codigo text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'titulo',          i.contenido->>'titulo',
    'resumen',         i.contenido->>'resumen',
    'total_usd',       i.contenido->'total_usd',
    'por_persona_usd', i.contenido->'por_persona_usd',
    'valido_hasta',    c.valido_hasta,
    'dias', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'numero', d->'numero',
          'titulo', d->'titulo',
          'lugar',  d->'lugar',
          'libre',  d->'libre',
          'items', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'hora', it->'hora', 'nombre', it->'nombre', 'tipo', it->'tipo', 'lugar', it->'lugar',
                'cantidad', it->'cantidad', 'unidad', it->'unidad',
                'precio_usd', it->'precio_usd', 'subtotal_usd', it->'subtotal_usd')
              order by n2)
            from jsonb_array_elements(d->'items') with ordinality as t2(it, n2)
          ), '[]'::jsonb)
        ) order by n1)
      from jsonb_array_elements(i.contenido->'dias') with ordinality as t1(d, n1)
    ), '[]'::jsonb)
  )
  from public.compartidos c
  join public.itinerarios i on i.id = c.itinerario_id
  where c.codigo = p_codigo
    and c.revocado_at is null
    and c.vence_at > now();
$$;

-- Los visitantes sin sesión solo pueden llamar a esta función
revoke all on function public.ver_compartido(text) from public;
grant execute on function public.ver_compartido(text) to anon, authenticated;
