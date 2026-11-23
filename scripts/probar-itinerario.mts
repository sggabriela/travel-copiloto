// Pruebas de la etapa 6: itinerario sugerido con Claude Opus 5.5.
// Uso: npm run probar:itinerario   (llama a la API de Claude: cuesta algunos centavos)
import { createClient } from "@supabase/supabase-js";
import { armarFicha } from "../src/lib/ia/ficha";
import { pedirItinerario, controlarItinerario, type ItinerarioIA } from "../src/lib/ia/itinerario";
import { cargarCatalogo } from "../src/lib/catalogo";
import { EJEMPLOS } from "../src/app/copiloto/ejemplos";

const LIMITE_MS = 60000;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { error: errLogin } = await supabase.auth.signInWithPassword({
  email: process.env.PRUEBA_EMAIL!,
  password: process.env.PRUEBA_PASSWORD!,
});
if (errLogin) {
  console.error("No se pudo entrar con el usuario de prueba:", errLogin.message);
  process.exit(2);
}
const catalogo = await cargarCatalogo(supabase);
const porId = new Map(catalogo.map((s) => [s.id, s]));

let fallas = 0;
let total = 0;
const registrar = (prueba: string, ok: boolean, detalle: string) => {
  total++;
  if (!ok) fallas++;
  console.log(`${ok ? "PASÓ " : "FALLÓ"} · ${prueba} · ${detalle}`);
};
const ids = (ia: ItinerarioIA) => ia.dias.flatMap((d) => d.items.map((i) => i.servicio_id));

const resultados = [];
for (const ej of EJEMPLOS) {
  const f = await armarFicha(ej.texto);
  const r = await pedirItinerario({ conversacion: ej.texto, ficha: f.ficha, catalogo });
  const it = controlarItinerario(r.itinerario, catalogo, f.ficha);
  resultados.push({ ej, f, r, it });
  console.log(`\n— ${ej.nombre}: ${it.titulo} (${r.modelo}, ficha ${(f.ms / 1000).toFixed(1)} s + itinerario ${(r.ms / 1000).toFixed(1)} s)`);
  for (const d of it.dias) {
    console.log(`  Día ${d.numero} · ${d.titulo}: ` + d.items.map((i) => `${i.hora ?? "--:--"} #${i.servicio_id} ${i.nombre} x${i.cantidad} = ${i.subtotal_usd}`).join(" / ") + (d.libre ? ` / libre: ${d.libre}` : ""));
  }
  console.log(`  Total USD ${it.total_usd} · por persona ${it.por_persona_usd} · no cubierto: ${JSON.stringify(it.no_cubierto)}`);
  console.log(`  Notas: ${it.notas_para_asesor.join(" | ")}\n`);
}
const [norte, mendoza] = resultados;

// 1 · Todos los servicios existen en la base
const inexistentes = resultados.flatMap((x) => ids(x.r.itinerario).filter((id) => !porId.has(id)));
registrar("Todos los servicios existen en la base", inexistentes.length === 0, inexistentes.length ? `inventados: ${inexistentes.join(", ")}` : `${resultados.reduce((n, x) => n + ids(x.r.itinerario).length, 0)} servicios usados, todos reales`);

// 2 · Respeta "no madrugar" (pareja al norte)
const idsNorte = ids(norte.r.itinerario);
const tempranos = norte.it.dias.flatMap((d) => d.items).filter((i) => i.hora && i.hora < "09:00");
registrar(
  "Respeta 'no madrugar'",
  !idsNorte.includes(8) && tempranos.length === 0 && idsNorte.includes(9),
  `usa #9: ${idsNorte.includes(9) ? "sí" : "no"} · usa #8: ${idsNorte.includes(8) ? "sí" : "no"} · antes de las 9: ${tempranos.map((i) => `#${i.servicio_id} ${i.hora}`).join(", ") || "ninguno"}`,
);

// 3 · Mendoza usa solo servicios de Mendoza
const fueraDeMendoza = ids(mendoza.r.itinerario).filter((id) => porId.get(id)?.region !== "mendoza");
registrar("Mendoza usa solo servicios de Mendoza", fueraDeMendoza.length === 0 && ids(mendoza.r.itinerario).length > 0, fueraDeMendoza.length ? `de otra región: ${fueraDeMendoza.join(", ")}` : `${ids(mendoza.r.itinerario).length} servicios, todos de Mendoza`);

// 4 · El total coincide con la suma de los precios de la base
const recalculos = resultados.map((x) => x.it.dias.flatMap((d) => d.items).reduce((s, i) => s + porId.get(i.servicio_id)!.precio_usd * i.cantidad, 0));
registrar("El total coincide con la suma", resultados.every((x, k) => Math.abs(x.it.total_usd - recalculos[k]) < 0.01), resultados.map((x, k) => `USD ${x.it.total_usd} = ${recalculos[k]}`).join(" · "));

// 5 · El doble control descarta un id inventado y uno de otra región
const trucho: ItinerarioIA = structuredClone(mendoza.r.itinerario);
trucho.dias[0].items.push({ servicio_id: 999, hora: "12:00", cantidad: 6, nota: null }, { servicio_id: 15, hora: "07:00", cantidad: 6, nota: null });
const controlado = controlarItinerario(trucho, catalogo, mendoza.f.ficha);
const quedaron = controlado.dias.flatMap((d) => d.items.map((i) => i.servicio_id));
registrar("El doble control descarta lo que no corresponde", !quedaron.includes(999) && !quedaron.includes(15) && controlado.descartados.length === 2, controlado.descartados.map((d) => `#${d.servicio_id} ${d.motivo}`).join(" · "));

// 6 · Se guarda como versión 1
const { data: consulta, error: e1 } = await supabase.from("consultas").insert({ conversacion: "[prueba etapa 6]", ficha: mendoza.f.ficha }).select("id").single();
const { data: guardado, error: e2 } = consulta
  ? await supabase.from("itinerarios").insert({ consulta_id: consulta.id, version: 1, contenido: mendoza.it, modelo: mendoza.r.modelo, duracion_ms: mendoza.r.ms }).select("version, contenido").single()
  : { data: null, error: e1 };
if (consulta) await supabase.from("consultas").delete().eq("id", consulta.id);
registrar("Se guarda como versión 1", !!guardado && guardado.version === 1 && guardado.contenido.total_usd === mendoza.it.total_usd, guardado ? `versión ${guardado.version}, total USD ${guardado.contenido.total_usd} (y se borró la prueba)` : String((e1 ?? e2)?.message));

// 7 · De la consulta al itinerario en menos de 60 segundos
const tiempos = resultados.map((x) => x.f.ms + x.r.ms);
registrar("De la consulta al itinerario en menos de 60 s", tiempos.every((t) => t < LIMITE_MS), tiempos.map((t) => `${(t / 1000).toFixed(1)} s`).join(", "));

console.log(`\n${total - fallas}/${total} pruebas pasaron`);
process.exit(fallas ? 1 : 0);
