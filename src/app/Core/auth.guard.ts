import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Sesion } from './Services/sesion.service';

/**
 * Impide entrar a las páginas internas (home, calendario, registro, estadísticas, artículos, perfil)
 * si no hay sesión iniciada: manda al login.
 */
export const authGuard: CanActivateFn = () => {
  const sesion = inject(Sesion);
  const router = inject(Router);
  return sesion.activa() ? true : router.createUrlTree(['/login']);
};
