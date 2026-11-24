-- Copiloto Travel Experience · ajustes de seguridad después de la revisión (etapa 8)
-- Se pega en Supabase > SQL Editor y se corre una vez. Se puede volver a correr sin problema.

-- 1) Topes de largo en la base: aunque alguien use la API de Supabase directamente,
--    no puede guardar textos gigantes que después viajen a la IA.
alter table public.consultas drop constraint if exists consultas_conversacion_largo;
alter table public.consultas add constraint consultas_conversacion_largo
  check (char_length(conversacion) <= 12000);

alter table public.consultas drop constraint if exists consultas_ficha_tamano;
alter table public.consultas add constraint consultas_ficha_tamano
  check (ficha is null or char_length(ficha::text) <= 8000);

alter table public.itinerarios drop constraint if exists itinerarios_ajuste_largo;
alter table public.itinerarios add constraint itinerarios_ajuste_largo
  check (ajuste is null or char_length(ajuste) <= 1000);

-- 2) Pedidos sin cubrir: además de ser propios, tienen que colgar de una consulta propia
drop policy if exists "pedidos: propios" on public.pedidos_sin_cubrir;
create policy "pedidos: propios" on public.pedidos_sin_cubrir
  for all to authenticated
  using (creado_por = (select auth.uid()))
  with check (
    creado_por = (select auth.uid())
    and (
      consulta_id is null
      or exists (
        select 1 from public.consultas c
        where c.id = consulta_id and c.creado_por = (select auth.uid())
      )
    )
  );

-- Control: debería listar las 3 restricciones nuevas
select conrelid::regclass as tabla, conname as restriccion
from pg_constraint
where conname in ('consultas_conversacion_largo', 'consultas_ficha_tamano', 'itinerarios_ajuste_largo');
