-- Copiloto Travel Experience · consultas para revisar los datos guardados
-- Se pegan en Supabase > SQL Editor y se corre cada bloque por separado
-- (seleccionalo y tocá Run). Solo leen: no cambian nada.
-- Ojo: el SQL Editor entra como administrador, así que ve las consultas de TODOS los usuarios
-- (la app, en cambio, solo le muestra a cada asesor las suyas).


-- 1 · Consultas: qué entendió la IA de cada conversación (la ficha)
select
  c.created_at::timestamp(0)            as fecha,
  u.email                               as asesor,
  c.ficha->>'destino'                   as destino,
  c.ficha->>'region'                    as region,
  (c.ficha->>'personas')::int           as personas,
  (c.ficha->>'duracion_dias')::int      as dias,
  c.ficha->>'presupuesto'               as presupuesto,
  c.ficha->'restricciones'              as a_evitar,
  c.ficha->'faltantes'                  as falta_saber,
  left(c.conversacion, 80) || '…'       as conversacion
from consultas c
join auth.users u on u.id = c.creado_por
order by c.created_at desc
limit 20;


-- 2 · Versiones de itinerario por consulta: qué pidió el asesor y cuánto cambió el total
select
  i.consulta_id,
  i.version,
  coalesce(i.ajuste, '(primera propuesta)')                as ajuste,
  i.contenido->>'titulo'                                   as titulo,
  jsonb_array_length(i.contenido->'dias')                  as dias,
  (i.contenido->>'total_usd')::numeric                     as total_usd,
  (i.contenido->>'total_usd')::numeric
    - lag((i.contenido->>'total_usd')::numeric)
      over (partition by i.consulta_id order by i.version) as diferencia_usd,
  i.modelo,
  round(i.duracion_ms / 1000.0, 1)                         as segundos,
  i.created_at::timestamp(0)                               as fecha
from itinerarios i
order by i.created_at desc, i.version desc
limit 30;


-- 3 · El itinerario más reciente, día por día (un renglón por servicio)
--     Para ver otro, cambiá el where por: where i.consulta_id = '<id>' and i.version = <n>
with ultimo as (
  select * from itinerarios order by created_at desc limit 1
)
select
  i.version,
  (d->>'numero')::int        as dia,
  d->>'titulo'               as titulo_del_dia,
  it->>'hora'                as hora,
  (it->>'servicio_id')::int  as servicio,
  it->>'nombre'              as nombre,
  (it->>'cantidad')::int     as cantidad,
  (it->>'precio_usd')::numeric   as precio_usd,
  (it->>'subtotal_usd')::numeric as subtotal_usd
from ultimo i,
  jsonb_array_elements(i.contenido->'dias')  as d,
  jsonb_array_elements(d->'items')           as it
order by dia;


-- 4 · Control cruzado: ¿cada servicio del itinerario existe en la base y el precio coincide?
--     Si devuelve 0 filas, está todo bien.
select
  i.consulta_id, i.version,
  (it->>'servicio_id')::int        as servicio,
  (it->>'precio_usd')::numeric     as precio_en_itinerario,
  s.precio_usd                     as precio_en_base,
  case when s.id is null then 'no existe en la base'
       else 'precio distinto (¿cambió el precio después?)' end as problema
from itinerarios i
cross join lateral jsonb_array_elements(i.contenido->'dias') as d
cross join lateral jsonb_array_elements(d->'items')          as it
left join servicios s on s.id = (it->>'servicio_id')::int
where s.id is null or s.precio_usd <> (it->>'precio_usd')::numeric;


-- 5 · Pedidos sin cubrir: lo que piden los clientes y no tenemos (para hablar con proveedores)
select
  p.created_at::timestamp(0)  as fecha,
  p.destino,
  p.pedido,
  p.motivo
from pedidos_sin_cubrir p
order by p.created_at desc;


-- 6 · Resumen: cuántas consultas, versiones y tiempos promedio por modelo
select
  i.modelo,
  count(*)                                       as itinerarios,
  count(*) filter (where i.ajuste is not null)   as ajustes,
  round(avg(i.duracion_ms) / 1000.0, 1)          as segundos_promedio,
  round(max(i.duracion_ms) / 1000.0, 1)          as segundos_maximo
from itinerarios i
group by i.modelo;


-- 7 · Prueba con el asesor (etapa 9): cuánto tardó cada consulta, de punta a punta
--     Desde que se generó la ficha hasta la última versión del itinerario.
--     Reemplazá el email por el del asesor (o borrá esa línea para ver todos).
select
  c.created_at::timestamp(0)                                        as inicio,
  c.ficha->>'destino'                                               as destino,
  count(i.id)                                                       as versiones,
  count(i.id) filter (where i.ajuste is not null)                   as ajustes,
  round(extract(epoch from (max(i.created_at) - c.created_at)) / 60.0, 1) as minutos_hasta_ultima_version,
  round(min(i.duracion_ms) filter (where i.version = 1) / 1000.0, 1)      as segundos_primer_itinerario,
  string_agg(i.ajuste, ' | ' order by i.version)                    as ajustes_pedidos
from consultas c
join auth.users u on u.id = c.creado_por
left join itinerarios i on i.consulta_id = c.id
where u.email = 'email-del-asesor@ejemplo.com'
group by c.id
order by c.created_at desc;
