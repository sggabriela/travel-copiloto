// Pruebas de la etapa 5: ficha del viajero con Claude Haiku 5.5.
// Uso: npm run probar:ficha   (llama a la API de Claude: cuesta unos centavos)
import { armarFicha, FichaSchema, type Ficha } from "../src/lib/ia/ficha";
import { EJEMPLOS } from "../src/app/copiloto/ejemplos";

const LIMITE_MS = 15000;
const casos = [
  { nombre: "Caso pareja al norte", texto: EJEMPLOS[0].texto },
  { nombre: "Caso grupo de amigas a Mendoza", texto: EJEMPLOS[1].texto },
  { nombre: "Consulta incompleta", texto: "Cliente C: Hola, quiero viajar en invierno, ¿qué tienen?" },
];

const tiene = (lista: string[], ...palabras: string[]) =>
  lista.some((x) => palabras.some((p) => x.toLowerCase().includes(p)));

const chequeos: Record<string, (f: Ficha) => string[]> = {
  "Caso pareja al norte": (f) => [
    f.personas === 2 ? "" : `personas=${f.personas}`,
    f.region === "norte" ? "" : `region=${f.region}`,
    tiene(f.intereses, "vino") ? "" : "falta interés vino",
    tiene(f.restricciones, "madrug", "temprano") ? "" : "falta 'no madrugar'",
    f.presupuesto === null ? "" : `inventó presupuesto: ${f.presupuesto}`,
    tiene(f.faltantes, "presupuesto") ? "" : "no marcó presupuesto como faltante",
  ],
  "Caso grupo de amigas a Mendoza": (f) => [
    f.personas === 6 ? "" : `personas=${f.personas}`,
    f.region === "mendoza" ? "" : `region=${f.region}`,
    f.duracion_dias === 4 ? "" : `días=${f.duracion_dias}`,
    f.presupuesto?.includes("900") ? "" : `presupuesto=${f.presupuesto}`,
    tiene(f.intereses, "bodega", "vino") ? "" : "falta interés bodegas",
  ],
  "Consulta incompleta": (f) => [
    f.personas === null ? "" : `inventó personas: ${f.personas}`,
    f.presupuesto === null ? "" : `inventó presupuesto: ${f.presupuesto}`,
    f.duracion_dias === null ? "" : `inventó días: ${f.duracion_dias}`,
    ["sin_definir", "otra"].includes(f.region) ? "" : `inventó región: ${f.region}`,
    f.faltantes.length >= 2 ? "" : "marcó pocos faltantes",
  ],
};

let fallas = 0;
const registrar = (prueba: string, ok: boolean, detalle: string) => {
  if (!ok) fallas++;
  console.log(`${ok ? "PASÓ " : "FALLÓ"} · ${prueba} · ${detalle}`);
};

const tiempos: number[] = [];
let formatosOk = 0;
for (const caso of casos) {
  try {
    const { ficha, ms, modelo } = await armarFicha(caso.texto);
    tiempos.push(ms);
    if (FichaSchema.safeParse(ficha).success) formatosOk++;
    const problemas = chequeos[caso.nombre](ficha).filter(Boolean);
    registrar(
      caso.nombre,
      problemas.length === 0,
      problemas.length ? problemas.join("; ") : `${modelo} · ${(ms / 1000).toFixed(1)} s · ${ficha.resumen}`,
    );
  } catch (e) {
    registrar(caso.nombre, false, e instanceof Error ? e.message : String(e));
  }
}
registrar("Formato siempre válido", formatosOk === casos.length, `${formatosOk}/${casos.length} respuestas cumplen el esquema`);
const maximo = tiempos.length ? Math.max(...tiempos) : Infinity;
registrar(
  "La ficha tarda menos de 15 segundos",
  tiempos.length === casos.length && maximo < LIMITE_MS,
  `tiempos: ${tiempos.map((t) => (t / 1000).toFixed(1) + " s").join(", ")}`,
);

console.log(`\n${5 - fallas}/5 pruebas pasaron`);
process.exit(fallas ? 1 : 0);
