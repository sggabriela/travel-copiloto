import "server-only";
import { createClient } from "@supabase/supabase-js";

// Link para el cliente: una versión congelada de un itinerario, abierta sin login.
// La página pública no lee las tablas: llama a la función ver_compartido de la base,
// que devuelve solo los campos que puede ver el cliente.

export const FORMATO_CODIGO = /^[a-f0-9]{32}$/;

export type ItemPublico = {
  hora: string | null;
  nombre: string;
  tipo: string;
  lugar: string;
  cantidad: number;
  unidad: string;
  precio_usd: number;
  subtotal_usd: number;
};

export type ItinerarioPublico = {
  titulo: string;
  resumen: string;
  total_usd: number;
  por_persona_usd: number | null;
  valido_hasta: string;
  /** Lo calcula leerCompartido: false cuando pasaron las 48 horas del presupuesto. */
  vigente: boolean;
  dias: { numero: number; titulo: string; lugar: string; libre: string | null; items: ItemPublico[] }[];
};

/** Devuelve el itinerario para el cliente, o null si el código no existe, venció o fue revocado. */
export async function leerCompartido(codigo: string): Promise<ItinerarioPublico | null> {
  if (!FORMATO_CODIGO.test(codigo)) return null;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase.rpc("ver_compartido", { p_codigo: codigo });
  if (error) {
    console.error("leerCompartido:", error.message);
    return null;
  }
  if (!data) return null;
  const it = data as Omit<ItinerarioPublico, "vigente">;
  return { ...it, vigente: new Date(it.valido_hasta).getTime() > Date.now() };
}
