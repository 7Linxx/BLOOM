import { Component, signal, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {Navbar} from './Layout/navbar/navbar';
import {Footer} from './Layout/footer/footer';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs';


@Component({
  imports: [RouterOutlet, Navbar, Footer],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('BLOOM');
  private readonly router = inject(Router);
  private readonly authRoutes = ['/login', '/register', '/verify', '/survey'];
  readonly showLayout = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => !this.authRoutes.some(r => e.urlAfterRedirects.startsWith(r))),
      startWith(!this.authRoutes.some(r => this.router.url.startsWith(r))),
    ),
    { requireSync: true },
  );
}
