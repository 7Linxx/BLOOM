import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Sesion } from './Services/sesion.service';

export const authGuard: CanActivateFn = () => {
  const sesion = inject(Sesion);
  const router = inject(Router);
  return sesion.activa() ? true : router.createUrlTree(['/login']);
};
