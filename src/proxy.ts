import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Corre antes de cada página:
 * 1. Refresca la sesión de Supabase y actualiza sus cookies.
 * 2. Sin sesión, el copiloto redirige al login.
 * 3. Con sesión, el login redirige al copiloto.
 * Las páginas y acciones vuelven a validar la sesión: esto es solo el primer filtro.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ruta = request.nextUrl.pathname;
  const esPrivada = ruta.startsWith("/copiloto");
  const esLogin = ruta.startsWith("/login");

  if (!user && esPrivada) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    return NextResponse.redirect(destino);
  }
  if (user && esLogin) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/copiloto";
    return NextResponse.redirect(destino);
  }
  return response;
}

export const config = {
  matcher: [
    // Todo menos archivos estáticos e imágenes
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
