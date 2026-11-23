// Pruebas de la etapa 7: ajustes del asesor, pedidos sin cubrir, versiones y resumen de cambios.
// Uso: npm run probar:ajustes   (llama a la API de Claude: cuesta algunos centavos)
// Usa el mismo código que la app (crearVersion) con la sesión del usuario de prueba, y borra lo que crea.
import { createClient } from "@supabase/supabase-js";
import { armarFicha } from "../src/lib/ia/ficha";
import { cargarCatalogo } from "../src/lib/catalogo";
import { compararVersiones } from "../src/lib/cambios";
import { crearVersion, listarVersiones, registrarPedidos } from "../src/lib/versiones";
import type { Itinerario } from "../src/lib/ia/itinerario";
import { EJEMPLOS } from "../src/app/copiloto/ejemplos";

const LIMITE_MS = 60000;
const AJUSTE_MZA = "Sacá el rafting y poné la bici por bodegas en su lugar";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { error: errLogin } = await supabase.auth.signInWithPassword({ email: process.env.PRUEBA_EMAIL!, password: process.env.PRUEBA_PASSWORD! });
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
const ids = (it: Itinerario) => it.dias.flatMap((d) => d.items.map((i) => i.servicio_id));
const mostrar = (titulo: string, it: Itinerario) => {
  console.log(`\n— ${titulo}: ${it.titulo} · USD ${it.total_usd}`);
  for (const d of it.dias) console.log(`  Día ${d.numero} · ${d.titulo}: ${d.items.map((i) => `#${i.servicio_id}`).join(" ")}`);
  if (it.no_cubierto.length) console.log(`  No cubierto: ${it.no_cubierto.map((p) => `${p.pedido} (${p.motivo})`).join(" | ")}`);
};

const creadas: string[] = [];
async function nuevaConsulta(texto: string) {
  const { ficha } = await armarFicha(texto);
  const { data, error } = await supabase.from("consultas").insert({ conversacion: texto, ficha }).select("id").single();
  if (error) throw new Error(error.message);
  creadas.push(data.id);
  return { consultaId: data.id as string, conversacion: texto, ficha };
}

const tiempos: number[] = [];
try {
  // Norte: pedir algo que no está en la base
  const norte = await nuevaConsulta(EJEMPLOS[0].texto);
  const n1 = await crearVersion(supabase, { ...norte, ajuste: null });
  mostrar("Norte v1", n1.itinerario);
  const n2 = await crearVersion(supabase, { ...norte, ajuste: "Agregá un día en Tilcara" });
  tiempos.push(n2.ms!);
  mostrar("Norte v2 (Tilcara)", n2.itinerario);
  console.log(`  Notas: ${n2.itinerario.notas_para_asesor.join(" | ")}`);

  const avisoTilcara = n2.itinerario.no_cubierto.some((p) => /tilcara/i.test(p.pedido + p.motivo));
  const inventados = ids(n2.itinerario).filter((id) => !porId.has(id) || porId.get(id)!.region !== "norte");
  registrar(
    "'Agregá un día en Tilcara' no inventa",
    avisoTilcara && inventados.length === 0 && n2.itinerario.descartados.length === 0,
    `avisa: ${avisoTilcara ? "sí" : "no"} · servicios fuera de la base o de la región: ${inventados.join(", ") || "ninguno"} · descartados por el control: ${n2.itinerario.descartados.length}`,
  );

  const { data: pedidos } = await supabase.from("pedidos_sin_cubrir").select("pedido, motivo, destino, consulta_id").eq("consulta_id", norte.consultaId);
  const filaTilcara = (pedidos ?? []).filter((p) => /tilcara/i.test(p.pedido + p.motivo));
  const repetidos = await registrarPedidos(supabase, norte.consultaId, norte.ficha, n2.itinerario);
  registrar(
    "El pedido de Tilcara queda registrado (sin duplicarse)",
    filaTilcara.length === 1 && repetidos === 0,
    filaTilcara.length ? `"${filaTilcara[0].pedido}" · destino ${filaTilcara[0].destino} · consulta de origen ok · al volver a registrarlo agregó ${repetidos}` : `filas: ${JSON.stringify(pedidos)}`,
  );

  // Mendoza: un cambio posible
  const mza = await nuevaConsulta(EJEMPLOS[1].texto);
  const m1 = await crearVersion(supabase, { ...mza, ajuste: null });
  mostrar("Mendoza v1", m1.itinerario);
  const m2 = await crearVersion(supabase, { ...mza, ajuste: AJUSTE_MZA });
  tiempos.push(m2.ms!);
  mostrar("Mendoza v2 (rafting → bici)", m2.itinerario);
  console.log(`  Notas: ${m2.itinerario.notas_para_asesor.join(" | ")}`);
  const tenia = ids(m1.itinerario).includes(25);
  registrar(
    "Un cambio posible se aplica",
    tenia && !ids(m2.itinerario).includes(25) && ids(m2.itinerario).includes(23),
    `v1 con rafting: ${tenia ? "sí" : "no"} · v2 con rafting: ${ids(m2.itinerario).includes(25) ? "sí" : "no"} · v2 con bici: ${ids(m2.itinerario).includes(23) ? "sí" : "no"}`,
  );

  // Versiones
  const versiones = await listarVersiones(supabase, mza.consultaId);
  const v1Guardada = versiones.find((v) => v.version === 1);
  registrar(
    "La versión anterior se conserva",
    versiones.length === 2 && versiones[0].version === 2 && v1Guardada?.itinerario.total_usd === m1.itinerario.total_usd && ids(v1Guardada!.itinerario).join() === ids(m1.itinerario).join() && v1Guardada?.itinerario.titulo === m1.itinerario.titulo && versiones[0].ajuste === AJUSTE_MZA,
    versiones.map((v) => `v${v.version}: USD ${v.itinerario.total_usd}${v.ajuste ? ` (${v.ajuste})` : ""}`).join(" · "),
  );

  // Resumen de cambios
  const c = m2.cambios!;
  const cuentaOk = Math.abs(c.diferencia_usd - (m2.itinerario.total_usd - m1.itinerario.total_usd)) < 0.01;
  const sumaOk = Math.abs([...c.agregados, ...c.quitados, ...c.modificados].reduce((s, x) => s + x.diferencia_usd, 0) - c.diferencia_usd) < 0.01;
  const igual = compararVersiones(m1.itinerario, m1.itinerario);
  registrar(
    "El resumen de cambios es correcto",
    c.quitados.some((q) => q.servicio_id === 25) && c.agregados.some((q) => q.servicio_id === 23) && cuentaOk && sumaOk && igual.sin_cambios && igual.diferencia_usd === 0,
    `quitados: ${c.quitados.map((q) => `${q.nombre} ${q.diferencia_usd}`).join(", ") || "—"} · agregados: ${c.agregados.map((q) => `${q.nombre} +${q.diferencia_usd}`).join(", ") || "—"} · cantidades: ${c.modificados.map((q) => `${q.nombre} ${q.antes}→${q.despues}`).join(", ") || "—"} · total ${c.total_antes} → ${c.total_despues} (${c.diferencia_usd}) · las partes suman el total: ${sumaOk ? "sí" : "no"}`,
  );

  registrar("Cada ajuste tarda menos de 1 minuto", tiempos.every((t) => t < LIMITE_MS), tiempos.map((t) => `${(t / 1000).toFixed(1)} s`).join(", "));
} catch (e) {
  registrar("Ejecución", false, e instanceof Error ? e.message : String(e));
} finally {
  for (const id of creadas) await supabase.from("consultas").delete().eq("id", id);
  await supabase.from("pedidos_sin_cubrir").delete().is("consulta_id", null).eq("creado_por", (await supabase.auth.getUser()).data.user!.id);
  console.log(`\n(Se borraron las ${creadas.length} consultas de prueba y sus pedidos.)`);
}

console.log(`\n${total - fallas}/${total} pruebas pasaron`);
process.exit(fallas ? 1 : 0);
