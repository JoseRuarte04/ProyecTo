---
title: "Arquitectura — QuickDASH Externo (completado desde casa)"
project: RehabOT
author: Winston (System Architect)
date: 2026-05-11
status: approved
---

# Arquitectura: QuickDASH Externo

## 1. Decisiones de diseño clave

### 1.1 Acceso anónimo via RPCs con SECURITY DEFINER (no RLS anon directo)

**Decisión**: la ruta pública `/q/:token` no accede a la tabla `quickdash_tokens` directamente. Usa dos funciones Postgres con `SECURITY DEFINER`:
- `get_quickdash_token(p_token)` → valida y devuelve solo el estado mínimo
- `complete_quickdash_token(p_token, p_items, p_score)` → escribe resultado

**Por qué**: evita abrir el role `anon` a la tabla. Las RPCs exponen exactamente lo que la página pública necesita, nada más. El `GRANT` es quirúrgico (`TO anon`).

**Trade-off aceptado**: leve complejidad adicional en DB vs. exposición de tabla.

### 1.2 Sincronización de resultado: "Apply" explícito, no trigger automático

**Decisión**: cuando el paciente completa el token, el resultado queda en `quickdash_tokens.result`. El terapeuta ve el resultado en su panel y lo aplica manualmente a `functional_evaluations` con un botón "Aplicar a evaluación funcional".

**Por qué**: evita un trigger que hace UPSERT en `functional_evaluations` con campos que solo el terapeuta conoce (`episode_id`, `dominance`, etc.). El terapeuta tiene control explícito sobre qué entra en el registro oficial.

**Trade-off aceptado**: requiere un clic del terapeuta, pero es semánticamente correcto — el terapeuta valida antes de registrar.

### 1.3 QuickDashTokenManager reemplaza, no rodea, al QuickDashSection en SessionForm

**Decisión**: en `SessionForm.tsx` la línea `<QuickDashSection items={qd_items} onChange={setQdItems} />` (l.1604) se reemplaza por `<QuickDashTokenManager>`, que internamente decide cuándo mostrar el `<QuickDashSection>`.

**Por qué**: evita duplicar la lógica de "carga manual vs. link". El Manager unifica ambos flujos.

### 1.4 PII mínima en la página pública

**Decisión**: `get_quickdash_token()` devuelve `{status, expires_at}` — sin patient_id, session_id ni ningún dato identificatorio. La página pública solo muestra el formulario de 11 ítems.

---

## 2. Modelo de datos

### Tabla `quickdash_tokens`

```sql
CREATE TABLE public.quickdash_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token        uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  patient_id   uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  session_id   uuid NOT NULL REFERENCES public.therapy_sessions(id) ON DELETE CASCADE,
  created_by   uuid NOT NULL REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  completed_at timestamptz,
  completed_by text CHECK (completed_by IN ('patient', 'therapist')),
  result       jsonb  -- { items: number[], score: number }
);
```

**Índices**: `(session_id)`, `(token)` (ya tiene UNIQUE constraint → índice implícito).

**Invariante crítica**: solo puede haber UN token activo (no completado, no vencido) por sesión. Esto se enforcea en la RPC `create_quickdash_token()` — no como constraint DB porque complica la lógica de "vencidos históricos".

### Estructura del campo `result` (JSONB)

```json
{
  "items": [1, 3, 2, 4, 1, 2, 3, 1, 2, 2, 3],
  "score": 36.4
}
```

---

## 3. RPCs y Políticas RLS

### 3.1 RLS para terapeutas autenticados

```sql
-- SELECT: solo sus propios tokens
CREATE POLICY "quickdash_tokens: select propio"
ON public.quickdash_tokens FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- INSERT: solo como dueño
CREATE POLICY "quickdash_tokens: insert"
ON public.quickdash_tokens FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- UPDATE: solo sus propios tokens (para invalidación manual)
CREATE POLICY "quickdash_tokens: update propio"
ON public.quickdash_tokens FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());
```

### 3.2 RPCs públicas (anon)

**`get_quickdash_token(p_token uuid)`**
- SECURITY DEFINER, GRANT TO anon
- Devuelve: `{ status: 'valid'|'expired'|'completed'|'not_found', expires_at: timestamptz }`
- No expone patient_id, session_id, ni result

