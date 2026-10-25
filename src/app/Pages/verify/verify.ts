import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Registration } from '../../Core/registration';

/** Segundos que debe esperar antes de pedir otro código. */
const RESEND_SECONDS = 60;

@Component({
  selector: 'app-verify',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './verify.html',
  styleUrl: './verify.css',
})
export class Verify {
  private readonly router = inject(Router);
  private readonly registration = inject(Registration);
  private readonly destroyRef = inject(DestroyRef);
  private timer: ReturnType<typeof setInterval> | undefined;

  readonly email = this.registration.email;

  /** Código de 7 caracteres: solo letras y números. */
  readonly code = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^[A-Za-z0-9]{7}$/)],
  });

  readonly submitted = signal(false);
  readonly sending = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly cooldown = signal(0);

  constructor() {
    // Sin registro previo no hay nada que verificar.
    if (!this.email()) {
      this.router.navigate(['/register']);
      return;
    }
    this.startCooldown();
    this.destroyRef.onDestroy(() => clearInterval(this.timer));
  }

  error(): string | null {
    if (!(this.code.touched || this.submitted())) return null;
    if (this.code.hasError('required')) return 'Escribe el código que te enviamos.';
    if (this.code.hasError('pattern')) return 'El código tiene 7 caracteres, entre letras y números.';
    return null;
  }

  async onSubmit(): Promise<void> {
    this.submitted.set(true);
    this.serverError.set(null);
    if (this.code.invalid) {
      document.getElementById('code')?.focus();
      return;
    }

    this.sending.set(true);
    try {
      await this.registration.verifyCode(this.code.value.trim());
      await this.router.navigate(['/survey']);
    } catch {
      this.serverError.set('El código no es correcto o ya venció. Revísalo o pide uno nuevo.');
    } finally {
      this.sending.set(false);
    }
  }

  async resend(): Promise<void> {
    if (this.cooldown() > 0) return;
    this.serverError.set(null);
    try {
      await this.registration.resendCode();
      this.startCooldown();
    } catch {
      this.serverError.set('No pudimos enviar el código. Inténtalo de nuevo en un momento.');
    }
  }

  private startCooldown(): void {
    clearInterval(this.timer);
    this.cooldown.set(RESEND_SECONDS);
    this.timer = setInterval(() => {
      this.cooldown.update(s => s - 1);
      if (this.cooldown() <= 0) clearInterval(this.timer);
    }, 1000);
  }
}
