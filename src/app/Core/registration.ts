import { Injectable, signal } from '@angular/core';

export interface RegisterData {
  primerNombre: string;
  segundoNombre: string;
  primerApellido: string;
  segundoApellido: string;
  apodo: string;
  fechaNacimiento: string;
  email: string;
  password: string;
}

export type CycleMode = 'ambos' | 'duraciones' | 'fechas' | 'ninguno';

export type MenstrualFlow =
  | 'ligero'
  | 'moderado'
  | 'abundante'
  | 'variable'
  | 'no_se';

export interface SurveyData {
  alturaCm: number | null;
  pesoKg: number | null;
  horasSueno: number | null;

  modoCiclo: CycleMode;
  duracionCiclo: number | null;
  duracionPeriodo: number | null;

  ciclos: {
    inicio: string;
    fin: string | null;
  }[];

  sintomas: string[];
  flujoMenstrual: MenstrualFlow | null;
}

/**
 * Guarda en memoria el avance del registro:
 * registro → verificación → encuesta.
 *
 * Todo es de PROTOTIPO. Cada método tiene pendiente
 * la conexión con el backend.
 */
@Injectable({ providedIn: 'root' })
export class Registration {
  private readonly _email = signal<string | null>(null);
  private readonly _nickname = signal<string | null>(null);
  private readonly _verified = signal(false);

  readonly email = this._email.asReadonly();
  readonly nickname = this._nickname.asReadonly();
  readonly verified = this._verified.asReadonly();

  /**
   * Crea la cuenta y dispara el envío del código al correo.
   */
  async register(data: RegisterData): Promise<void> {
    // TODO: POST /auth/register con data.
    this._email.set(data.email);
    this._nickname.set(data.apodo);
    this._verified.set(false);
  }

  /**
   * Comprueba el código de 7 caracteres.
   */
  async verifyCode(code: string): Promise<void> {
    // TODO: POST /auth/verify con { email, code }.
    void code;
    this._verified.set(true);
  }

  /**
   * Pide un código nuevo para el mismo correo.
   */
  async resendCode(): Promise<void> {
    // TODO: POST /auth/resend con { email }.
  }

  /**
   * Guarda las respuestas de la encuesta inicial.
   */
  async saveSurvey(data: SurveyData): Promise<void> {
    // TODO: POST /users/me/survey con data.
    void data;
    this.reset();
  }

  reset(): void {
    this._email.set(null);
    this._nickname.set(null);
    this._verified.set(false);
  }
}
