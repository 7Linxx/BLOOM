import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const NAME_PATTERN = /^\p{L}[\p{L}\s'’-]*$/u;

export function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export const notBlank: ValidatorFn = (c: AbstractControl): ValidationErrors | null =>
  typeof c.value === 'string' && c.value.length > 0 && c.value.trim() === '' ? { blank: true } : null;

export const notFuture: ValidatorFn = (c) =>
  c.value && c.value > todayIso() ? { future: true } : null;

export const notTooOld: ValidatorFn = (c) =>
  c.value && c.value < '1900-01-01' ? { tooOld: true } : null;

export const strongPassword: ValidatorFn = (c) => {
  const v: string = c.value ?? '';
  return v && !/^(?=.*\p{L})(?=.*\d).{8,}$/u.test(v) ? { weak: true } : null;
};

export const passwordsMatch: ValidatorFn = (g) =>
  g.get('password')?.value === g.get('confirmar')?.value ? null : { mismatch: true };

export const endNotBeforeStart: ValidatorFn = (g) => {
  const inicio = g.get('inicio')?.value;
  const fin = g.get('fin')?.value;
  return inicio && fin && fin < inicio ? { endBeforeStart: true } : null;
};
