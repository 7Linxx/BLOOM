import { Injectable, computed, signal } from '@angular/core';

import { Usuaria } from '../modelos';

/**
 * Guarda quién inició sesión.
 * El backend NO usa token: el login devuelve los datos de la usuaria y el front guarda su idUsuario
 * (así está decidido en UsuariaService.iniciarSesion). Se guarda en localStorage para no perder la sesión al recargar.
 */
@Injectable({ providedIn: 'root' })
export class Sesion {
  private readonly clave = 'bloom_sesion';

  private readonly _usuaria = signal<Usuaria | null>(this.leer());

  /** Usuaria que inició sesión (o null). */
  readonly usuaria = this._usuaria.asReadonly();

  /** true si hay una usuaria con sesión iniciada. */
  readonly activa = computed(() => this._usuaria() !== null);

  /** id de la usuaria (lo piden casi todas las rutas del backend). Lanza error si no hay sesión. */
  get idUsuario(): number {
    const usuaria = this._usuaria();
    if (!usuaria) {
      throw new Error('No hay una sesión iniciada.');
    }
    return usuaria.idUsuario;
  }

  /** Guarda la usuaria que devolvió el backend (login, o después de la encuesta). */
  iniciar(usuaria: Usuaria): void {
    this._usuaria.set(usuaria);
    try {
      localStorage.setItem(this.clave, JSON.stringify(usuaria));
    } catch {
      // Si el navegador no deja guardar, la sesión dura solo mientras la pestaña esté abierta.
    }
  }

  /** Actualiza datos de la usuaria guardada (por ejemplo, el apodo después de cambiarlo en el perfil). */
  actualizar(cambios: Partial<Usuaria>): void {
    const actual = this._usuaria();
    if (actual) {
      this.iniciar({ ...actual, ...cambios });
    }
  }

  /** Cierra la sesión. */
  cerrar(): void {
    this._usuaria.set(null);
    try {
      localStorage.removeItem(this.clave);
    } catch {
      // nada que hacer
    }
  }

  /** Lee la sesión guardada al abrir la página. */
  private leer(): Usuaria | null {
    try {
      const guardada = localStorage.getItem(this.clave);
      return guardada ? (JSON.parse(guardada) as Usuaria) : null;
    } catch {
      return null;
    }
  }
}