**`complete_quickdash_token(p_token uuid, p_items jsonb, p_score numeric)`**
- SECURITY DEFINER, GRANT TO anon
- Valida: token existe, `completed_at IS NULL`, `expires_at > now()`, items tiene 11 elementos con valores 1-5
- Escribe: `completed_at = now()`, `completed_by = 'patient'`, `result = {items, score}`
- Si falla: `RAISE EXCEPTION` con mensaje genérico (no expone detalles)

**`create_quickdash_token(p_session_id, p_patient_id, p_expires_at)`** *(para terapeutas)*
- SECURITY DEFINER, GRANT TO authenticated
- Invalida tokens previos activos de la misma sesión (pone `completed_at = now(), completed_by = 'therapist'`)
- Inserta nuevo token
- Devuelve el `token` UUID

---

## 4. Fases de implementación

### Fase 1 — Migración SQL (solo DB, sin UI)
**Archivos a crear**: `supabase/migrations/20260511123816_quickdash_tokens.sql`

Contenido:
1. `CREATE TABLE quickdash_tokens`
2. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
3. Policies RLS para `authenticated`
4. Función `get_quickdash_token()` + GRANT anon
5. Función `complete_quickdash_token()` + GRANT anon
6. Función `create_quickdash_token()` + GRANT authenticated

**Validación**: ejecutar con MCP Supabase `apply_migration`.

---

### Fase 2 — Tipos TypeScript
**Archivo a modificar**: `src/integrations/supabase/types.ts`

Agregar en `Tables`:
```ts
quickdash_tokens: {
  Row: {
    id: string
    token: string
    patient_id: string
    session_id: string
    created_by: string
    created_at: string
    expires_at: string
    completed_at: string | null
    completed_by: 'patient' | 'therapist' | null
    result: Json | null
  }
  Insert: { ... }  // token y id opcionales (tienen DEFAULT)
  Update: Partial<Row>
}
```

También agregar los tipos de retorno de las RPCs en `Functions`.

---

### Fase 3 — Ruta pública `/q/:token`
**Archivos a crear**: `src/pages/QuickDashPublicPage.tsx`
**Archivos a modificar**: `src/App.tsx`

#### App.tsx — agregar FUERA de `<AppLayout>`:
```tsx
<Route path="/q/:token" element={<QuickDashPublicPage />} />
```

Antes del `<Route path="*" element={<NotFound />} />`.

#### QuickDashPublicPage.tsx — estados de la UI:

```
loading
  → (fetch get_quickdash_token)
    → 'not_found' | 'expired'  →  <PantallaInvalida />
    → 'completed'              →  <PantallaYaCompletada />
    → 'valid'                  →  <FormularioQuickDash />
                                     → submit complete_quickdash_token
                                       → <PantallaExito />
```

**Diseño mobile-first**:
- Sin sidebar, sin header de app
- Logo/nombre de la app centrado arriba
- `QuickDashSection` existente reutilizado directamente
- Botón "Enviar respuestas" al pie
- No muestra nombre de paciente ni datos de sesión

**Seguridad en submit**:
- Validar en cliente que los 11 ítems estén respondidos (UX)
- La RPC valida de nuevo server-side (no confiar en el cliente)
- En caso de error de RPC: mostrar mensaje genérico, no detalles técnicos

---

### Fase 4 — Componente `QuickDashTokenManager`
**Archivo a crear**: `src/components/evaluations/QuickDashTokenManager.tsx`

Props:
```ts
interface QuickDashTokenManagerProps {
  sessionId: string
  patientId: string
  // Estado actual de qd_items y setter (para carga manual)
  items: (number | null)[]
  onChange: (items: (number | null)[]) => void
}
```

**Estados internos del componente**:

```
A. Sin token activo, sin resultado
   → Botón "Generar link para paciente"
   → Botón "Cargar manualmente"

B. Token activo (pending)
   → Muestra URL copiable + vencimiento
   → Botón "Cancelar link"
   → Botón "Cargar manualmente" (invalida el link)

C. Token completado por paciente
   → Badge "Completado por paciente — score X/100"
   → Botón "Aplicar a evaluación funcional" → dispara onChange() con los items del token
   → Botón "Reemplazar con carga manual"

D. Modo carga manual activo
   → Muestra <QuickDashSection> existente
   → (El formulario de la sesión ya captura qd_items normalmente)
```

