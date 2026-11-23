-- Copiloto Travel Experience · 27 servicios de ejemplo (USD, proveedores anonimizados)
-- Se pega en Supabase > SQL Editor después de 01_esquema.sql.
-- Volver a correrlo actualiza los servicios sin duplicarlos.
-- Tilcara no está a propósito: sirve para probar los pedidos sin cubrir.

insert into public.servicios
  (id, nombre, tipo, region, lugar, precio_usd, unidad, detalle, hora_salida, proveedor)
values
  -- Norte: Salta y Jujuy
  ( 1, 'Hotel boutique en el centro',                    'alojamiento', 'norte',   'Salta',                     90, 'noche, habitación doble', 'Con desayuno',                      null,    'A'),
  ( 2, 'Hostería entre viñedos',                         'alojamiento', 'norte',   'Cafayate',                 110, 'noche, habitación doble', 'Con desayuno',                      null,    'B'),
  ( 3, 'Posada de adobe',                                'alojamiento', 'norte',   'Purmamarca',                85, 'noche, habitación doble', 'Con desayuno',                      null,    'C'),
  ( 4, 'Traslado aeropuerto–hotel',                      'traslado',    'norte',   'Salta',                     20, 'tramo, vehículo',         null,                                null,    'D'),
  ( 5, 'Traslado Salta–Cafayate',                        'traslado',    'norte',   'Salta / Cafayate',         120, 'tramo, vehículo',         '3 h y media',                       null,    'D'),
  ( 6, 'Traslado Salta–Purmamarca',                      'traslado',    'norte',   'Salta / Purmamarca',       130, 'tramo, vehículo',         '3 h',                               null,    'D'),
  ( 7, 'Traslado Purmamarca–aeropuerto de Jujuy',        'traslado',    'norte',   'Purmamarca / Jujuy',        70, 'tramo, vehículo',         '1 h y media',                       null,    'D'),
  ( 8, 'Excursión Cafayate, día completo',               'excursion',   'norte',   'Cafayate',                  60, 'persona',                 'Día completo',                      '07:00', 'E'),
  ( 9, 'Excursión Cafayate con 2 bodegas y almuerzo',    'excursion',   'norte',   'Cafayate',                  75, 'persona',                 'Incluye almuerzo',                  '09:30', 'E'),
  (10, 'Degustación con maridaje',                       'actividad',   'norte',   'Cafayate',                  45, 'persona',                 'Por la tarde',                      null,    'F'),
  (11, 'Cena con show en peña folclórica',               'actividad',   'norte',   'Salta',                     35, 'persona',                 'Cena con show',                     '21:00', 'G'),
  (12, 'City tour',                                      'excursion',   'norte',   'Salta',                     25, 'persona',                 'Medio día',                         '15:00', 'E'),
  (13, 'Quebrada de Humahuaca, día completo',            'excursion',   'norte',   'Purmamarca',                55, 'persona',                 'Día completo',                      '08:00', 'H'),
  (14, 'Salinas Grandes, medio día',                     'excursion',   'norte',   'Purmamarca',                40, 'persona',                 'Medio día',                         '09:00', 'H'),
  (15, 'Tren a las Nubes',                               'excursion',   'norte',   'Salta',                    150, 'persona',                 'Día completo',                      '07:00', 'I'),
  -- Mendoza
  (16, 'Hotel boutique en el centro',                    'alojamiento', 'mendoza', 'Ciudad de Mendoza',        100, 'noche, habitación doble', 'Con desayuno',                      null,    'J'),
  (17, 'Departamento para 4 personas',                   'alojamiento', 'mendoza', 'Chacras de Coria',         140, 'noche, departamento',     '2 habitaciones, con pileta',        null,    'K'),
  (18, 'Lodge entre viñedos',                            'alojamiento', 'mendoza', 'Valle de Uco',             220, 'noche, habitación doble', 'Con desayuno',                      null,    'L'),
  (19, 'Traslado aeropuerto–hotel en van',               'traslado',    'mendoza', 'Mendoza',                   40, 'tramo, van',              'Hasta 10 personas',                 null,    'M'),
  (20, 'Traslado Mendoza–Valle de Uco en van',           'traslado',    'mendoza', 'Mendoza / Valle de Uco',   120, 'tramo, van',              '1 h y media, hasta 10 personas',    null,    'M'),
  (21, '3 bodegas en Luján de Cuyo con almuerzo',        'excursion',   'mendoza', 'Luján de Cuyo',             95, 'persona',                 'Incluye almuerzo',                  '10:00', 'N'),
  (22, '2 bodegas en Valle de Uco con almuerzo por pasos','excursion',  'mendoza', 'Valle de Uco',             130, 'persona',                 'Incluye almuerzo por pasos',        '09:00', 'N'),
  (23, 'Bici por bodegas',                               'actividad',   'mendoza', 'Maipú',                     40, 'persona',                 'Medio día',                         '10:30', 'O'),
  (24, 'Alta Montaña y Aconcagua',                       'excursion',   'mendoza', 'Mendoza',                   70, 'persona',                 'Día completo',                      '07:30', 'P'),
  (25, 'Rafting en el río Mendoza',                      'actividad',   'mendoza', 'Potrerillos',               50, 'persona',                 'Salidas 10:00 y 14:00',             '10:00', 'Q'),
  (26, 'Día de spa en termas',                           'actividad',   'mendoza', 'Cacheuta',                  60, 'persona',                 'Incluye almuerzo',                  null,    'R'),
  (27, 'Clase de cocina con maridaje',                   'actividad',   'mendoza', 'Chacras de Coria',          65, 'persona',                 'Por la noche',                      '19:00', 'S')
on conflict (id) do update set
  nombre = excluded.nombre, tipo = excluded.tipo, region = excluded.region,
  lugar = excluded.lugar, precio_usd = excluded.precio_usd, unidad = excluded.unidad,
  detalle = excluded.detalle, hora_salida = excluded.hora_salida,
  proveedor = excluded.proveedor;

-- Control: debería mostrar norte 15 y mendoza 12
select region, count(*) as servicios from public.servicios group by region order by region;
