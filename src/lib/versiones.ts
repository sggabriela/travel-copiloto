import type { SupabaseClient } from "@supabase/supabase-js";
import type { Ficha } from "./ia/ficha";
import { armarItinerario, type Itinerario } from "./ia/itinerario";
import { cargarCatalogo } from "./catalogo";
import { compararVersiones, type ResumenCambios } from "./cambios";

// Versiones de itinerario de una consulta. Recibe el cliente de Supabase con la sesión
// del asesor (o del usuario de prueba en los scripts): la RLS limita todo a sus consultas.

export type VersionItinerario = {
  version: number;
  ajuste: string | null;
  itinerario: Itinerario;
  ms: number | null;
  /** Cambios respecto de la versión anterior (null en la versión 1). */
  cambios: ResumenCambios | null;
};

export class ErrorVersion extends Error {}

/** Arma una versión nueva (primera propuesta, rearmado o ajuste), la guarda y registra lo no cubierto. */
export async function crearVersion(
  supabase: SupabaseClient,
  entrada: { consultaId: string; conversacion: string; ficha: Ficha; ajuste: string | null },
): Promise<VersionItinerario> {
  const { consultaId, conversacion, ficha, ajuste } = entrada;
  const { data: ultima } = await supabase
    .from("itinerarios")
    .select("version, contenido")
    .eq("consulta_id", consultaId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const anterior = (ultima?.contenido as Itinerario | undefined) ?? undefined;
  if (ajuste && !anterior) throw new ErrorVersion("Primero armá el itinerario.");

  const catalogo = await cargarCatalogo(supabase);
  const { itinerario, ms, modelo } = await armarItinerario({
    conversacion,
    ficha,
    catalogo,
    anterior: ajuste ? anterior : undefined,
    ajuste: ajuste ?? undefined,
  });

  const version = (ultima?.version ?? 0) + 1;
  const { error } = await supabase
    .from("itinerarios")
    .insert({ consulta_id: consultaId, version, ajuste, contenido: itinerario, modelo, duracion_ms: ms });
  if (error) {
    console.error("No se pudo guardar el itinerario:", error.message);
    throw new ErrorVersion("El itinerario se armó pero no se pudo guardar. Probá de nuevo.");
  }
  await registrarPedidos(supabase, consultaId, ficha, itinerario);
  return { version, ajuste, itinerario, ms, cambios: anterior ? compararVersiones(anterior, itinerario) : null };
}

/** Todas las versiones de una consulta, de la más nueva a la más vieja, con sus cambios. */
export async function listarVersiones(supabase: SupabaseClient, consultaId: string): Promise<VersionItinerario[]> {
  const { data } = await supabase
    .from("itinerarios")
    .select("version, ajuste, contenido, duracion_ms")
    .eq("consulta_id", consultaId)
    .order("version", { ascending: true });
  const filas = data ?? [];
  return filas
    .map((f, k) => ({
      version: f.version as number,
      ajuste: f.ajuste as string | null,
      itinerario: f.contenido as Itinerario,
      ms: f.duracion_ms as number | null,
      cambios: k > 0 ? compararVersiones(filas[k - 1].contenido as Itinerario, f.contenido as Itinerario) : null,
    }))
    .reverse();
}

/** Registra lo que no se pudo cubrir, sin repetir pedidos ya anotados para esta consulta. */
export async function registrarPedidos(
  supabase: SupabaseClient,
  consultaId: string,
  ficha: Ficha,
  itinerario: Itinerario,
): Promise<number> {
  if (itinerario.no_cubierto.length === 0) return 0;
  const { data: existentes } = await supabase.from("pedidos_sin_cubrir").select("pedido").eq("consulta_id", consultaId);
  const ya = new Set((existentes ?? []).map((p) => String(p.pedido).trim().toLowerCase()));
  const nuevos = itinerario.no_cubierto.filter((p) => !ya.has(p.pedido.trim().toLowerCase()));
  if (nuevos.length === 0) return 0;
  const { error } = await supabase.from("pedidos_sin_cubrir").insert(
    nuevos.map((p) => ({ consulta_id: consultaId, pedido: p.pedido, motivo: p.motivo, destino: ficha.destino })),
  );
  if (error) {
    console.error("No se pudieron registrar los pedidos sin cubrir:", error.message);
    return 0;
  }
  return nuevos.length;
}