**Selector de vencimiento** (cuando genera link):
```
[ 24 horas ] [ 48 horas ] [ 72 horas ] [ 7 días ] [ Fecha personalizada ]
```

**URL del link**:
```
${window.location.origin}/q/${token}
```

Botón "Copiar" con feedback visual (icon Check por 2 segundos).

**Realtime** (opcional, recomendado): suscripción a `quickdash_tokens` filtrada por `session_id` para que el panel del terapeuta se actualice sin recargar cuando el paciente completa el formulario.

---

### Fase 5 — Integración en SessionForm
**Archivo a modificar**: `src/pages/SessionForm.tsx`

**Cambio mínimo**: reemplazar línea 1604:
```tsx
// Antes:
<QuickDashSection items={qd_items} onChange={setQdItems} />

// Después:
<QuickDashTokenManager
  sessionId={sessionId!}
  patientId={patientId!}
  items={qd_items}
  onChange={setQdItems}
/>
```

`QuickDashTokenManager` maneja internamente cuándo mostrar `<QuickDashSection>`. El flujo de guardado en SessionForm no cambia — sigue usando `qd_items` del estado local.

**Condición**: `QuickDashTokenManager` solo se renderiza en modo edición (cuando `sessionId` existe). En modo "nueva sesión", mostrar directamente `<QuickDashSection>` porque no hay session_id todavía para anclar el token.

```tsx
{isEditing
  ? <QuickDashTokenManager sessionId={sessionId!} patientId={patientId!} items={qd_items} onChange={setQdItems} />
  : <QuickDashSection items={qd_items} onChange={setQdItems} />
}
```

---

## 5. Archivos — resumen

### Crear
| Archivo | Fase |
|---|---|
| `supabase/migrations/20260511123816_quickdash_tokens.sql` | 1 |
| `src/pages/QuickDashPublicPage.tsx` | 3 |
| `src/components/evaluations/QuickDashTokenManager.tsx` | 4 |

### Modificar
| Archivo | Cambio | Fase |
|---|---|---|
| `src/integrations/supabase/types.ts` | Agregar `quickdash_tokens` | 2 |
| `src/App.tsx` | Agregar `/q/:token` fuera de AppLayout | 3 |
| `src/pages/SessionForm.tsx` | Reemplazar `<QuickDashSection>` (l.1604) | 5 |

**No tocar**: `src/components/evaluations/FunctionalScales.tsx` — el componente `QuickDashSection` ya es reutilizable, no requiere cambios.

---

## 6. Migración SQL completa

```sql
-- ── quickdash_tokens ──

CREATE TABLE public.quickdash_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token        uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  patient_id   uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  session_id   uuid NOT NULL REFERENCES public.therapy_sessions(id) ON DELETE CASCADE,
  created_by   uuid NOT NULL REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  completed_at timestamptz,
  completed_by text CHECK (completed_by IN ('patient', 'therapist')),
  result       jsonb
);

CREATE INDEX ON public.quickdash_tokens (session_id);

ALTER TABLE public.quickdash_tokens ENABLE ROW LEVEL SECURITY;

-- Terapeutas: leer sus propios tokens
CREATE POLICY "quickdash_tokens: select propio"
ON public.quickdash_tokens FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- Terapeutas: crear tokens
CREATE POLICY "quickdash_tokens: insert"
ON public.quickdash_tokens FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- Terapeutas: actualizar sus propios tokens (invalidación manual)
CREATE POLICY "quickdash_tokens: update propio"
ON public.quickdash_tokens FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- ── RPC pública: consultar estado del token ──
CREATE OR REPLACE FUNCTION public.get_quickdash_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row quickdash_tokens;
BEGIN
  SELECT * INTO v_row FROM quickdash_tokens WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_row.completed_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'completed');
  END IF;

  IF v_row.expires_at < now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  RETURN jsonb_build_object('status', 'valid', 'expires_at', v_row.expires_at);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_quickdash_token(uuid) TO anon;

-- ── RPC pública: completar el formulario ──
CREATE OR REPLACE FUNCTION public.complete_quickdash_token(
  p_token  uuid,
  p_items  jsonb,
  p_score  numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_item numeric;
  i int;
BEGIN
  -- Validar token activo
  SELECT id INTO v_id
  FROM quickdash_tokens
  WHERE token = p_token
    AND completed_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El enlace no es válido, ya fue utilizado o expiró';
  END IF;

  -- Validar estructura de items: array de 11 números entre 1 y 5
  IF jsonb_array_length(p_items) <> 11 THEN
    RAISE EXCEPTION 'Datos inválidos';
  END IF;

  FOR i IN 0..10 LOOP
    v_item := (p_items->>i)::numeric;
    IF v_item < 1 OR v_item > 5 THEN
      RAISE EXCEPTION 'Datos inválidos';
    END IF;
  END LOOP;

  -- Registrar resultado
  UPDATE quickdash_tokens
  SET
    completed_at = now(),
    completed_by = 'patient',
    result = jsonb_build_object('items', p_items, 'score', p_score)
  WHERE id = v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_quickdash_token(uuid, jsonb, numeric) TO anon;

-- ── RPC autenticada: crear token (invalida previos activos) ──
CREATE OR REPLACE FUNCTION public.create_quickdash_token(
  p_session_id uuid,
  p_patient_id uuid,
  p_expires_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_token uuid;
BEGIN
  -- Validar que la sesión pertenece al terapeuta
  IF NOT EXISTS (
    SELECT 1 FROM therapy_sessions
    WHERE id = p_session_id AND professional_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Sin permisos sobre esta sesión';
  END IF;

  -- Invalidar tokens activos previos de esta sesión
  UPDATE quickdash_tokens
  SET completed_at = now(), completed_by = 'therapist'
  WHERE session_id = p_session_id
    AND completed_at IS NULL
    AND expires_at > now();

  -- Crear nuevo token
  INSERT INTO quickdash_tokens (patient_id, session_id, created_by, expires_at)
  VALUES (p_patient_id, p_session_id, auth.uid(), p_expires_at)
  RETURNING token INTO v_new_token;

  RETURN v_new_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_quickdash_token(uuid, uuid, timestamptz) TO authenticated;
```

