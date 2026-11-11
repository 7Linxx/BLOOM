import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { Registration } from '../../Core/registration';
import { mensajeDeError } from '../../Core/Services/bloom-api.service';

const RESEND_SECONDS = 60;

@Component({
  selector: 'app-verificar',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './verificar.html',
  styleUrl: './verificar.css',
})
export class Verificar {
  private readonly router = inject(Router);
  private readonly registration = inject(Registration);
  private readonly destroyRef = inject(DestroyRef);

  private timer: ReturnType<typeof setInterval> | undefined;

  readonly email = this.registration.email;

  readonly code = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      // El backend genera códigos de 6 dígitos (UsuariaService.generarCodigo).
      Validators.pattern(/^[0-9]{6}$/),
    ],
  });

  readonly submitted = signal(false);
  readonly sending = signal(false);
  readonly resending = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly cooldown = signal(0);

  constructor() {
    if (!this.email()) {
      this.router.navigate(['/register']);
      return;
    }

    this.startCooldown();

    this.destroyRef.onDestroy(() => {
      if (this.timer) {
        clearInterval(this.timer);
      }
    });
  }

  error(): string | null {
    if (!(this.code.touched || this.submitted())) {
      return null;
    }

    if (this.code.hasError('required')) {
      return 'Escribe el código que te enviamos.';
    }

    if (this.code.hasError('pattern')) {
      return 'El código debe tener 6 números.';
    }

    return null;
  }

  async onSubmit(): Promise<void> {
    this.submitted.set(true);
    this.serverError.set(null);

    if (this.code.invalid) {
      this.code.markAsTouched();
      document.getElementById('code')?.focus();
      return;
    }

    this.sending.set(true);

    try {
      await this.registration.verifyCode(this.code.value.trim());
      // Si vino del registro se sabe su id y sigue a la encuesta.
      // Si vino del login (cuenta sin verificar), vuelve a iniciar sesión para saber quién es.
      if (this.registration.hasUserId) {
        await this.router.navigate(['/encuesta']);
      } else {
        this.registration.reset();
        await this.router.navigate(['/login']);
      }
    } catch (error) {
      // 400 = código incorrecto, 410 = código vencido (el backend manda el mensaje).
      this.serverError.set(
        mensajeDeError(error, 'El código no es correcto o ya venció. Revísalo o pide uno nuevo.'),
      );
    } finally {
      this.sending.set(false);
    }
  }

  async resend(): Promise<void> {
    if (this.cooldown() > 0 || this.resending()) {
      return;
    }

    this.serverError.set(null);
    this.resending.set(true);

    try {
      await this.registration.resendCode();
      this.code.reset();
      this.submitted.set(false);
      this.startCooldown();
    } catch (error) {
      this.serverError.set(
        mensajeDeError(error, 'No pudimos enviar el código. Inténtalo de nuevo en un momento.'),
      );
    } finally {
      this.resending.set(false);
    }
  }

  private startCooldown(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.cooldown.set(RESEND_SECONDS);

    this.timer = setInterval(() => {
      this.cooldown.update(seconds => Math.max(0, seconds - 1));

      if (this.cooldown() <= 0 && this.timer) {
        clearInterval(this.timer);
        this.timer = undefined;
      }
    }, 1000);
  }
}
