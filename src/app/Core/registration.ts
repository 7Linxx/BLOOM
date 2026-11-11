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

interface Avance {
  email: string | null;
  nickname: string | null;
  idUsuario: number | null;
  verified: boolean;
}

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

  startVerification(email: string): void {
    this._email.set(email);
    this._nickname.set(null);
    this._idUsuario = null;
    this._verified.set(false);
    this.guardarAvance();
  }

  startSurvey(email: string, nickname: string, idUsuario: number): void {
    this._email.set(email);
    this._nickname.set(nickname);
    this._idUsuario = idUsuario;
    this._verified.set(true);
    this.guardarAvance();
  }

  async verifyCode(code: string): Promise<void> {
    const email = this._email();
    if (!email) {
      throw new Error('No hay un correo pendiente de verificar.');
    }
    await this.api.verificarCodigo(email, code);
    this._verified.set(true);
    this.guardarAvance();
  }

  async resendCode(): Promise<void> {
    const email = this._email();
    if (email) {
      await this.api.solicitarCodigo(email);
    }
  }

  get hasUserId(): boolean {
    return this._idUsuario !== null;
  }

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
