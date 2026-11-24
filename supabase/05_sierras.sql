-- Copiloto Travel Experience · región nueva: Sierras (Córdoba y San Luis)
-- Suma 18 servicios de ejemplo (USD, proveedores anonimizados): alojamiento, traslados,
-- trekking, avistaje de aves y excursiones. Se pega en Supabase > SQL Editor y se corre una vez.
-- Se puede volver a correr sin duplicar nada.

-- 1) La región nueva tiene que estar permitida en la tabla
alter table public.servicios drop constraint if exists servicios_region_check;
alter table public.servicios add constraint servicios_region_check
  check (region in ('norte', 'mendoza', 'sierras'));

-- 2) Los servicios (ids 28 a 45)
insert into public.servicios
  (id, nombre, tipo, region, lugar, precio_usd, unidad, detalle, hora_salida, proveedor)
values
  -- Alojamiento
  (28, 'Hostería de montaña',                                 'alojamiento', 'sierras', 'Villa General Belgrano, Córdoba', 85, 'noche, habitación doble', 'Con desayuno',                         null,    'T'),
  (29, 'Cabaña para 4 personas con parrilla',                 'alojamiento', 'sierras', 'Capilla del Monte, Córdoba',      95, 'noche, cabaña',           '2 ambientes, con parrilla',            null,    'U'),
  (30, 'Posada serrana',                                      'alojamiento', 'sierras', 'Merlo, San Luis',                 90, 'noche, habitación doble', 'Con desayuno',                         null,    'V'),
  (31, 'Refugio de montaña con cena y desayuno',              'alojamiento', 'sierras', 'Los Gigantes, Córdoba',           40, 'noche, persona',          'Cama en habitación compartida',        null,    'W'),
  -- Traslados
  (32, 'Traslado aeropuerto de Córdoba–Villa General Belgrano','traslado',   'sierras', 'Córdoba / Villa General Belgrano',90, 'tramo, vehículo',        '1 h y media',                          null,    'X'),
  (33, 'Traslado aeropuerto de Córdoba–Capilla del Monte',    'traslado',    'sierras', 'Córdoba / Capilla del Monte',    110, 'tramo, vehículo',         '2 h',                                  null,    'X'),
  (34, 'Traslado Córdoba–Merlo (San Luis)',                   'traslado',    'sierras', 'Córdoba / Merlo',                180, 'tramo, vehículo',         '4 h por Altas Cumbres',                null,    'X'),
  -- Trekking
  (35, 'Trekking al cerro Uritorco con guía',                 'actividad',   'sierras', 'Capilla del Monte, Córdoba',      35, 'persona',                 'Medio día, dificultad media',          '08:00', 'Y'),
  (36, 'Trekking Quebrada del Condorito, día completo',       'excursion',   'sierras', 'Parque Nacional Quebrada del Condorito, Córdoba', 55, 'persona', 'Día completo, con guía',              '08:30', 'Y'),
  (37, 'Travesía de 2 días al Champaquí con noche en refugio','excursion',   'sierras', 'Cerro Champaquí, Córdoba',       160, 'persona',                 '2 días; incluye noche en refugio y comidas', '07:00', 'Y'),
  (38, 'Caminata suave por La Cumbrecita',                    'actividad',   'sierras', 'La Cumbrecita, Córdoba',          30, 'persona',                 'Medio día, apta para todos',           '10:00', 'Z'),
  -- Avistaje de aves
  (39, 'Avistaje de cóndores en Pampa de Achala',             'actividad',   'sierras', 'Pampa de Achala, Córdoba',        45, 'persona',                 'Medio día con guía ornitólogo',        '07:30', 'AA'),
  (40, 'Avistaje de flamencos en Mar Chiquita',               'excursion',   'sierras', 'Mar Chiquita, Córdoba',           70, 'persona',                 'Día completo, con almuerzo',           '08:00', 'AA'),
  (41, 'Avistaje de aves serranas al atardecer',              'actividad',   'sierras', 'Merlo, San Luis',                 35, 'persona',                 '2 h con guía, binoculares incluidos',  '17:00', 'AA'),
  -- Otras excursiones y actividades
  (42, 'Cerveza artesanal y chocolates con almuerzo',         'actividad',   'sierras', 'Villa General Belgrano, Córdoba', 40, 'persona',                 'Degustación con almuerzo',             '12:30', 'AB'),
  (43, 'Camino de las Altas Cumbres y Mina Clavero',          'excursion',   'sierras', 'Mina Clavero, Córdoba',           50, 'persona',                 'Día completo',                         '09:00', 'AB'),
  (44, 'Cabalgata por las sierras',                           'actividad',   'sierras', 'Capilla del Monte, Córdoba',      35, 'persona',                 'Medio día',                            '15:00', 'AC'),
  (45, 'Circuito Mirador del Sol y Carpintería',              'excursion',   'sierras', 'Merlo, San Luis',                 30, 'persona',                 'Medio día',                            '10:00', 'AC')
on conflict (id) do update set
  nombre = excluded.nombre, tipo = excluded.tipo, region = excluded.region,
  lugar = excluded.lugar, precio_usd = excluded.precio_usd, unidad = excluded.unidad,
  detalle = excluded.detalle, hora_salida = excluded.hora_salida,
  proveedor = excluded.proveedor;

-- Control: debería mostrar mendoza 12, norte 15 y sierras 18 (45 en total)
select region, count(*) as servicios from public.servicios group by region order by region;
