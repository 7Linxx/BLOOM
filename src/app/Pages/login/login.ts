import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { Registration } from '../../Core/registration';
import { BloomApi, ErrorApi, mensajeDeError } from '../../Core/Services/bloom-api.service';
import { Sesion } from '../../Core/Services/sesion.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly api = inject(BloomApi);
  private readonly sesion = inject(Sesion);
  private readonly registration = inject(Registration);

  readonly submitted = signal(false);
  readonly showPw = signal(false);
  readonly loading = signal(false);
  readonly errorMsg = signal('');
  readonly infoMsg = signal('');

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  get email() {
    return this.form.controls.email;
  }

  get password() {
    return this.form.controls.password;
  }

  showError(control: AbstractControl): boolean {
    return control.invalid && (control.touched || this.submitted());
  }

  forgotPassword(): void {
    this.errorMsg.set('');
    this.infoMsg.set('Muy pronto podrás recuperar tu contraseña ♡');
  }

  async onSubmit(): Promise<void> {
    this.submitted.set(true);
    this.errorMsg.set('');
    this.infoMsg.set('');

    if (this.form.invalid) {
      return;
    }

    this.loading.set(true);
    const email = this.form.controls.email.value.trim().toLowerCase();

    try {
      const usuaria = await this.api.iniciarSesion(email, this.form.controls.password.value);

      if (!usuaria.encuestaCompletada) {
        this.registration.startSurvey(usuaria.correoElectronico, usuaria.apodo, usuaria.idUsuario);
        await this.router.navigate(['/encuesta']);
        return;
      }

      this.sesion.iniciar(usuaria);
      await this.router.navigate(['/home']);
    } catch (error) {
      if (error instanceof ErrorApi && error.estado === 403) {
        // El código del registro pudo haber vencido: se pide uno nuevo antes de ir a verificar.
        this.registration.startVerification(email);
        try {
          await this.api.solicitarCodigo(email);
        } catch {
          // Si falla, en /verificar puede pedirlo otra vez con "Reenviar código".
        }
        await this.router.navigate(['/verificar']);
        return;
      }
      this.errorMsg.set(mensajeDeError(error, 'No pudimos iniciar sesión. Inténtalo de nuevo.'));
    } finally {
      this.loading.set(false);
    }
  }
}
