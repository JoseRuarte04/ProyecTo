// Validación de campos del alta de pacientes, extraída de
// src/components/patients/NewPatientForm.tsx para poder testearla sin
// renderizar nada (ver src/lib/newPatientValidation.test.ts). Extracción
// mecánica, sin cambios de comportamiento — la única diferencia con el
// código original es que `fieldError` recibe `documentType` como parámetro
// en vez de capturarlo del closure del componente (necesario para que la
// función sea pura).

export const REQUIRED_MSG = "Este campo es obligatorio";
export const PHONE_MSG = "El teléfono solo puede contener números y el signo + (ej: +54 11 1234-5678)";
export const EMAIL_MSG = "Ingresá un email válido (ej: nombre@dominio.com)";

export const isValidDni = (v: string) => /^\d{7,8}$/.test(v.trim());
export const isValidName = (v: string) => !v.trim() || /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s'-]+$/.test(v.trim());
export const isValidPhone = (v: string) => !v.trim() || /^[+\d][\d\s\-()+]*$/.test(v.trim());
export const isValidEmail = (v: string) => !v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

// Mensaje de error de un campo para un valor dado ("" = válido). Lo usan la
// validación al salir del campo y "Siguiente"/"Confirmar y guardar", así
// los mensajes son siempre los mismos.
export function fieldError(field: string, v: string, documentType: string): string {
  switch (field) {
    case "lastName":
      if (!v.trim()) return REQUIRED_MSG;
      return isValidName(v) ? "" : "El apellido solo puede contener letras";
    case "firstName":
      if (!v.trim()) return REQUIRED_MSG;
      return isValidName(v) ? "" : "El nombre solo puede contener letras";
    case "dni":
      if (!v.trim()) return REQUIRED_MSG;
      return documentType === "dni" && !isValidDni(v) ? "El DNI debe tener 7 u 8 números, sin letras ni símbolos" : "";
    case "birthDate":
    case "admissionDate":
      return v ? "" : REQUIRED_MSG;
    case "nationality":
      return v.trim() ? "" : REQUIRED_MSG;
    case "phone":
    case "emergencyPhone":
      return !v || isValidPhone(v) ? "" : PHONE_MSG;
    case "email":
      return !v || isValidEmail(v) ? "" : EMAIL_MSG;
    default:
      return "";
  }
}

export const STEP1_FIELDS = ["lastName", "firstName", "dni", "birthDate", "nationality", "admissionDate"];
export const STEP3_FIELDS = ["phone", "email", "emergencyPhone"];
