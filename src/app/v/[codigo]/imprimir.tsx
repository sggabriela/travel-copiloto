"use client";

export function BotonImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="min-h-10 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-100 print:hidden"
    >
      Imprimir / guardar PDF
    </button>
  );
}
