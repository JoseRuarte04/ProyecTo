import { Link } from "react-router-dom";

// BORRADOR — pendiente de revisión de Jose antes de la beta. Falta en particular el
// email de contacto real (hoy placeholder) y una lectura legal si se considera
// necesaria para datos de salud bajo la Ley 25.326.
export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-1">
          <p className="font-serif text-2xl font-semibold text-foreground">HisTO</p>
          <h1 className="text-xl font-semibold text-foreground">
            Política de privacidad (borrador)
          </h1>
          <p className="text-sm text-muted-foreground">
            Última actualización: 6 de octubre de 2026 · versión de beta cerrada
          </p>
        </div>

        <div className="space-y-5 text-sm leading-relaxed text-foreground">
          <section className="space-y-2">
            <h2 className="font-semibold">Qué datos guardamos</h2>
            <p>
              Guardamos los datos que vos (como profesional) cargás sobre tus pacientes
              para poder darte el servicio: datos de la ficha clínica, sesiones,
              evaluaciones, turnos, archivos que subís, y los datos de tu propia cuenta
              (nombre, email, especialidad).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">Dónde se alojan</h2>
            <p>
              La base de datos y los archivos se alojan en infraestructura de Supabase
              (región Brasil) y la aplicación corre en Vercel — ambos son proveedores
              con servidores fuera de Argentina. No tenemos un servidor propio dentro
              del país.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">Quién accede</h2>
            <p>
              Cada profesional ve únicamente a sus propios pacientes (o los de su
              equipo, si trabaja en uno) — así está construido el sistema a nivel de
              base de datos, no solo a nivel de pantalla. El equipo que mantiene
              HisTO puede acceder a la base para soporte técnico o resolver un
              problema puntual, nunca para otro fin.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">Cómo pedir el borrado de tus datos</h2>
            <p>
              Si querés que borremos tu cuenta y los datos asociados, escribinos a{" "}
              <span className="font-medium">[COMPLETAR: email de contacto]</span>.
              Vamos a confirmar el pedido y darte un plazo estimado antes de borrar
              nada.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">Responsabilidad del profesional</h2>
            <p>
              Si sos profesional y cargás datos de un paciente en este sistema, sos
              responsable de tener el consentimiento de ese paciente para hacerlo —
              HisTO es una herramienta de gestión para tu consultorio, no reemplaza el
              consentimiento que tenés que pedirle vos a cada paciente.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">Contacto</h2>
            <p>
              <span className="font-medium">[COMPLETAR: email de contacto]</span>
            </p>
          </section>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          <Link to="/login" className="underline underline-offset-2 hover:text-foreground">
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
