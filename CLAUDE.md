# Recentales App - Organizador de reuniones familiares en el campo

## Qué es
App mobile-first para organizar juntadas familiares grandes (Pascuas, Navidad, etc.) en el campo. Maneja: asistencia por día, comidas (con diferenciación vegetariana), bebidas, camas/carpas, y división de gastos estilo Splitwise.

## Stack
- Next.js 14+ (App Router) con TypeScript
- Supabase (Auth magic link por email + PostgreSQL + RLS)
- Tailwind CSS (mobile-first)
- Deploy: Vercel
- Package manager: npm

## Variables de entorno
Archivo `.env.local` en la raíz:
```
NEXT_PUBLIC_SUPABASE_URL=<url del proyecto supabase>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key del proyecto supabase>
```

## Estructura del proyecto
```
/src
  /app                → páginas (App Router con layout.tsx y page.tsx)
    /login            → página de login con magic link
    /evento           → configuración del evento (fechas, duración)
    /asistentes       → gestión de asistentes y acompañantes
    /comidas          → cálculo automático de comidas por día
    /bebidas          → estimación de bebidas por asistente
    /camas            → gestión de camas disponibles y alerta de carpas
    /gastos           → carga de gastos y balance de deudas
    /historial        → datos históricos de eventos anteriores
  /components         → componentes React reutilizables
    /ui               → botones, modals, inputs, cards, tabs, badges
    /layout           → BottomNav, Header, PageWrapper
  /lib                → supabase client, utils, types, constants
  /hooks              → custom hooks (useEvent, useAttendees, useExpenses, etc.)
  /types              → TypeScript types e interfaces
```

## Base de datos (Supabase PostgreSQL)

### Tablas principales

**events** - Eventos/juntadas
- id: uuid PK default gen_random_uuid()
- name: text NOT NULL (ej: "Pascuas 2026")
- start_date: date NOT NULL
- end_date: date NOT NULL
- created_by: uuid FK → auth.users(id)
- created_at: timestamptz default now()
- is_active: boolean default true

**profiles** - Perfiles de usuarios registrados
- id: uuid PK FK → auth.users(id)
- email: text NOT NULL
- full_name: text NOT NULL
- avatar_url: text nullable
- created_at: timestamptz default now()

**attendees** - Asistentes (registrados y acompañantes)
- id: uuid PK default gen_random_uuid()
- event_id: uuid FK → events(id) ON DELETE CASCADE
- profile_id: uuid FK → profiles(id) nullable (null = acompañante no registrado)
- added_by: uuid FK → profiles(id) NOT NULL (quién lo agregó)
- name: text NOT NULL
- is_vegetarian: boolean default false
- is_registered_user: boolean default false
- created_at: timestamptz default now()

**attendance_days** - Qué días asiste cada persona
- id: uuid PK default gen_random_uuid()
- attendee_id: uuid FK → attendees(id) ON DELETE CASCADE
- event_id: uuid FK → events(id) ON DELETE CASCADE
- date: date NOT NULL
- is_present: boolean default true
- UNIQUE(attendee_id, date)

**meals** - Resumen de comidas por día (calculado automáticamente)
- id: uuid PK default gen_random_uuid()
- event_id: uuid FK → events(id) ON DELETE CASCADE
- date: date NOT NULL
- meal_type: text NOT NULL CHECK (meal_type IN ('desayuno', 'almuerzo', 'merienda', 'cena'))
- total_people: integer default 0
- vegetarian_count: integer default 0
- notes: text nullable
- UNIQUE(event_id, date, meal_type)

**drinks** - Estimación de bebidas por asistente
- id: uuid PK default gen_random_uuid()
- event_id: uuid FK → events(id) ON DELETE CASCADE
- attendee_id: uuid FK → attendees(id) ON DELETE CASCADE
- drink_name: text NOT NULL (ej: "vino tinto", "cerveza", "agua", "gaseosa")
- quantity: numeric NOT NULL
- unit: text NOT NULL (ej: "litros", "botellas", "cajas", "packs")
- created_at: timestamptz default now()

**beds** - Camas disponibles
- id: uuid PK default gen_random_uuid()
- event_id: uuid FK → events(id) ON DELETE CASCADE
- bed_type: text NOT NULL CHECK (bed_type IN ('single', 'double'))
- label: text nullable (ej: "Habitación principal", "Quincho")
- count: integer NOT NULL default 1
- created_at: timestamptz default now()

**expenses** - Gastos cargados por los usuarios
- id: uuid PK default gen_random_uuid()
- event_id: uuid FK → events(id) ON DELETE CASCADE
- paid_by: uuid FK → attendees(id) NOT NULL
- description: text NOT NULL
- amount: numeric(12,2) NOT NULL
- category: text nullable (ej: "comida", "bebida", "leña", "transporte", "otros")
- date: date NOT NULL
- created_at: timestamptz default now()

