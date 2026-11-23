"use server";

import Anthropic from "@anthropic-ai/sdk";
import { crearClienteSupabase } from "@/lib/supabase/server";
import { usuarioActual } from "@/lib/auth";
import { armarFicha, ErrorFicha, FichaSchema, type Ficha } from "@/lib/ia/ficha";

export type ResultadoFicha =
  | { ok: true; consultaId: string; ficha: Ficha; ms: number }
  | { ok: false; error: string };

function mensajeDeError(error: unknown): string {
  if (error instanceof ErrorFicha) return error.message;
  if (error instanceof Anthropic.AuthenticationError) {
    return "La clave de la IA no es válida. Avisale a quien administra la app.";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "La IA está recibiendo muchos pedidos. Esperá un minuto y probá de nuevo.";
  }
  if (error instanceof Anthropic.APIError) {
    return "La IA no respondió. Probá de nuevo en unos segundos.";
  }
  return "Algo salió mal al generar la ficha. Probá de nuevo.";
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
