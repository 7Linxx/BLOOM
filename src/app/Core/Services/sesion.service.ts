import { Injectable, computed, signal } from '@angular/core';

import { Usuaria } from '../modelos';

@Injectable({ providedIn: 'root' })
export class Sesion {
  private readonly clave = 'bloom_sesion';

  private readonly _usuaria = signal<Usuaria | null>(this.leer());

  readonly usuaria = this._usuaria.asReadonly();

  readonly activa = computed(() => this._usuaria() !== null);

  get idUsuario(): number {
    const usuaria = this._usuaria();
    if (!usuaria) {
      throw new Error('No hay una sesión iniciada.');
    }
    return usuaria.idUsuario;
  }

  iniciar(usuaria: Usuaria): void {
    this._usuaria.set(usuaria);
    try {
      localStorage.setItem(this.clave, JSON.stringify(usuaria));
    } catch {
      // Si el navegador no deja guardar, la sesión dura solo mientras la pestaña esté abierta.
    }
  }

  actualizar(cambios: Partial<Usuaria>): void {
    const actual = this._usuaria();
    if (actual) {
      this.iniciar({ ...actual, ...cambios });
    }
  }

  cerrar(): void {
    this._usuaria.set(null);
    try {
      localStorage.removeItem(this.clave);
    } catch {
      // nada que hacer
    }
  }

  private leer(): Usuaria | null {
    try {
      const guardada = localStorage.getItem(this.clave);
      return guardada ? (JSON.parse(guardada) as Usuaria) : null;
    } catch {
      return null;
    }
  }
}
