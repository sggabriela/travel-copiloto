import type { Metadata } from "next";
import { Suspense } from "react";
import { usuarioActual } from "@/lib/auth";
import { cerrarSesion } from "@/app/login/acciones";
import { Copiloto } from "./copiloto";

export const metadata: Metadata = { title: "Copiloto · Travel Experience" };

export default function PaginaCopiloto() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-sm font-bold text-white">
              TE
            </span>
            <span className="font-semibold text-zinc-900">Travel Experience</span>
            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800">
              Copiloto
            </span>
          </div>
          <Suspense fallback={<span className="text-sm text-zinc-500">Cargando…</span>}>
            <MenuUsuario />
          </Suspense>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
        <Suspense fallback={<p className="text-zinc-500">Cargando…</p>}>
          <Contenido />
        </Suspense>
      </main>
    </div>
  );
}

async function MenuUsuario() {
  const usuario = await usuarioActual();
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-zinc-600">{usuario.email}</span>
      <form action={cerrarSesion}>
        <button
          type="submit"
          className="min-h-9 rounded-lg border border-zinc-300 px-3 font-medium text-zinc-700 hover:bg-zinc-100"
        >
          Salir
        </button>
      </form>
    </div>
  );
}

async function Contenido() {
  await usuarioActual();
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-zinc-900">Nueva consulta</h1>
        <p className="text-sm text-zinc-600">
          Pegá la conversación, revisá la ficha y después armamos el itinerario.
        </p>
      </div>
      <Copiloto />
    </>
  );
}
