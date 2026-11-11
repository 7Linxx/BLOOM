import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { Sesion } from '../../Core/Services/sesion.service';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  private readonly sesion = inject(Sesion);
  private readonly router = inject(Router);

  async cerrarSesion(): Promise<void> {
    await this.sesion.cerrar();
    await this.router.navigate(['/login']);
  }
}
