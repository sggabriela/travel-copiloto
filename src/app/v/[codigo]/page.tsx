import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { leerCompartido } from "@/lib/compartir";
import { BotonImprimir } from "./imprimir";

// Página pública del cliente: sin login, sin buscadores, siempre al momento.
export const metadata: Metadata = {
  title: "Propuesta de viaje · Travel Experience",
  robots: { index: false, follow: false },
};

const usd = (n: number) => `USD ${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
const ETIQUETA_TIPO: Record<string, string> = {
  alojamiento: "Alojamiento",
  traslado: "Traslado",
  excursion: "Excursión",
  actividad: "Actividad",
};
const fechaLarga = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "full",
  timeStyle: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});

export default function PaginaCompartida({ params }: PageProps<"/v/[codigo]">) {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-sm font-bold text-white">TE</span>
          <span className="font-semibold text-zinc-900">Travel Experience</span>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
        <Suspense fallback={<p className="text-zinc-500">Cargando…</p>}>
          <Propuesta params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function Propuesta({ params }: { params: PageProps<"/v/[codigo]">["params"] }) {
  await connection();
  const { codigo } = await params;
  const it = await leerCompartido(codigo);

  if (!it) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <h1 className="text-lg font-semibold text-zinc-900">Este enlace no está disponible</h1>
        <p className="mt-1 text-sm text-zinc-600">Puede haber vencido o haber sido retirado. Escribile a tu asesor de Travel Experience para pedirle uno nuevo.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-zinc-900">{it.titulo}</h1>
          <p className="text-sm text-zinc-700">{it.resumen}</p>
        </div>
        <BotonImprimir />
      </div>

      {it.vigente ? (
        <p className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-950">
          <span className="font-semibold">Presupuesto válido hasta el {fechaLarga.format(new Date(it.valido_hasta))}</span> (hora de Argentina).
        </p>
      ) : (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <span className="font-semibold">Este presupuesto venció el {fechaLarga.format(new Date(it.valido_hasta))}.</span> Los precios pueden haber cambiado: consultá con tu asesor.
        </p>
      )}

      <ol className="flex flex-col gap-3">
        {it.dias.map((d) => (
          <li key={d.numero} className="rounded-lg border border-zinc-200 bg-white break-inside-avoid">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-2">
              <p className="font-semibold text-zinc-900">
                Día {d.numero} · {d.titulo}
              </p>
              <p className="text-xs text-zinc-500">{d.lugar}</p>
            </div>
            <ul className="divide-y divide-zinc-100">
              {d.items.map((i, k) => (
                <li key={k} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-4 py-2 text-sm">
                  <span className="w-12 shrink-0 font-mono text-zinc-500">{i.hora ?? "—"}</span>
                  <div className="min-w-0 flex-[1_1_220px]">
                    <p className="text-zinc-900">{i.nombre}</p>
                    <p className="text-xs text-zinc-500">
                      {ETIQUETA_TIPO[i.tipo] ?? i.tipo} · {i.lugar}
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
        {it.por_persona_usd !== null && <span className="text-sm">{usd(it.por_persona_usd)} por persona</span>}
        <span className="text-lg font-semibold">Total {usd(it.total_usd)}</span>
      </div>
      <p className="text-xs text-zinc-500">
        Propuesta sujeta a confirmación de tu asesor. Precios en dólares, sin vuelos.
      </p>
    </>
  );
}
