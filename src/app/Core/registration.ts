import { Injectable, signal } from '@angular/core';

export interface RegisterData {
  primerNombre: string;
  segundoNombre: string;
  primerApellido: string;
  segundoApellido: string;
  /** Si la usuaria no lo escribe, ya llega con el primer nombre. */
  apodo: string;
  fechaNacimiento: string;   // YYYY-MM-DD
  email: string;
  password: string;
}

export type CycleMode = 'duraciones' | 'fechas' | 'ninguno';

export interface SurveyData {
  alturaCm: number | null;
  pesoKg: number | null;
  horasSueno: number | null;
  modoCiclo: CycleMode;
  duracionCiclo: number | null;
  duracionPeriodo: number | null;
  /** Hasta 3 ciclos, el más reciente primero. `fin` es null si no lo recuerda. */
  ciclos: { inicio: string; fin: string | null }[];
}

/**
 * Guarda en memoria el avance del registro (registro → verificación → encuesta)
 * y es el único lugar que hablará con el backend.
 *
 * Todo es de PROTOTIPO: cada método tiene un TODO con la llamada que falta.
 * Al recargar la página el avance se pierde, y las pantallas mandan de nuevo al registro.
 */
@Injectable({ providedIn: 'root' })
export class Registration {
  private readonly _email = signal<string | null>(null);
  private readonly _nickname = signal<string | null>(null);
  private readonly _verified = signal(false);

  readonly email = this._email.asReadonly();
  readonly nickname = this._nickname.asReadonly();
  readonly verified = this._verified.asReadonly();

  /** Crea la cuenta y dispara el envío del código al correo. */
  async register(data: RegisterData): Promise<void> {
    // TODO: POST /auth/register con `data`.
    //  - El correo es único: si ya existe, lanzar un error para mostrarlo en pantalla.
    //  - El backend envía el código alfanumérico de 7 caracteres al correo.
    //  - La contraseña no se guarda aquí, solo se envía.
    this._email.set(data.email);
    this._nickname.set(data.apodo);
    this._verified.set(false);
  }

  /** Comprueba el código de 7 caracteres. */
  async verifyCode(code: string): Promise<void> {
    // TODO: POST /auth/verify con { email, code }. Si el código es incorrecto o venció, lanzar un error.
    // Mientras no exista el backend, acepta cualquier código con formato válido.
    void code;
    this._verified.set(true);
  }

  /** Pide un código nuevo para el mismo correo. */
  async resendCode(): Promise<void> {
    // TODO: POST /auth/resend con { email }.
  }

  /** Guarda las respuestas de la encuesta inicial. */
  async saveSurvey(data: SurveyData): Promise<void> {
    // TODO: POST /users/me/survey con `data`.
    void data;
    this.reset();
  }

  reset(): void {
    this._email.set(null);
    this._nickname.set(null);
    this._verified.set(false);
  }
}
