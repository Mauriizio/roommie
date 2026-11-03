# ROOMMIE

Aplicación colaborativa para recordar compras, actividades del hogar y lecturas eléctricas. ROOMMIE registra y recuerda, sin imponer: no crea turnos, deudas ni responsables automáticos.

## Tecnología

- Next.js 16 App Router, React 19 y TypeScript estricto.
- Tailwind CSS 4, Lucide, Recharts y Zod.
- Supabase Auth, PostgreSQL, Realtime y Storage privado.
- PWA instalable, preparada para Vercel.

## Requisitos

- Node.js 20.9 o superior (recomendado Node 22/24).
- npm.
- Acceso al proyecto Supabase `xcfltowyckznlhqnioqi`.

## Ejecutar localmente

1. En el panel de Roommie abre **Project Settings → API Keys** y copia la clave **Publishable** (`sb_publishable_…`). No uses una secret key en el navegador.
2. Pega esa clave como `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local`. La URL ya está configurada ahí.
3. Aplica `supabase/migrations/202611030001_roommie_v1.sql` al proyecto `xcfltowyckznlhqnioqi`, preferentemente con Supabase CLI autenticada y migraciones versionadas. La conexión usada durante el desarrollo no tuvo permiso para acceder a ese proyecto; por eso la migración aún no ha sido aplicada.
4. Desde la raíz `C:\Proyectos\ROOMMIE` ejecuta:

   ```powershell
   npm install
   npm run dev
   ```

5. Abre <http://localhost:3000>.

En Supabase Auth configura como URL de sitio la dirección local y luego la URL de Vercel. Añade `http://localhost:3000/auth/callback` y `https://TU-DOMINIO/auth/callback` a **Redirect URLs**. Los usuarios necesitan confirmar el correo si la confirmación está habilitada en Auth.

## Base de datos y privacidad

La migración crea perfiles, hogares, miembros, invitaciones, catálogo e historial de compras, eventos de reposición, tareas, bitácora, medidores, lecturas, boletas, índices, restricciones de pertenencia, triggers de auditoría, funciones de hogar/invitación y políticas RLS. Crea el bucket privado `roommie-private` con límite de 8 MB y tipos JPEG, PNG, WebP y PDF. Las imágenes se abren mediante URLs firmadas de corta duración.

La función de invitación acepta un enlace de un solo uso, con caducidad de siete días y máximo de dos integrantes. Cada hogar permanece aislado por RLS. Las lecturas guardan energía acumulada en kWh como decimal; el consumo se calcula entre lecturas válidas. La comparación con una boleta requiere el mismo inicio y fin de período.

**Antes de ejecutar la migración:** comprueba que el proyecto activo es `xcfltowyckznlhqnioqi` y revisa que sus objetos no choquen con ROOMMIE. La migración no elimina tablas ni datos; crea/actualiza únicamente objetos nombrados para esta app y sus políticas. Revisa el script antes de usar `supabase db push`.

## Comandos de verificación

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Las pruebas unitarias eléctricas verifican el cálculo 12.450 → 12.620 = 170 kWh, lecturas descendentes y períodos coincidentes. Las pruebas completas de registro, aislamiento entre usuarios, Storage y sincronización requieren que la migración esté aplicada y cuentas de prueba en Supabase.

## PWA

Los iconos de instalación se generan conservando el logo original:

```powershell
node scripts/generate-icons.mjs
```

En Android abre el dominio HTTPS desde Chrome y selecciona **Instalar aplicación** o **Añadir a pantalla de inicio**. En iPhone, abre la web en Safari y usa **Compartir → Añadir a pantalla de inicio**. El service worker usa red directa y no guarda respuestas privadas para uso offline.

## Publicación en Vercel

Conecta el repositorio `roommie` a Vercel, configura framework Next.js, Node 22.x o 24.x y agrega estas variables a Development, Preview y Production:

- `NEXT_PUBLIC_SUPABASE_URL=https://xcfltowyckznlhqnioqi.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…`

Después vuelve a desplegar y configura el dominio de Vercel en Supabase Auth → URL Configuration. No agregues claves secret o `service_role` a variables `NEXT_PUBLIC_`.

## Estructura

```text
src/app/                 Vistas, layout, callback y estilos
src/lib/supabase/        Clientes de navegador/servidor
src/lib/electricity.ts   Cálculos y comparación de períodos
supabase/migrations/     SQL reproducible, RLS y Storage
public/                  Marca, manifest y service worker
LOGO/LOGO.png            Recurso original preservado
tests/                   Pruebas de cálculo eléctrico
```
