"use server";

import Anthropic from "@anthropic-ai/sdk";
import { crearClienteSupabase } from "@/lib/supabase/server";
import { usuarioActual } from "@/lib/auth";
import { armarFicha, ErrorFicha, FichaSchema, type Ficha } from "@/lib/ia/ficha";
import { armarItinerario, ErrorItinerario, type Itinerario } from "@/lib/ia/itinerario";
import { cargarCatalogo } from "@/lib/catalogo";

export type ResultadoFicha =
  | { ok: true; consultaId: string; ficha: Ficha; ms: number }
  | { ok: false; error: string };

function mensajeDeError(error: unknown): string {
  if (error instanceof ErrorFicha || error instanceof ErrorItinerario) return error.message;
  if (error instanceof Anthropic.AuthenticationError) {
    return "La clave de la IA no es válida. Avisale a quien administra la app.";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "La IA está recibiendo muchos pedidos. Esperá un minuto y probá de nuevo.";
  }
  if (error instanceof Anthropic.APIError) {
    return "La IA no respondió. Probá de nuevo en unos segundos.";
  }
  return "Algo salió mal. Probá de nuevo.";
}

/** Genera la ficha con IA y guarda la consulta. */
export async function generarFicha(conversacion: string): Promise<ResultadoFicha> {
  await usuarioActual();
  try {
    const { ficha, ms } = await armarFicha(conversacion);
    const supabase = await crearClienteSupabase();
    const { data, error } = await supabase
      .from("consultas")
      .insert({ conversacion: conversacion.trim(), ficha })
      .select("id")
      .single();
    if (error) {
      console.error("No se pudo guardar la consulta:", error.message);
      return { ok: false, error: "La ficha se generó pero no se pudo guardar. Probá de nuevo." };
    }
    return { ok: true, consultaId: data.id, ficha, ms };
  } catch (error) {
    console.error("generarFicha:", error);
    return { ok: false, error: mensajeDeError(error) };
  }
}

/** Guarda la ficha corregida por el asesor. */
export async function guardarFicha(
  consultaId: string,
  ficha: Ficha,
): Promise<{ ok: boolean; error?: string }> {
  await usuarioActual();
  const valida = FichaSchema.safeParse(ficha);
  if (!valida.success) return { ok: false, error: "Hay datos de la ficha con un formato inválido." };
  const supabase = await crearClienteSupabase();
  const { error } = await supabase.from("consultas").update({ ficha: valida.data }).eq("id", consultaId);
  if (error) return { ok: false, error: "No se pudieron guardar los cambios de la ficha." };
  return { ok: true };
}

export type ResultadoItinerario =
  | { ok: true; itinerario: Itinerario; version: number; ms: number; modelo: string }
  | { ok: false; error: string };

/**
 * Guarda la ficha (por si el asesor la corrigió), arma el itinerario con IA solo con
 * servicios de la base, lo guarda como nueva versión y registra lo que no se pudo cubrir.
 */
export async function generarItinerario(consultaId: string, ficha: Ficha): Promise<ResultadoItinerario> {
  await usuarioActual();
  const valida = FichaSchema.safeParse(ficha);
  if (!valida.success) return { ok: false, error: "Hay datos de la ficha con un formato inválido." };
  const supabase = await crearClienteSupabase();
  try {
    const { data: consulta, error: errConsulta } = await supabase
      .from("consultas")
      .update({ ficha: valida.data })
      .eq("id", consultaId)
      .select("conversacion")
      .single();
    if (errConsulta || !consulta) return { ok: false, error: "No se encontró la consulta. Generá la ficha de nuevo." };

    const catalogo = await cargarCatalogo(supabase);
    const { itinerario, ms, modelo } = await armarItinerario({
      conversacion: consulta.conversacion,
      ficha: valida.data,
      catalogo,
    });

    const { data: ultima } = await supabase
      .from("itinerarios")
      .select("version")
      .eq("consulta_id", consultaId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const version = (ultima?.version ?? 0) + 1;

    const { error: errGuardar } = await supabase
      .from("itinerarios")
      .insert({ consulta_id: consultaId, version, contenido: itinerario, modelo, duracion_ms: ms });
    if (errGuardar) {
      console.error("No se pudo guardar el itinerario:", errGuardar.message);
      return { ok: false, error: "El itinerario se armó pero no se pudo guardar. Probá de nuevo." };
    }
    await registrarPedidos(supabase, consultaId, valida.data, itinerario);
    return { ok: true, itinerario, version, ms, modelo };
  } catch (error) {
    console.error("generarItinerario:", error);
    return { ok: false, error: mensajeDeError(error) };
  }
}

async function registrarPedidos(
  supabase: Awaited<ReturnType<typeof crearClienteSupabase>>,
  consultaId: string,
  ficha: Ficha,
  itinerario: Itinerario,
) {
  if (itinerario.no_cubierto.length === 0) return;
  const { error } = await supabase.from("pedidos_sin_cubrir").insert(
    itinerario.no_cubierto.map((p) => ({
      consulta_id: consultaId,
      pedido: p.pedido,
      motivo: p.motivo,
      destino: ficha.destino,
    })),
  );
  if (error) console.error("No se pudieron registrar los pedidos sin cubrir:", error.message);
}
