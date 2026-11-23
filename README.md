# Copiloto del asesor · Travel Experience

Herramienta interna para los asesores de Travel Experience, una agencia que diseña y vende experiencias de viaje en Argentina y países limítrofes.

## Qué hace

1. El asesor pega una consulta de WhatsApp.
2. En menos de un minuto ve la ficha del viajero y un itinerario sugerido, armado **solo** con servicios cargados en la base de proveedores.
3. A medida que conversa con el cliente, escribe ajustes y la IA rehace el itinerario. Si se pide algo que no está en la base, la app avisa y lo registra como pedido sin cubrir.

Proyecto del bloque B2 del programa AI-Centric Management (IAE, Universidad Austral).

## Cómo está hecha

| Pieza | Tecnología |
|---|---|
| App web | Next.js + TypeScript + Tailwind |
| Datos y login | Supabase |
| IA | Claude (API de Anthropic): Haiku 5.5 para la ficha, Opus 5.5 para el itinerario y los ajustes |
| Publicación | Vercel |

## Levantarla en tu computadora

Necesitás Node.js 20 o superior.

```bash
cp .env.example .env   # completá los valores
npm install
npm run dev            # abre http://localhost:3000
```

## Datos y seguridad

- Las claves van solo en `.env` (local) y en las variables de entorno de Vercel. Nunca en el código.
- Los datos de clientes y proveedores de este repositorio son de ejemplo y están anonimizados.
