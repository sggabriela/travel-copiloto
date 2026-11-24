"use client";

import { useState, useTransition } from "react";
import type { Ficha } from "@/lib/ia/ficha";
import {
  ajustarItinerario,
  generarFicha,
  generarItinerario,
  guardarFicha,
  type ResultadoItinerario,
  type VersionItinerario,
} from "./acciones";
import { PanelItinerario } from "./panel-itinerario";
import { EJEMPLOS } from "./ejemplos";

const campo =
  "min-h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20";

export function Copiloto() {
  const [conversacion, setConversacion] = useState("");
  const [consultaId, setConsultaId] = useState<string | null>(null);
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [demora, setDemora] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [generando, iniciarGeneracion] = useTransition();
  const [guardando, iniciarGuardado] = useTransition();
  const [versiones, setVersiones] = useState<VersionItinerario[]>([]);
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [errorItinerario, setErrorItinerario] = useState<string | null>(null);
  const [armando, iniciarArmado] = useTransition();

  function generar() {
    setError(null);
    setAviso(null);
    iniciarGeneracion(async () => {
      const r = await generarFicha(conversacion);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setConsultaId(r.consultaId);
      setFicha(r.ficha);
      setDemora(r.ms);
    });
  }

  function recibir(r: ResultadoItinerario): boolean {
    if (!r.ok) {
      setErrorItinerario(r.error);
      return false;
    }
    setVersiones((vs) => [r.nueva, ...vs]);
    setSeleccion(r.nueva.version);
    return true;
  }

  function armar() {
    if (!ficha || !consultaId) return;
    setErrorItinerario(null);
    iniciarArmado(async () => {
      recibir(await generarItinerario(consultaId, ficha));
    });
  }

  function ajustar(texto: string): Promise<boolean> {
    if (!consultaId) return Promise.resolve(false);
    setErrorItinerario(null);
    return new Promise((resolver) => {
      iniciarArmado(async () => {
        resolver(recibir(await ajustarItinerario(consultaId, texto)));
      });
    });
  }

  function guardar() {
    if (!ficha || !consultaId) return;
    setAviso(null);
    iniciarGuardado(async () => {
      const r = await guardarFicha(consultaId, ficha);
      setAviso(r.ok ? "Cambios guardados." : (r.error ?? "No se pudo guardar."));
    });
  }

  function nuevaConsulta() {
    setConversacion("");
    setConsultaId(null);
    setFicha(null);
    setDemora(null);
    setError(null);
    setVersiones([]);
    setSeleccion(null);
    setErrorItinerario(null);
    setAviso(null);
  }

  return (
    <div className="flex flex-col gap-5">
    <div className="flex flex-wrap items-start gap-5">
      <section className="flex min-w-0 flex-[1_1_320px] flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-zinc-900">1 · Conversación</h2>
          {ficha && (
            <button type="button" onClick={nuevaConsulta} className="text-sm font-medium text-teal-800 hover:underline">
              Nueva consulta
            </button>
          )}
        </div>
        <label htmlFor="conversacion" className="text-sm text-zinc-600">
          Pegá los mensajes de WhatsApp de esta consulta. Usá nombres genéricos (por ejemplo, &quot;Cliente A&quot;).
        </label>
        <textarea
          id="conversacion"
          value={conversacion}
          onChange={(e) => setConversacion(e.target.value)}
          rows={12}
          disabled={generando}
          className="w-full rounded-lg border border-zinc-300 p-3 text-sm text-zinc-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20"
          placeholder="Cliente A: ¡Hola! Vi el viaje al norte en Instagram…"
        />
        <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
          <span>Probar con un ejemplo:</span>
          {EJEMPLOS.map((ej) => (
            <button
              key={ej.nombre}
              type="button"
              onClick={() => setConversacion(ej.texto)}
              disabled={generando}
              className="rounded-full border border-zinc-300 px-3 py-1 hover:bg-zinc-100"
            >
              {ej.nombre}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={generar}
          disabled={generando || !conversacion.trim()}
          className="min-h-11 rounded-lg bg-teal-700 font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {generando ? "Leyendo la conversación…" : "Generar ficha"}
        </button>
      </section>

      <section className="flex min-w-0 flex-[1_1_360px] flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-zinc-900">2 · Ficha del viajero</h2>
          {demora !== null && (
            <span className="text-xs text-zinc-500">Armada por IA en {(demora / 1000).toFixed(1)} s</span>
          )}
        </div>
        {!ficha ? (
          <p className="text-sm text-zinc-500">
            Cuando generes la ficha, acá vas a ver lo que entendió la IA. Podés corregir cualquier dato antes de seguir.
          </p>
        ) : (
          <FichaEditable
            ficha={ficha}
            onChange={setFicha}
            onGuardar={guardar}
            guardando={guardando}
            aviso={aviso}
            onArmar={armar}
            armando={armando}
            hayItinerario={versiones.length > 0}
          />
        )}
      </section>
    </div>

      {(armando || versiones.length > 0 || errorItinerario) && (
        <PanelItinerario
          versiones={versiones}
          seleccion={seleccion}
          onSeleccionar={setSeleccion}
          armando={armando}
          error={errorItinerario}
          onAjustar={ajustar}
        />
      )}
    </div>
  );
}

function FichaEditable({
  ficha,
  onChange,
  onGuardar,
  guardando,
  aviso,
  onArmar,
  armando,
  hayItinerario,
}: {
  ficha: Ficha;
  onChange: (f: Ficha) => void;
  onGuardar: () => void;
  guardando: boolean;
  aviso: string | null;
  onArmar: () => void;
  armando: boolean;
  hayItinerario: boolean;
}) {
  const set = <K extends keyof Ficha>(k: K, v: Ficha[K]) => onChange({ ...ficha, [k]: v });
  const texto = (v: string) => (v.trim() === "" ? null : v);
  const lista = (v: string) =>
    v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">{ficha.resumen}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo id="personas" etiqueta="Personas">
          <input
            id="personas"
            type="number"
            min={1}
            className={campo}
            value={ficha.personas ?? ""}
            onChange={(e) => set("personas", e.target.value === "" ? null : Number(e.target.value))}
          />
        </Campo>
        <Campo id="composicion" etiqueta="Quiénes viajan">
          <input id="composicion" className={campo} value={ficha.composicion ?? ""} onChange={(e) => set("composicion", texto(e.target.value))} />
        </Campo>
        <Campo id="destino" etiqueta="Destino">
          <input id="destino" className={campo} value={ficha.destino ?? ""} onChange={(e) => set("destino", texto(e.target.value))} />
        </Campo>
        <Campo id="region" etiqueta="Región del catálogo">
          <select id="region" className={campo} value={ficha.region} onChange={(e) => set("region", e.target.value as Ficha["region"])}>
            <option value="norte">Norte (Salta y Jujuy)</option>
            <option value="mendoza">Mendoza</option>
            <option value="sierras">Sierras (Córdoba y San Luis)</option>
            <option value="otra">Otra</option>
            <option value="sin_definir">Sin definir</option>
          </select>
        </Campo>
        <Campo id="fechas" etiqueta="Cuándo">
          <input id="fechas" className={campo} value={ficha.fechas ?? ""} onChange={(e) => set("fechas", texto(e.target.value))} />
        </Campo>
        <Campo id="duracion" etiqueta="Días">
          <input
            id="duracion"
            type="number"
            min={1}
            className={campo}
            value={ficha.duracion_dias ?? ""}
            onChange={(e) => set("duracion_dias", e.target.value === "" ? null : Number(e.target.value))}
          />
        </Campo>
        <Campo id="presupuesto" etiqueta="Presupuesto">
          <input id="presupuesto" className={campo} value={ficha.presupuesto ?? ""} onChange={(e) => set("presupuesto", texto(e.target.value))} />
        </Campo>
        <Campo id="ritmo" etiqueta="Ritmo">
          <input id="ritmo" className={campo} value={ficha.ritmo ?? ""} onChange={(e) => set("ritmo", texto(e.target.value))} />
        </Campo>
      </div>
      <Campo id="intereses" etiqueta="Intereses (separados por coma)">
        <input id="intereses" className={campo} value={ficha.intereses.join(", ")} onChange={(e) => set("intereses", lista(e.target.value))} />
      </Campo>
      <Campo id="restricciones" etiqueta="A evitar (separado por coma)">
        <input id="restricciones" className={campo} value={ficha.restricciones.join(", ")} onChange={(e) => set("restricciones", lista(e.target.value))} />
      </Campo>

      {(ficha.faltantes.length > 0 || ficha.preguntas_sugeridas.length > 0) && (
        <div className="flex flex-col gap-2 rounded-lg bg-amber-50 p-3">
          {ficha.faltantes.length > 0 && (
            <p className="text-sm font-semibold text-amber-900">Falta saber: {ficha.faltantes.join(", ")}</p>
          )}
          {ficha.preguntas_sugeridas.map((p) => (
            <Pregunta key={p} texto={p} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {aviso && <span className="text-sm text-zinc-600">{aviso}</span>}
        <button
          type="button"
          onClick={onGuardar}
          disabled={guardando || armando}
          className="min-h-10 rounded-lg border border-teal-700 px-4 text-sm font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar cambios de la ficha"}
        </button>
      </div>
      <button
        type="button"
        onClick={onArmar}
        disabled={armando || guardando}
        className="min-h-11 rounded-lg bg-teal-700 font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
      >
        {armando ? "Armando el itinerario…" : hayItinerario ? "Rearmar itinerario con esta ficha" : "Armar itinerario"}
      </button>
    </div>
  );
}

function Campo({ id, etiqueta, children }: { id: string; etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-zinc-600">
        {etiqueta}
      </label>
      {children}
    </div>
  );
}

function Pregunta({ texto }: { texto: string }) {
  const [copiada, setCopiada] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 text-sm text-amber-950">
      <span>{texto}</span>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(texto);
            setCopiada(true);
            setTimeout(() => setCopiada(false), 1500);
          } catch {
            setCopiada(false);
          }
        }}
        className="min-h-8 shrink-0 rounded-md border border-amber-400 bg-white px-3 text-xs font-medium text-amber-900"
      >
        {copiada ? "Copiada" : "Copiar"}
      </button>
    </div>
  );
}
