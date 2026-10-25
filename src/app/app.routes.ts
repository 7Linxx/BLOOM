import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'verify',
    title: 'Bloom | Verificar correo',
    loadComponent: () => import('./Pages/verify/verify').then(m => m.Verify),
  },
  {
    path: 'survey',
    title: 'Bloom | Encuesta inicial',
    loadComponent: () => import('./Pages/survey/survey').then(m => m.Survey),
  },
  {
    path: 'login',
    title: 'Bloom | Ingresar',
    loadComponent: () => import('./Pages/login/login').then(m => m.Login),
  },
  {
    path: 'register',
    title: 'Bloom | Crear cuenta',
    loadComponent: () => import('./Pages/register/register').then(m => m.Register),
  },
  {
    path: 'home',
    title: 'Bloom | Home',
    loadComponent: () => import('./Pages/home/home').then(m => m.Home),
  },
  {
    path: 'calendar',
    title: 'Bloom | Calendario',
    loadComponent: () => import('./Pages/calendar/calendar').then(m => m.Calendar),
  },
  {
    path: 'analisis',
    title: 'Bloom | Análisis',
    loadComponent: () => import('./Pages/analisis/analisis').then(m => m.Analisis),
  },
  {
    path: 'care',
    title: 'Bloom | Auto cuidado',
    loadComponent: () => import('./Pages/care/care').then(m => m.Care),
  },
  {
    path: 'about',
    title: 'Bloom | Sobre nosotros',
    loadComponent: () => import('./Pages/about/about').then(m => m.About),
  },
  { path: '**', redirectTo: 'home' },
];
