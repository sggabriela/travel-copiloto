"use server";

import { redirect } from "next/navigation";
import { crearClienteSupabase } from "@/lib/supabase/server";

export type EstadoLogin = { error: string | null; email: string };

export async function iniciarSesion(
  _previo: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Completá el email y la contraseña.", email };
  }

  const supabase = await crearClienteSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      error: "El email o la contraseña no son correctos. Revisalos y probá de nuevo.",
      email,
    };
  }

  redirect("/copiloto");
}

export async function cerrarSesion() {
  const supabase = await crearClienteSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
