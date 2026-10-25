import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly submitted = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  get email() { return this.form.controls.email; }
  get password() { return this.form.controls.password; }

  showError(control: AbstractControl): boolean {
    return control.invalid && (control.touched || this.submitted());
  }

  onSubmit(): void {
    this.submitted.set(true);
    if (this.form.invalid) return;

    // TODO: conectar con el servicio de autenticación cuando exista.
    // Por ahora solo navega al Home para poder probar el flujo.
    this.router.navigate(['/home']);
  }
}
