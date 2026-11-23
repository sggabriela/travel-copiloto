import type { Metadata } from "next";
import { FormularioLogin } from "./formulario-login";

export const metadata: Metadata = { title: "Entrar · Copiloto Travel Experience" };

export default function PaginaLogin() {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 p-4">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">
            Travel Experience
          </p>
          <h1 className="text-2xl font-semibold text-zinc-900">Copiloto del asesor</h1>
          <p className="text-sm text-zinc-600">
            Entrá con el usuario que te dio el equipo. No se pueden crear cuentas desde acá.
          </p>
        </div>
        <FormularioLogin />
      </div>
    </main>
  );
}
