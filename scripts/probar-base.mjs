// Pruebas de la etapa 3: base de datos en Supabase.
// Uso: node --env-file=.env scripts/probar-base.mjs
// Necesita en .env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
// PRUEBA_EMAIL y PRUEBA_PASSWORD (el usuario de prueba).
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.PRUEBA_EMAIL;
const password = process.env.PRUEBA_PASSWORD;
if (!url || !key || !email || !password) {
  console.error("Faltan variables en .env (URL, clave publicable, PRUEBA_EMAIL o PRUEBA_PASSWORD).");
  process.exit(2);
}

const resultados = [];
const registrar = (prueba, ok, detalle) => {
  resultados.push({ prueba, ok, detalle });
  console.log(`${ok ? "PASÓ " : "FALLÓ"} · ${prueba} · ${detalle}`);
};
const opciones = { auth: { persistSession: false, autoRefreshToken: false } };

// P2 · Sin sesión no se ve nada
const anonimo = createClient(url, key, opciones);
const tablas = ["servicios", "consultas", "itinerarios", "pedidos_sin_cubrir"];
const vistas = [];
for (const t of tablas) {
  const { data, error } = await anonimo.from(t).select("*").limit(5);
  vistas.push(`${t}: ${error ? "bloqueada" : `${data.length} filas`}`);
  if (!error && data.length > 0) vistas.push("¡VISIBLE!");
}
registrar("Sin sesión no se ve nada", !vistas.some((v) => v.includes("VISIBLE")), vistas.join(", "));

// Con sesión
const cliente = createClient(url, key, opciones);
const { error: errLogin } = await cliente.auth.signInWithPassword({ email, password });
if (errLogin) {
  registrar("Login del usuario de prueba", false, errLogin.message);
  process.exit(1);
}

// P1 · Están los 45 servicios (15 del norte, 12 de Mendoza, 18 de las sierras)
const { data: servicios, error: errServ } = await cliente.from("servicios").select("*").order("id");
const norte = servicios?.filter((s) => s.region === "norte").length ?? 0;
const mendoza = servicios?.filter((s) => s.region === "mendoza").length ?? 0;
const sierras = servicios?.filter((s) => s.region === "sierras").length ?? 0;
registrar(
  "Están los 45 servicios",
  !errServ && servicios.length === 45 && norte === 15 && mendoza === 12 && sierras === 18,
  errServ ? errServ.message : `total ${servicios.length}, norte ${norte}, mendoza ${mendoza}, sierras ${sierras}`,
);

// P4 · Precios y horarios correctos (muestra)
const s8 = servicios?.find((s) => s.id === 8);
const s9 = servicios?.find((s) => s.id === 9);
const s22 = servicios?.find((s) => s.id === 22);
const s36 = servicios?.find((s) => s.id === 36);
const s41 = servicios?.find((s) => s.id === 41);
const muestraOk =
  s8?.hora_salida?.startsWith("07:00") && Number(s8?.precio_usd) === 60 &&
  s9?.hora_salida?.startsWith("09:30") && Number(s9?.precio_usd) === 75 &&
  Number(s22?.precio_usd) === 130 &&
  s36?.hora_salida?.startsWith("08:30") && Number(s36?.precio_usd) === 55 &&
  s41?.hora_salida?.startsWith("17:00") && Number(s41?.precio_usd) === 35 &&
  servicios.every((s) => Number(s.precio_usd) > 0);
registrar(
  "Precios y horarios correctos",
  Boolean(muestraOk),
  `#8 ${s8?.hora_salida} USD ${s8?.precio_usd} · #9 ${s9?.hora_salida} USD ${s9?.precio_usd} · #22 USD ${s22?.precio_usd} · #36 ${s36?.hora_salida} USD ${s36?.precio_usd} · #41 ${s41?.hora_salida} USD ${s41?.precio_usd}`,
);

// P3 · Con sesión se lee y se escribe (y se limpia al final)
let consultaId = null;
try {
  const { data: c, error: e1 } = await cliente
    .from("consultas").insert({ conversacion: "PRUEBA AUTOMÁTICA · cliente A quiere ir al norte" })
    .select().single();
  if (e1) throw new Error(`consulta: ${e1.message}`);
  consultaId = c.id;
  const { error: e2 } = await cliente.from("itinerarios")
    .insert({ consulta_id: c.id, version: 1, contenido: { dias: [] }, modelo: "prueba" });
  if (e2) throw new Error(`itinerario: ${e2.message}`);
  const { error: e3 } = await cliente.from("pedidos_sin_cubrir")
    .insert({ consulta_id: c.id, pedido: "PRUEBA · un día en Tilcara", destino: "Tilcara" });
  if (e3) throw new Error(`pedido: ${e3.message}`);
  const { data: leidos, error: e4 } = await cliente.from("itinerarios").select("version").eq("consulta_id", c.id);
  if (e4) throw new Error(`lectura: ${e4.message}`);
  const { error: e5 } = await cliente.from("servicios").update({ precio_usd: 1 }).eq("id", 1).select();
  const { data: s1 } = await cliente.from("servicios").select("precio_usd").eq("id", 1).single();
  const serviciosIntactos = Number(s1.precio_usd) === 90;
  registrar(
    "Con sesión se lee y se escribe",
    leidos.length === 1 && serviciosIntactos,
    `guardó consulta, itinerario y pedido; leyó ${leidos.length} versión; servicios ${serviciosIntactos ? "no modificables desde la app" : "¡MODIFICADOS!"}${e5 ? "" : ""}`,
  );
} catch (err) {
  registrar("Con sesión se lee y se escribe", false, err.message);
} finally {
  if (consultaId) {
    await cliente.from("pedidos_sin_cubrir").delete().eq("consulta_id", consultaId);
    await cliente.from("consultas").delete().eq("id", consultaId);
  }
  await cliente.auth.signOut();
}

const fallas = resultados.filter((r) => !r.ok).length;
console.log(`\n${resultados.length - fallas}/${resultados.length} pruebas pasaron`);
process.exit(fallas ? 1 : 0);
