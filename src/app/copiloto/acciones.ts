"use server";

import Anthropic from "@anthropic-ai/sdk";
import { crearClienteSupabase } from "@/lib/supabase/server";
import { usuarioActual } from "@/lib/auth";
import { armarFicha, ErrorFicha, FichaSchema, type Ficha } from "@/lib/ia/ficha";
import { ErrorItinerario } from "@/lib/ia/itinerario";
import { crearVersion, ErrorVersion, listarVersiones, type VersionItinerario } from "@/lib/versiones";

// Tope de tamaño para la ficha que manda el navegador (una ficha real ocupa ~1.000 caracteres).
const TAMANO_MAXIMO_FICHA = 6000;
function fichaValida(ficha: unknown) {
  const r = FichaSchema.safeParse(ficha);
  if (!r.success || JSON.stringify(r.data).length > TAMANO_MAXIMO_FICHA) return null;
  return r.data;
}

export type ResultadoFicha =
  | { ok: true; consultaId: string; ficha: Ficha; ms: number }
  | { ok: false; error: string };

function mensajeDeError(error: unknown): string {
  if (error instanceof ErrorFicha || error instanceof ErrorItinerario || error instanceof ErrorVersion) return error.message;
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
  const valida = fichaValida(ficha);
  if (!valida || typeof consultaId !== "string") return { ok: false, error: "Hay datos de la ficha con un formato inválido o muy largos." };
  const supabase = await crearClienteSupabase();
  const { error } = await supabase.from("consultas").update({ ficha: valida }).eq("id", consultaId);
  if (error) return { ok: false, error: "No se pudieron guardar los cambios de la ficha." };
  return { ok: true };
}

const LARGO_MAXIMO_AJUSTE = 1000;

export type { VersionItinerario };
export type ResultadoItinerario = { ok: true; nueva: VersionItinerario } | { ok: false; error: string };

/**
 * Guarda la ficha (por si el asesor la corrigió), arma el itinerario con IA solo con
 * servicios de la base, lo guarda como nueva versión y registra lo que no se pudo cubrir.
 */
export async function generarItinerario(consultaId: string, ficha: Ficha): Promise<ResultadoItinerario> {
  await usuarioActual();
  const valida = fichaValida(ficha);
  if (!valida || typeof consultaId !== "string") return { ok: false, error: "Hay datos de la ficha con un formato inválido o muy largos." };
  const supabase = await crearClienteSupabase();
  const { data: consulta, error } = await supabase
    .from("consultas")
    .update({ ficha: valida })
    .eq("id", consultaId)
    .select("conversacion")
    .single();
  if (error || !consulta) return { ok: false, error: "No se encontró la consulta. Generá la ficha de nuevo." };
  try {
    const nueva = await crearVersion(supabase, { consultaId, conversacion: consulta.conversacion, ficha: valida, ajuste: null });
    return { ok: true, nueva };
  } catch (e) {
    console.error("generarItinerario:", e);
    return { ok: false, error: mensajeDeError(e) };
  }
}

/** Aplica un ajuste pedido por el asesor sobre la última versión y guarda una versión nueva. */
export async function ajustarItinerario(consultaId: string, ajuste: string): Promise<ResultadoItinerario> {
  await usuarioActual();
  if (typeof ajuste !== "string" || typeof consultaId !== "string") return { ok: false, error: "Pedido inválido." };
  const texto = ajuste.trim();
  if (!texto) return { ok: false, error: "Escribí qué querés cambiar del itinerario." };
  if (texto.length > LARGO_MAXIMO_AJUSTE) return { ok: false, error: "El ajuste es muy largo. Resumilo en pocas líneas." };
  const supabase = await crearClienteSupabase();
  const { data: consulta, error } = await supabase.from("consultas").select("conversacion, ficha").eq("id", consultaId).single();
  if (error || !consulta) return { ok: false, error: "No se encontró la consulta." };
  const ficha = fichaValida(consulta.ficha);
  if (!ficha) return { ok: false, error: "La ficha guardada tiene un formato inválido. Generala de nuevo." };
  try {
    const nueva = await crearVersion(supabase, { consultaId, conversacion: consulta.conversacion, ficha, ajuste: texto });
    return { ok: true, nueva };
  } catch (e) {
    console.error("ajustarItinerario:", e);
    return { ok: false, error: mensajeDeError(e) };
  }
}

/** Versiones guardadas de una consulta (de la más nueva a la más vieja). */
export async function versionesDeConsulta(consultaId: string): Promise<VersionItinerario[]> {
  await usuarioActual();
  if (typeof consultaId !== "string") return [];
  try {
    return await listarVersiones(await crearClienteSupabase(), consultaId);
  } catch (e) {
    console.error("versionesDeConsulta:", e);
    return [];
  }
}
