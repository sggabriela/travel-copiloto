import type { Itinerario } from "./ia/itinerario";

// Resumen de cambios entre dos versiones de un itinerario.
// Lo calcula la app comparando los servicios guardados: no depende de la IA.

export type CambioServicio = {
  servicio_id: number;
  nombre: string;
  /** Cantidad total de unidades en cada versión (personas, noches×habitaciones, tramos). */
  antes: number;
  despues: number;
  diferencia_usd: number;
};

export type ResumenCambios = {
  agregados: CambioServicio[];
  quitados: CambioServicio[];
  modificados: CambioServicio[];
  dias_antes: number;
  dias_despues: number;
  total_antes: number;
  total_despues: number;
  diferencia_usd: number;
  sin_cambios: boolean;
};

const redondear = (n: number) => Math.round(n * 100) / 100;

function agrupar(it: Itinerario) {
  const m = new Map<number, { nombre: string; cantidad: number; subtotal: number }>();
  for (const i of it.dias.flatMap((d) => d.items)) {
    const previo = m.get(i.servicio_id) ?? { nombre: i.nombre, cantidad: 0, subtotal: 0 };
    previo.cantidad += i.cantidad;
    previo.subtotal += i.subtotal_usd;
    m.set(i.servicio_id, previo);
  }
  return m;
}

export function compararVersiones(antes: Itinerario, despues: Itinerario): ResumenCambios {
  const a = agrupar(antes);
  const d = agrupar(despues);
  const agregados: CambioServicio[] = [];
  const quitados: CambioServicio[] = [];
  const modificados: CambioServicio[] = [];

  for (const id of new Set([...a.keys(), ...d.keys()])) {
    const x = a.get(id);
    const y = d.get(id);
    const cambio: CambioServicio = {
      servicio_id: id,
      nombre: (y ?? x)!.nombre,
      antes: x?.cantidad ?? 0,
      despues: y?.cantidad ?? 0,
      diferencia_usd: redondear((y?.subtotal ?? 0) - (x?.subtotal ?? 0)),
    };
    if (!x) agregados.push(cambio);
    else if (!y) quitados.push(cambio);
    else if (x.cantidad !== y.cantidad || Math.abs(cambio.diferencia_usd) >= 0.01) modificados.push(cambio);
  }
  const porId = (p: CambioServicio, q: CambioServicio) => p.servicio_id - q.servicio_id;
  agregados.sort(porId);
  quitados.sort(porId);
  modificados.sort(porId);

  const diferencia = redondear(despues.total_usd - antes.total_usd);
  return {
    agregados,
    quitados,
    modificados,
    dias_antes: antes.dias.length,
    dias_despues: despues.dias.length,
    total_antes: antes.total_usd,
    total_despues: despues.total_usd,
    diferencia_usd: diferencia,
    sin_cambios:
      !agregados.length && !quitados.length && !modificados.length && antes.dias.length === despues.dias.length,
  };
}
