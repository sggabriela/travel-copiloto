import type { SupabaseClient } from "@supabase/supabase-js";

// Catálogo de servicios: lo único que la IA puede usar para armar itinerarios.
export type Servicio = {
  id: number;
  nombre: string;
  tipo: "alojamiento" | "traslado" | "excursion" | "actividad";
  region: "norte" | "mendoza";
  lugar: string;
  precio_usd: number;
  unidad: string;
  detalle: string | null;
  hora_salida: string | null; // "HH:MM"
};

/** Lee los servicios activos (requiere sesión: la tabla tiene RLS). */
export async function cargarCatalogo(supabase: SupabaseClient): Promise<Servicio[]> {
  const { data, error } = await supabase
    .from("servicios")
    .select("id, nombre, tipo, region, lugar, precio_usd, unidad, detalle, hora_salida")
    .eq("activo", true)
    .order("id");
  if (error) throw new Error(`No se pudo leer el catálogo: ${error.message}`);
  return (data ?? []).map((s) => ({
    ...s,
    precio_usd: Number(s.precio_usd),
    hora_salida: s.hora_salida ? String(s.hora_salida).slice(0, 5) : null,
  })) as Servicio[];
}

/** Una línea por servicio, para pasarle el catálogo a la IA. */
export function catalogoComoTexto(servicios: Servicio[]): string {
  return servicios
    .map((s) =>
      [
        `#${s.id}`,
        s.tipo,
        s.region,
        s.lugar,
        s.nombre,
        `USD ${s.precio_usd} por ${s.unidad}`,
        s.hora_salida ? `sale ${s.hora_salida}` : null,
        s.detalle,
      ]
        .filter(Boolean)
        .join(" | "),
    )
    .join("\n");
}
