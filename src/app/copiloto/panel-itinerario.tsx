"use client";

import { useEffect, useState } from "react";
import type { ResumenCambios } from "@/lib/cambios";
import type { VersionItinerario } from "./acciones";
import { VistaItinerario } from "./itinerario";

const usd = (n: number) => `USD ${Math.abs(n).toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
const signo = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "±");

export function PanelItinerario({
  versiones,
  seleccion,
  onSeleccionar,
  armando,
  error,
  onAjustar,
}: {
  versiones: VersionItinerario[]; // de la más nueva a la más vieja
  seleccion: number | null;
  onSeleccionar: (version: number) => void;
  armando: boolean;
  error: string | null;
  onAjustar: (ajuste: string) => Promise<boolean>;
}) {
  const [ajuste, setAjuste] = useState("");
  const actual = versiones[0];
  const vista = versiones.find((v) => v.version === seleccion) ?? actual;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (await onAjustar(ajuste)) setAjuste("");
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-zinc-900">3 · Itinerario sugerido</h2>
        {versiones.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <span>Ver</span>
            <select
              className="min-h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900"
              value={vista?.version}
              onChange={(e) => onSeleccionar(Number(e.target.value))}
              disabled={armando}
            >
              {versiones.map((v) => (
                <option key={v.version} value={v.version}>
                  Versión {v.version}
                  {v === actual ? " (actual)" : ""}
                  {v.ajuste ? ` · ${v.ajuste.slice(0, 40)}${v.ajuste.length > 40 ? "…" : ""}` : " · primera propuesta"}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {armando && <Cronometro />}

      {!armando && vista && (
        <>
          {vista !== actual && (
            <p className="rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
              Estás viendo una versión anterior. Los ajustes se aplican siempre sobre la versión actual ({actual.version}).
            </p>
          )}
          {vista.ajuste && (
            <p className="text-sm text-zinc-600">
              <span className="font-medium text-zinc-800">Ajuste pedido:</span> {vista.ajuste}
            </p>
          )}
          {vista.cambios && <CajaCambios cambios={vista.cambios} version={vista.version} />}
          <VistaItinerario itinerario={vista.itinerario} />
          {vista.ms !== null && (
            <p className="text-xs text-zinc-500">Versión {vista.version} armada por IA en {(vista.ms / 1000).toFixed(1)} s.</p>
          )}
        </>
      )}

      {actual && (
        <form onSubmit={enviar} className="flex flex-col gap-2 border-t border-zinc-200 pt-4">
          <label htmlFor="ajuste" className="text-sm font-semibold text-zinc-900">
            Pedir un ajuste
          </label>
          <p className="text-xs text-zinc-500">
            Escribí lo que te pidió el cliente. La IA rehace el itinerario solo con servicios de la base y guarda una versión nueva.
          </p>
          <textarea
            id="ajuste"
            rows={2}
            maxLength={1000}
            value={ajuste}
            onChange={(e) => setAjuste(e.target.value)}
            disabled={armando}
            placeholder="Ej.: tienen menos presupuesto, sacá la excursión más cara · cambiá el rafting por el spa"
            className="w-full rounded-lg border border-zinc-300 p-3 text-sm text-zinc-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20"
          />
          <button
            type="submit"
            disabled={armando || !ajuste.trim()}
            className="min-h-11 self-end rounded-lg bg-teal-700 px-5 font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {armando ? "Rehaciendo…" : "Aplicar ajuste"}
          </button>
        </form>
      )}
    </section>
  );
}

function CajaCambios({ cambios, version }: { cambios: ResumenCambios; version: number }) {
  if (cambios.sin_cambios) {
    return (
      <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
        <p className="font-semibold">Cambios respecto de la versión {version - 1}</p>
        <p>Los servicios y el total no cambiaron (puede haber cambiado el orden o los textos).</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
      <p className="font-semibold">Cambios respecto de la versión {version - 1}</p>
      <ul className="flex flex-col gap-0.5">
        {cambios.dias_antes !== cambios.dias_despues && (
          <li>
            Días: {cambios.dias_antes} → {cambios.dias_despues}
          </li>
        )}
        {cambios.quitados.map((c) => (
          <li key={`q${c.servicio_id}`}>
            <span className="font-medium text-red-800">Quitado:</span> {c.nombre}{" "}
            <span className="text-sky-800">({signo(c.diferencia_usd)}{usd(c.diferencia_usd)})</span>
          </li>
        ))}
        {cambios.agregados.map((c) => (
          <li key={`a${c.servicio_id}`}>
            <span className="font-medium text-green-800">Agregado:</span> {c.nombre}{" "}
            <span className="text-sky-800">({signo(c.diferencia_usd)}{usd(c.diferencia_usd)})</span>
          </li>
        ))}
        {cambios.modificados.map((c) => (
          <li key={`m${c.servicio_id}`}>
            <span className="font-medium">Cambió la cantidad:</span> {c.nombre} ({c.antes} → {c.despues}){" "}
            <span className="text-sky-800">({signo(c.diferencia_usd)}{usd(c.diferencia_usd)})</span>
          </li>
        ))}
      </ul>
      <p className="mt-1 font-semibold">
        Total: {usd(cambios.total_antes)} → {usd(cambios.total_despues)} ({signo(cambios.diferencia_usd)}
        {usd(cambios.diferencia_usd)})
      </p>
    </div>
  );
}

function Cronometro() {
  const [segundos, setSegundos] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const etapa =
    segundos < 8 ? "Leyendo la ficha y el catálogo…" : segundos < 25 ? "Eligiendo servicios día por día…" : "Revisando horarios y precios…";
  return (
    <div className="flex flex-col gap-2" role="status">
      <p className="text-sm text-zinc-700">
        {etapa} <span className="tabular-nums text-zinc-500">{segundos} s</span>
      </p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-teal-600 transition-[width] duration-1000 ease-linear"
          style={{ width: `${Math.min(95, (segundos / 35) * 100)}%` }}
        />
      </div>
      <p className="text-xs text-zinc-500">Suele tardar entre 20 y 35 segundos.</p>
    </div>
  );
}
