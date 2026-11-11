import { Injectable, inject, signal } from '@angular/core';

import { BloomApi } from './Services/bloom-api.service';
import { Sesion } from './Services/sesion.service';
import { EncuestaInicial } from './modelos';

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

/** Datos del registro en curso que se guardan en sessionStorage (así no se pierden si recargan la página). */
interface Avance {
  email: string | null;
  nickname: string | null;
  idUsuario: number | null;
  verified: boolean;
}

/**
 * Guarda el avance del registro: registro → verificación → encuesta, y llama al backend en cada paso.
 */
@Injectable({ providedIn: 'root' })
export class Registration {
  private readonly api = inject(BloomApi);
  private readonly sesion = inject(Sesion);

  private readonly clave = 'bloom_registro';

  private readonly _email = signal<string | null>(null);
  private readonly _nickname = signal<string | null>(null);
  private readonly _verified = signal(false);
  private _idUsuario: number | null = null;

  readonly email = this._email.asReadonly();
  readonly nickname = this._nickname.asReadonly();
  readonly verified = this._verified.asReadonly();

  constructor() {
    this.leerAvance();
  }

  /**
   * Crea la cuenta (POST /autenticacion/registrar). El backend envía el código de 6 dígitos al correo.
   */
  async register(data: RegisterData): Promise<void> {
    const usuaria = await this.api.registrar({
      primerNombre: data.primerNombre,
      segundoNombre: data.segundoNombre || null,
      primerApellido: data.primerApellido,
      segundoApellido: data.segundoApellido || null,
      apodo: data.apodo,
      fechaNacimiento: data.fechaNacimiento,
      correoElectronico: data.email,
      contrasenia: data.password,
    });
    this._email.set(usuaria.correoElectronico);
    this._nickname.set(usuaria.apodo);
    this._idUsuario = usuaria.idUsuario;
    this._verified.set(false);
    this.guardarAvance();
  }

  /**
   * La usuaria intentó iniciar sesión sin haber verificado el correo (el backend respondió 403):
   * se guarda su correo para que la pantalla de verificación sepa a quién verificar.
   */
  startVerification(email: string): void {
    this._email.set(email);
    this._nickname.set(null);
    this._idUsuario = null;
    this._verified.set(false);
    this.guardarAvance();
  }

  /**
   * La usuaria inició sesión pero no ha llenado la encuesta (encuestaCompletada = false):
   * se marca como verificada para que la pantalla de la encuesta la deje pasar.
   */
  startSurvey(email: string, nickname: string, idUsuario: number): void {
    this._email.set(email);
    this._nickname.set(nickname);
    this._idUsuario = idUsuario;
    this._verified.set(true);
    this.guardarAvance();
  }

  /**
   * Comprueba el código de 6 dígitos (POST /autenticacion/enviar-codigo).
   */
  async verifyCode(code: string): Promise<void> {
    const email = this._email();
    if (!email) {
      throw new Error('No hay un correo pendiente de verificar.');
    }
    await this.api.verificarCodigo(email, code);
    this._verified.set(true);
    this.guardarAvance();
  }

  /**
   * Pide un código nuevo para el mismo correo (POST /autenticacion/solicitar-codigo).
   */
  async resendCode(): Promise<void> {
    const email = this._email();
    if (email) {
      await this.api.solicitarCodigo(email);
    }
  }

  /** true si se sabe el id de la usuaria (vino del registro o del login). */
  get hasUserId(): boolean {
    return this._idUsuario !== null;
  }

  /**
   * Guarda las respuestas de la encuesta inicial (POST /usuarias/{id}/encuesta) y deja la sesión iniciada.
   *
   * Diferencias con el backend (ver el documento de revisión):
   *  - La altura se pide en cm y el backend la guarda en metros: se divide entre 100.
   *  - El backend tiene 2 opciones: duraciones (ingresoRango = true) o fechas de 1 a 3 ciclos (ingresoRango = false).
   *    "ambos" se envía como fechas (las duraciones van como dato extra). "ninguno" el backend lo rechaza.
   *  - Si una menstruación no tiene fecha de fin, se calcula con la duración del periodo (o 5 días),
   *    porque el backend exige las dos fechas.
   *  - Síntomas y flujo de la encuesta NO se envían: la tabla encuesta_inicial no tiene esas columnas.
   */
  async saveSurvey(data: SurveyData): Promise<void> {
    if (this._idUsuario === null) {
      throw new Error('No se sabe qué usuaria está llenando la encuesta. Inicia sesión otra vez.');
    }
    const duracionPeriodo = data.duracionPeriodo ?? 5;
    const encuesta: EncuestaInicial = {
      altura: data.alturaCm !== null ? data.alturaCm / 100 : null,
      peso: data.pesoKg,
      horasSueno: data.horasSueno,
      ingresoRango: data.modoCiclo === 'duraciones',
      duracionCiclo: data.duracionCiclo,
      duracionMenstruacion: data.duracionPeriodo,
      ciclosIniciales: data.ciclos.map(ciclo => ({
        fechaInicioMenstruacion: ciclo.inicio,
        fechaFinMenstruacion: ciclo.fin ?? this.sumarDias(ciclo.inicio, duracionPeriodo - 1),
      })),
    };
    await this.api.llenarEncuesta(this._idUsuario, encuesta);

    // La encuesta quedó guardada: se trae la usuaria actualizada y se inicia la sesión.
    const usuaria = await this.api.verUsuaria(this._idUsuario);
    this.sesion.iniciar(usuaria);
    this.reset();
  }

  reset(): void {
    this._email.set(null);
    this._nickname.set(null);
    this._idUsuario = null;
    this._verified.set(false);
    try {
      sessionStorage.removeItem(this.clave);
    } catch {
      // nada que hacer
    }
  }

  /** Suma días a una fecha 'AAAA-MM-DD'. */
  private sumarDias(fecha: string, dias: number): string {
    const [anio, mes, dia] = fecha.split('-').map(Number);
    const resultado = new Date(anio, mes - 1, dia + dias);
    const mm = String(resultado.getMonth() + 1).padStart(2, '0');
    const dd = String(resultado.getDate()).padStart(2, '0');
    return `${resultado.getFullYear()}-${mm}-${dd}`;
  }

  private guardarAvance(): void {
    const avance: Avance = {
      email: this._email(),
      nickname: this._nickname(),
      idUsuario: this._idUsuario,
      verified: this._verified(),
    };
    try {
      sessionStorage.setItem(this.clave, JSON.stringify(avance));
    } catch {
      // Si no se puede guardar, el avance solo dura mientras no se recargue la página.
    }
  }

  private leerAvance(): void {
    try {
      const guardado = sessionStorage.getItem(this.clave);
      if (guardado) {
        const avance = JSON.parse(guardado) as Avance;
        this._email.set(avance.email);
        this._nickname.set(avance.nickname);
        this._idUsuario = avance.idUsuario;
        this._verified.set(avance.verified);
      }
    } catch {
      // sin avance guardado
    }
  }
}
