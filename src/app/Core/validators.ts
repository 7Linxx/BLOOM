import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Solo letras (con tildes y ñ), espacios, guion y apóstrofe. Para nombres y apellidos. */
export const NAME_PATTERN = /^\p{L}[\p{L}\s'’-]*$/u;

/** Fecha de hoy como YYYY-MM-DD, en hora local (no UTC). */
export function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Rechaza textos formados solo por espacios. */
export const notBlank: ValidatorFn = (c: AbstractControl): ValidationErrors | null =>
  typeof c.value === 'string' && c.value.length > 0 && c.value.trim() === '' ? { blank: true } : null;

/** La fecha no puede ser posterior a hoy. */
export const notFuture: ValidatorFn = (c) =>
  c.value && c.value > todayIso() ? { future: true } : null;

/** La fecha no puede ser anterior a 1900. */
export const notTooOld: ValidatorFn = (c) =>
  c.value && c.value < '1900-01-01' ? { tooOld: true } : null;

/**
 * Contraseña: mínimo 8 caracteres, con al menos una letra y un número.
 * Esta validación es solo para dar respuesta rápida en pantalla:
 * el backend debe volver a validar las mismas reglas.
 */
export const strongPassword: ValidatorFn = (c) => {
  const v: string = c.value ?? '';
  return v && !/^(?=.*\p{L})(?=.*\d).{8,}$/u.test(v) ? { weak: true } : null;
};

/** Grupo con `password` y `confirmar`: deben ser iguales. */
export const passwordsMatch: ValidatorFn = (g) =>
  g.get('password')?.value === g.get('confirmar')?.value ? null : { mismatch: true };

/** Grupo con `inicio` y `fin`: el fin no puede ser antes del inicio. */
export const endNotBeforeStart: ValidatorFn = (g) => {
  const inicio = g.get('inicio')?.value;
  const fin = g.get('fin')?.value;
  return inicio && fin && fin < inicio ? { endBeforeStart: true } : null;
};
