// Pruebas de la etapa 4: login.
// Uso: con la app corriendo (npm run build && npm start), en otra terminal:
//   node --env-file=.env scripts/probar-login.mjs [http://localhost:3000]
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const base = process.argv[2] ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.PRUEBA_EMAIL;
const password = process.env.PRUEBA_PASSWORD;

const resultados = [];
const registrar = (prueba, ok, detalle) => {
  resultados.push({ ok });
  console.log(`${ok ? "PASÓ " : "FALLÓ"} · ${prueba} · ${detalle}`);
};
const pedir = (ruta, cookie) =>
  fetch(new URL(ruta, base), { redirect: "manual", headers: cookie ? { cookie } : {} });

// 1 · Sin sesión no entra
const r1 = await pedir("/copiloto");
const r1b = await pedir("/");
registrar(
  "Sin sesión no entra",
  [307, 308].includes(r1.status) && r1.headers.get("location")?.endsWith("/login"),
  `/copiloto → ${r1.status} ${r1.headers.get("location")} · / → ${r1b.status} ${r1b.headers.get("location")}`,
);

// 2 · Contraseña incorrecta: Supabase la rechaza (el mensaje en pantalla se revisa a mano)
const opciones = { auth: { persistSession: false, autoRefreshToken: false } };
const { error: errMala } = await createClient(url, key, opciones).auth.signInWithPassword({
  email,
  password: `${password}-incorrecta`,
});
registrar("Contraseña incorrecta rechazada", Boolean(errMala), errMala ? errMala.message : "¡entró con una contraseña incorrecta!");

// 3 · El usuario de prueba entra (sesión en cookies, como el navegador) y puede salir
const jar = new Map();
const ssr = createServerClient(url, key, {
  cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (lista) => lista.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
  },
});
const { error: errBuena } = await ssr.auth.signInWithPassword({ email, password });
const cookie = [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
const r3 = await pedir("/copiloto", cookie);
const html = r3.status === 200 ? await r3.text() : "";
const r3b = await pedir("/login", cookie);
const vioCopiloto = r3.status === 200 && html.includes("Nueva consulta") && html.includes(email);
await ssr.auth.signOut();
const r3c = await pedir("/copiloto", [...jar].map(([n, v]) => `${n}=${v}`).join("; "));
registrar(
  "El usuario de prueba entra y puede salir",
  !errBuena && vioCopiloto && [307, 308].includes(r3b.status) && [307, 308].includes(r3c.status),
  `login ${errBuena ? errBuena.message : "ok"} · /copiloto → ${r3.status}${vioCopiloto ? " con su email" : " SIN contenido"} · /login con sesión → ${r3b.status} ${r3b.headers.get("location")} · después de salir → ${r3c.status}`,
);

// 4 · Nadie puede crearse una cuenta solo
// (si el registro estuviera abierto, esta prueba crearía un usuario: se puede saltear con SALTAR_ALTA=1)
if (process.env.SALTAR_ALTA === "1") {
  console.log("SALTEADA · Nadie puede crearse una cuenta solo · falta desactivar el registro en Supabase");
  const fallas = resultados.filter((r) => !r.ok).length;
  console.log(`\n${resultados.length - fallas}/${resultados.length} pruebas pasaron`);
  process.exit(fallas ? 1 : 0);
}
const intruso = `intruso-${Date.now()}@ejemplo.test`;
const { data: alta, error: errAlta } = await createClient(url, key, opciones).auth.signUp({
  email: intruso,
  password: "Intruso-123456",
});
const bloqueado = Boolean(errAlta) && !alta?.user;
registrar("Nadie puede crearse una cuenta solo", bloqueado, errAlta ? errAlta.message : `¡se creó ${intruso}!`);

const fallas = resultados.filter((r) => !r.ok).length;
console.log(`\n${resultados.length - fallas}/${resultados.length} pruebas pasaron`);
process.exit(fallas ? 1 : 0);
