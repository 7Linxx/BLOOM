import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { Registration } from '../../Core/registration';

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
      Validators.pattern(/^[A-Za-z0-9]{7}$/),
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
      return 'El código debe tener 7 caracteres entre letras y números.';
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
      await this.router.navigate(['/encuesta']);
    } catch {
      this.serverError.set(
        'El código no es correcto o ya venció. Revísalo o pide uno nuevo.',
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
    } catch {
      this.serverError.set(
        'No pudimos enviar el código. Inténtalo de nuevo en un momento.',
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
