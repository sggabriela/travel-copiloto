import "server-only";
import { redirect } from "next/navigation";
import { crearClienteSupabase } from "@/lib/supabase/server";

export type Usuario = {
  id: string;
  email: string;
};

/**
 * Devuelve el usuario con sesión o redirige al login.
 * Valida la sesión contra Supabase: no confía solo en la cookie.
 */
export async function usuarioActual(): Promise<Usuario> {
  const supabase = await crearClienteSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    redirect("/login");
  }
  return { id: data.user.id, email: data.user.email ?? "" };
}