**expense_splits** - Cómo se divide cada gasto
- id: uuid PK default gen_random_uuid()
- expense_id: uuid FK → expenses(id) ON DELETE CASCADE
- attendee_id: uuid FK → attendees(id) ON DELETE CASCADE
- share_amount: numeric(12,2) nullable (null = parte equitativa)
- is_excluded: boolean default false (true = no participa de este gasto)
- is_custom_amount: boolean default false
- UNIQUE(expense_id, attendee_id)

**event_history** - Snapshot de eventos cerrados
- id: uuid PK default gen_random_uuid()
- event_id: uuid FK → events(id)
- snapshot_date: timestamptz default now()
- meals_data: jsonb NOT NULL
- drinks_data: jsonb NOT NULL
- expenses_data: jsonb NOT NULL
- attendees_data: jsonb NOT NULL
- total_expenses: numeric(12,2)
- per_person_average: numeric(12,2)

### RLS (Row Level Security)
- Activar RLS en TODAS las tablas
- Policy: los usuarios autenticados pueden leer todos los datos de eventos donde participan
- Policy: los usuarios pueden insertar/editar attendees que ellos mismos agregaron (added_by = auth.uid())
- Policy: los usuarios pueden insertar/editar sus propios expenses
- Policy: cualquier participante del evento puede leer todos los gastos del evento
- Policy: solo el creador del evento puede editar el evento y las camas

## Auth
- Magic link por email (Supabase Auth)
- Al registrarse se crea automáticamente un profile via trigger de Supabase
- Cada usuario puede agregar acompañantes/familia como attendees no registrados
- No hay passwords, solo magic link

## Reglas de negocio

### Evento
- El creador define nombre, fecha inicio y fin
- Los días se calculan automáticamente entre las fechas
- Un evento puede estar activo o cerrado (histórico)

### Asistentes
- Cada usuario registrado puede agregar acompañantes con nombre y si es vegetariano
- Cada asistente marca en qué días estará presente
- El conteo por día es automático

### Comidas
- 4 comidas diarias: desayuno, almuerzo, merienda, cena
- Se calculan automáticamente según asistentes presentes ese día
- Se muestra breakdown: total y vegetarianos
- Las meals se auto-generan cuando se crean attendance_days

### Bebidas
- Cada asistente (o quien lo agregó) estima cuánto va a tomar
- Categorías libres: vino, cerveza, fernet, gaseosa, agua, jugo, etc.
- Se muestra un consolidado total por bebida

### Camas
- Default al crear evento: 4 camas dobles (2 personas c/u = 8) + 10 camas simples (1 persona c/u = 10) = 18 lugares
- El creador puede editar: agregar/quitar camas, cambiar tipo, poner etiquetas
- Si asistentes > capacidad de camas → mostrar alerta: "Faltan X lugares. ¡Traigan carpas!"
- Mostrar camas por noche (puede variar si alguien llega/sale en distintos días)

### Gastos (estilo Splitwise/Tricount)
- Cualquier usuario puede cargar un gasto que pagó
- Por defecto se divide equitativamente entre TODOS los asistentes del evento
- Opciones de split:
  - **Equitativo**: se divide entre todos
  - **Excluir personas**: marcar quién NO participa de ese gasto
  - **Montos custom**: asignar monto específico a cada persona
  - **Préstamo**: un usuario le presta plata a otro (gasto entre 2 personas)
- Balance: mostrar quién le debe a quién y cuánto
- Algoritmo de simplificación de deudas (minimizar transacciones)
- Moneda: ARS (pesos argentinos)

### Historial
- Al cerrar un evento, se hace snapshot de toda la data en event_history como JSONB
- Se puede consultar historial de eventos pasados (qué se comió, cuánto se bebió, cuánto se gastó)

## UI/UX

### Navegación mobile-first
- Bottom navigation bar con íconos y labels: Evento | Asistentes | Comidas | Bebidas | Camas | Gastos
- Header fijo con nombre del evento activo
- Diseño limpio, fondo oscuro (slate-900/950), acentos en emerald-500 y amber-500
- Cards con bordes redondeados y sombras sutiles
- Tipografía clara, tamaños accesibles para mobile

### Paleta de colores
- Background: slate-950
- Cards: slate-900 con border slate-800
- Primary action: emerald-500
- Secondary/warning: amber-500
- Danger: red-500
- Text: white / slate-300 / slate-400

### Breakpoints
- Mobile: default (no prefix)
- Tablet: md:
- Desktop: lg:
- Siempre diseñar PRIMERO para mobile, después adaptar

## Convenciones de código
- TypeScript estricto (no `any`)
- Componentes funcionales con hooks
- Nombres de archivos: kebab-case
- Nombres de componentes: PascalCase
- Español para textos de UI y comentarios de negocio
- Inglés para nombres de variables, funciones, componentes y archivos
- Usar Supabase client-side con `createBrowserClient` de `@supabase/ssr`
- No instalar dependencias innecesarias — usar lo mínimo

## Comandos
```bash
npm run dev      # desarrollo local
npm run build    # build de producción
npm run lint     # linting
```

## Deploy
- Push a `main` → Vercel auto-deploya
- Las migraciones SQL se corren manualmente en Supabase SQL Editor
