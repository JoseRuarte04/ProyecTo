import { describe, it, expect } from "vitest";
import {
  isValidDni,
  isValidName,
  isValidPhone,
  isValidEmail,
  fieldError,
  REQUIRED_MSG,
  PHONE_MSG,
  EMAIL_MSG,
  STEP1_FIELDS,
  STEP3_FIELDS,
} from "./newPatientValidation";

describe("isValidDni", () => {
  it("acepta 7 u 8 dígitos", () => {
    expect(isValidDni("1234567")).toBe(true);
    expect(isValidDni("12345678")).toBe(true);
  });

  it("rechaza menos de 7 o más de 8 dígitos", () => {
    expect(isValidDni("123456")).toBe(false);
    expect(isValidDni("123456789")).toBe(false);
  });

  it("rechaza letras o símbolos", () => {
    expect(isValidDni("1234567a")).toBe(false);
    expect(isValidDni("RLS-TEST-00000001")).toBe(false);
  });

  it("ignora espacios al borde", () => {
    expect(isValidDni("  12345678  ")).toBe(true);
  });
});

describe("isValidName/isValidPhone/isValidEmail", () => {
  it("isValidName acepta vacío (lo required lo maneja fieldError) y letras con acentos/ñ", () => {
    expect(isValidName("")).toBe(true);
    expect(isValidName("María José Ñandú-Pérez")).toBe(true);
  });

  it("isValidName rechaza números o símbolos que no sean espacio/guion/apóstrofe", () => {
    expect(isValidName("Jose2")).toBe(false);
    expect(isValidName("Jose@")).toBe(false);
  });

  it("isValidPhone acepta dígitos, +, espacios, guiones y paréntesis", () => {
    expect(isValidPhone("+54 11 1234-5678")).toBe(true);
    expect(isValidPhone("011 (11) 1234-5678")).toBe(true);
  });

  it("isValidPhone exige que arranque con un dígito o un '+' (un paréntesis primero no es válido)", () => {
    // Regex real: /^[+\d][\d\s\-()+]*$/ — el primer carácter NO acepta "(".
    expect(isValidPhone("(011) 1234-5678")).toBe(false);
  });

  it("isValidPhone rechaza letras", () => {
    expect(isValidPhone("abc1234567")).toBe(false);
  });

  it("isValidEmail acepta un email con formato básico válido", () => {
    expect(isValidEmail("paciente@example.com")).toBe(true);
  });

  it("isValidEmail rechaza sin @ o sin dominio", () => {
    expect(isValidEmail("paciente_example.com")).toBe(false);
    expect(isValidEmail("paciente@example")).toBe(false);
  });
});

describe("fieldError", () => {
  it("lastName/firstName vacíos son obligatorios", () => {
    expect(fieldError("lastName", "", "dni")).toBe(REQUIRED_MSG);
    expect(fieldError("firstName", "   ", "dni")).toBe(REQUIRED_MSG);
  });

  it("lastName/firstName con números da error de formato, no required", () => {
    expect(fieldError("lastName", "Perez2", "dni")).toBe("El apellido solo puede contener letras");
    expect(fieldError("firstName", "Jose2", "dni")).toBe("El nombre solo puede contener letras");
  });

  // Caso real del P1 de producción (PR #62, 2026-10-08): el alta guardaba el
  // paciente aunque fallaran los inserts de diagnóstico/ficha. La validación
  // del DNI es la primera línea de defensa de datos limpios en el alta.
  it("dni vacío es obligatorio", () => {
    expect(fieldError("dni", "", "dni")).toBe(REQUIRED_MSG);
  });

  it("dni con formato inválido solo importa si documentType es 'dni'", () => {
    expect(fieldError("dni", "abc", "dni")).toBe("El DNI debe tener 7 u 8 números, sin letras ni símbolos");
    expect(fieldError("dni", "abc", "pasaporte")).toBe("");
  });

  it("dni válido (7-8 dígitos) con documentType 'dni' no da error", () => {
    expect(fieldError("dni", "12345678", "dni")).toBe("");
  });

  it("birthDate/admissionDate vacíos son obligatorios", () => {
    expect(fieldError("birthDate", "", "dni")).toBe(REQUIRED_MSG);
    expect(fieldError("admissionDate", "", "dni")).toBe(REQUIRED_MSG);
  });

  it("nationality vacía (o solo espacios) es obligatoria", () => {
    expect(fieldError("nationality", "", "dni")).toBe(REQUIRED_MSG);
    expect(fieldError("nationality", "   ", "dni")).toBe(REQUIRED_MSG);
  });

  it("phone/emergencyPhone vacíos NO son obligatorios (a diferencia de dni/nombre)", () => {
    expect(fieldError("phone", "", "dni")).toBe("");
    expect(fieldError("emergencyPhone", "", "dni")).toBe("");
  });

  it("phone con formato inválido da PHONE_MSG", () => {
    expect(fieldError("phone", "telefono-invalido-abc", "dni")).toBe(PHONE_MSG);
  });

  it("email vacío NO es obligatorio, pero con formato inválido da EMAIL_MSG", () => {
    expect(fieldError("email", "", "dni")).toBe("");
    expect(fieldError("email", "no-es-un-email", "dni")).toBe(EMAIL_MSG);
  });

  it("un campo sin regla definida no da error", () => {
    expect(fieldError("campo_inexistente", "cualquier cosa", "dni")).toBe("");
  });
});

describe("STEP1_FIELDS/STEP3_FIELDS", () => {
  it("STEP1_FIELDS son los campos obligatorios del paso 1 (datos personales)", () => {
    expect(STEP1_FIELDS).toEqual(["lastName", "firstName", "dni", "birthDate", "nationality", "admissionDate"]);
  });

  it("STEP3_FIELDS son los campos validables del paso 3 (contacto)", () => {
    expect(STEP3_FIELDS).toEqual(["phone", "email", "emergencyPhone"]);
  });
});
