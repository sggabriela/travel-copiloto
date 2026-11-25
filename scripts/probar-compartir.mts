// Pruebas de la etapa 13: link para el cliente (sin llamar a la IA, no cuesta nada).
// Uso: npm run probar:compartir   (necesita haber corrido supabase/06_compartir.sql)
// Crea una consulta e itinerario de prueba con textos "SECRETO-…" para comprobar que no se filtran, y los borra al final.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const clave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const opciones = { auth: { persistSession: false, autoRefreshToken: false } };
const asesor = createClient(url, clave, opciones);
const visitante = createClient(url, clave, opciones); // sin sesión

const { error: errLogin } = await asesor.auth.signInWithPassword({ email: process.env.PRUEBA_EMAIL!, password: process.env.PRUEBA_PASSWORD! });
if (errLogin) {
  console.error("No se pudo entrar con el usuario de prueba:", errLogin.message);
  process.exit(2);
}

let fallas = 0;
const registrar = (prueba: string, ok: boolean, detalle: string) => {
  if (!ok) fallas++;
  console.log(`${ok ? "PASÓ " : "FALLÓ"} · ${prueba} · ${detalle}`);
};

const contenido = {
  titulo: "Prueba de link", resumen: "Resumen de prueba", total_usd: 300, por_persona_usd: 150,
  dias: [{ numero: 1, titulo: "Llegada", lugar: "Salta", libre: null, items: [
    { servicio_id: 1, nombre: "Traslado de prueba", tipo: "traslado", lugar: "Salta", hora: "10:00", cantidad: 2, unidad: "persona", precio_usd: 150, subtotal_usd: 300, nota: "SECRETO-NOTA-ITEM" },
  ] }],
  no_cubierto: [{ pedido: "SECRETO-PEDIDO", motivo: "x" }],
  notas_para_asesor: ["SECRETO-NOTA-ASESOR"],
  descartados: [],
};

let consultaId: string | null = null;
try {
  const { data: c, error: e1 } = await asesor.from("consultas").insert({ conversacion: "SECRETO-CONVERSACION", ficha: { destino: "SECRETO-FICHA" } }).select("id").single();
  if (e1 || !c) throw new Error(`consulta: ${e1?.message}`);
  consultaId = c.id;
  const { data: it, error: e2 } = await asesor.from("itinerarios").insert({ consulta_id: consultaId, version: 1, contenido }).select("id").single();
  if (e2 || !it) throw new Error(`itinerario: ${e2?.message}`);
  const { data: l, error: e3 } = await asesor.from("compartidos").insert({ itinerario_id: it.id }).select("codigo, valido_hasta, vence_at").single();
  if (e3 || !l) throw new Error(`compartido: ${e3?.message}`);

  // p1: el visitante sin sesión ve el itinerario
  const { data: pub } = await visitante.rpc("ver_compartido", { p_codigo: l.codigo });
  const item = pub?.dias?.[0]?.items?.[0];
  registrar("p1 el visitante ve el itinerario", pub?.titulo === "Prueba de link" && pub?.total_usd === 300 && item?.nombre === "Traslado de prueba" && item?.precio_usd === 150 && item?.subtotal_usd === 300,
    `título "${pub?.titulo}", total ${pub?.total_usd}, ítem ${item?.nombre} ${item?.precio_usd}/${item?.subtotal_usd}`);

  // p3: no se filtra nada interno
  const texto = JSON.stringify(pub);
  const filtrados = ["SECRETO", "notas_para_asesor", "no_cubierto", "proveedor", "conversacion", "ficha", "descartados", "nota"].filter((t) => texto.includes(t));
  registrar("p3 no se filtran notas, conversación, ficha ni proveedores", filtrados.length === 0, filtrados.length ? `aparece: ${filtrados.join(", ")}` : `campos: ${Object.keys(pub).join(", ")}`);

  // presupuesto válido 48 h
  const horas = (new Date(l.valido_hasta).getTime() - Date.now()) / 3600000;
  registrar("presupuesto válido ~48 h", horas > 47.9 && horas <= 48, `${horas.toFixed(2)} h`);
  const dias = (new Date(l.vence_at).getTime() - Date.now()) / 86400000;
  registrar("el link vence en ~30 días", dias > 29.9 && dias <= 30, `${dias.toFixed(2)} días`);

  // p2: códigos que no existen
  const casos: [string, string][] = [["inexistente", "0".repeat(32)], ["formato raro", "' or 1=1 --"], ["vacío", ""]];
  for (const [nombre, codigo] of casos) {
    const { data, error } = await visitante.rpc("ver_compartido", { p_codigo: codigo });
    registrar(`p2 código ${nombre} no muestra nada`, data === null && !error, `data=${JSON.stringify(data)}${error ? " error=" + error.message : ""}`);
  }

  // p4: el visitante no toca las tablas
  const lectura = await visitante.from("compartidos").select("codigo");
  registrar("p4 el visitante no puede leer compartidos", !!lectura.error || (lectura.data?.length ?? 0) === 0, lectura.error ? lectura.error.message : `${lectura.data?.length} filas`);
  const escritura = await visitante.from("compartidos").insert({ itinerario_id: it.id });
  registrar("p4 el visitante no puede crear links", !!escritura.error, escritura.error?.message ?? "se creó (mal)");
  const lecIt = await visitante.from("itinerarios").select("id");
  registrar("p4 el visitante no puede leer itinerarios", !!lecIt.error || (lecIt.data?.length ?? 0) === 0, lecIt.error ? lecIt.error.message : `${lecIt.data?.length} filas`);

  // el asesor no puede alargar el link ni el presupuesto
  const alargar = await asesor.from("compartidos").update({ vence_at: "2099-01-01", valido_hasta: "2099-01-01" }).eq("codigo", l.codigo);
  registrar("el asesor no puede cambiar vencimientos", !!alargar.error, alargar.error?.message ?? "cambió (mal)");

  // p2: revocado
  const rev = await asesor.from("compartidos").update({ revocado_at: new Date().toISOString() }).eq("codigo", l.codigo).select("id");
  const { data: tras } = await visitante.rpc("ver_compartido", { p_codigo: l.codigo });
  registrar("p2 un link revocado no muestra nada", (rev.data?.length ?? 0) === 1 && tras === null, `revocado=${rev.data?.length}, después=${JSON.stringify(tras)}`);
} finally {
  if (consultaId) await asesor.from("consultas").delete().eq("id", consultaId);
}
console.log(fallas ? `\n${fallas} prueba(s) fallaron.` : "\nTodas las pruebas pasaron.");
process.exit(fallas ? 1 : 0);
