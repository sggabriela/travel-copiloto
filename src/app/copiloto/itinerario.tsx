import type { Itinerario } from "@/lib/ia/itinerario";

const usd = (n: number) => `USD ${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
const ETIQUETA_TIPO: Record<string, string> = {
  alojamiento: "Alojamiento",
  traslado: "Traslado",
  excursion: "Excursión",
  actividad: "Actividad",
};

export function VistaItinerario({ itinerario }: { itinerario: Itinerario }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-zinc-900">{itinerario.titulo}</h3>
        <p className="text-sm text-zinc-700">{itinerario.resumen}</p>
      </div>

      {itinerario.no_cubierto.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-semibold">No está en la base (quedó registrado para hablar con proveedores):</p>
          <ul className="mt-1 list-disc pl-5">
            {itinerario.no_cubierto.map((p) => (
              <li key={p.pedido}>
                <span className="font-medium">{p.pedido}</span>: {p.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ol className="flex flex-col gap-3">
        {itinerario.dias.map((d) => (
          <li key={d.numero} className="rounded-lg border border-zinc-200">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-2">
              <p className="font-semibold text-zinc-900">
                Día {d.numero} · {d.titulo}
              </p>
              <p className="text-xs text-zinc-500">{d.lugar}</p>
            </div>
            <ul className="divide-y divide-zinc-100">
              {d.items.map((i, k) => (
                <li key={`${i.servicio_id}-${k}`} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-4 py-2 text-sm">
                  <span className="w-12 shrink-0 font-mono text-zinc-500">{i.hora ?? "—"}</span>
                  <div className="min-w-0 flex-[1_1_220px]">
                    <p className="text-zinc-900">
                      {i.nombre} <span className="text-xs text-zinc-500">#{i.servicio_id}</span>
                    </p>
                    <p className="text-xs text-zinc-500">
                      {ETIQUETA_TIPO[i.tipo]} · {i.lugar}
                      {i.nota ? ` · ${i.nota}` : ""}
                    </p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="font-medium text-zinc-900">{usd(i.subtotal_usd)}</p>
                    <p className="text-xs text-zinc-500">
                      {i.cantidad} × {usd(i.precio_usd)} ({i.unidad})
                    </p>
                  </div>
                </li>
              ))}
              {d.libre && <li className="px-4 py-2 text-sm italic text-zinc-600">{d.libre}</li>}
            </ul>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-baseline justify-end gap-x-6 gap-y-1 rounded-lg bg-teal-50 px-4 py-3 text-teal-950">
        {itinerario.por_persona_usd !== null && (
          <span className="text-sm">{usd(itinerario.por_persona_usd)} por persona</span>
        )}
        <span className="text-lg font-semibold">Total {usd(itinerario.total_usd)}</span>
      </div>
      <p className="text-xs text-zinc-500">Precios de la base de servicios, sin vuelos. El total lo calcula la app, no la IA.</p>

      {itinerario.notas_para_asesor.length > 0 && (
        <div className="rounded-lg bg-zinc-100 p-3 text-sm text-zinc-800">
          <p className="font-semibold">Para confirmar con el cliente</p>
          <ul className="mt-1 list-disc pl-5">
            {itinerario.notas_para_asesor.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      {itinerario.descartados.length > 0 && (
        <p className="text-xs text-zinc-500">
          Control automático: se descartaron {itinerario.descartados.length} servicio(s) que la IA propuso y no corresponden (
          {itinerario.descartados.map((d) => `#${d.servicio_id} ${d.motivo}`).join("; ")}).
        </p>
      )}
    </div>
  );
}
