import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

/** Modo claro / oscuro. Guarda la preferencia y respeta la del sistema la primera vez. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly KEY = 'bloom-theme';
  readonly theme = signal<Theme>('light');

  constructor() {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(this.KEY);
    } catch {
      /* almacenamiento no disponible */
    }
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    this.apply(saved === 'dark' || saved === 'light' ? saved : prefersDark ? 'dark' : 'light');
  }

  toggle(): void {
    this.apply(this.theme() === 'dark' ? 'light' : 'dark');
  }

  private apply(t: Theme): void {
    this.theme.set(t);
    document.documentElement.setAttribute('data-theme', t);
    try {
      localStorage.setItem(this.KEY, t);
    } catch {
      /* ignorar */
    }
  }
}