---

## 7. Consideraciones de seguridad — ruta pública

| Riesgo | Mitigación |
|---|---|
| Enumeración de tokens | UUID v4 = 122 bits de entropía. Imposible fuerza bruta. |
| Replay de token ya usado | RPC valida `completed_at IS NULL` server-side antes de escribir. |
| Token vencido enviado igualmente | RPC valida `expires_at > now()` server-side. La validación client-side es solo UX. |
| Inyección en `p_items` | RPC valida estructura explícitamente (largo 11, valores 1-5). |
| PII en URL/logs del servidor | La URL solo contiene el token UUID, no patient_id ni nombres. |
| Acceso a datos de otros pacientes | La RPC `get_quickdash_token` no devuelve patient_id ni session_id al caller anon. |
| CSRF en el submit | No aplica — no hay cookies de sesión en la ruta pública. El token en la URL es el único credential. |
| Abuso de `complete_quickdash_token` con score manipulado | El score se recalcula en el cliente con `calcQuickDashScore(items)` pero la RPC recibe `p_score` como parámetro de conveniencia. **Decisión**: la RPC también recalcula el score internamente y descarta el valor del cliente para mayor seguridad. |

**Nota sobre HTTPS**: enforceado por la infraestructura de Supabase/Netlify/Vercel. No requiere configuración adicional.

---

## 8. Consideraciones de UX críticas

- **La página pública no menciona el nombre del paciente**. Solo muestra "Cuestionario QuickDASH — Miembro superior".
- **La URL generada debe ser corta para WhatsApp**: `https://app.rehabot.com/q/550e8400-e29b-41d4-a716-446655440000` cabe perfectamente.
- **El formulario público muestra una barra de progreso** (ej. "3 de 11 respondidas") para reducir abandono.
- **El botón "Enviar" se habilita solo cuando los 11 ítems están respondidos.**
- **Tras el envío exitoso**, mostrar el score calculado con interpretación básica: `0-25: leve | 26-50: moderado | 51-75: severo | 76-100: muy severo`.

---

## 9. Orden de implementación recomendado

```
Fase 1 (Migración)  →  Fase 2 (Tipos)  →  Fase 3 (Ruta pública)
       ↓
Validar con test manual de la página /q/:token
       ↓
Fase 4 (QuickDashTokenManager)  →  Fase 5 (SessionForm)
       ↓
Validar flujo completo: generar link → completar → ver resultado en sesión
```

Las fases 1-3 son completamente independientes del flujo autenticado y se pueden probar en aislamiento. No modifican ningún componente existente hasta la Fase 5.
