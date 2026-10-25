import { NgTemplateOutlet } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Registration, RegisterData } from '../../Core/registration';
import {
  NAME_PATTERN,
  notBlank,
  notFuture,
  notTooOld,
  passwordsMatch,
  strongPassword,
  todayIso,
} from '../../Core/validators';

type FieldName =
  | 'primerNombre' | 'segundoNombre' | 'primerApellido' | 'segundoApellido'
  | 'apodo' | 'fechaNacimiento' | 'email' | 'password' | 'confirmar';

interface Field {
  name: FieldName;
  label: string;
  type: 'text' | 'date' | 'email' | 'password';
  autocomplete: string;
  hint?: string;
}

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, NgTemplateOutlet],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly registration = inject(Registration);

  readonly today = todayIso();
  readonly submitted = signal(false);
  readonly sending = signal(false);
  readonly serverError = signal<string | null>(null);

  /** Todos los campos, en orden: los 5 primeros van a la izquierda y el resto a la derecha. */
  readonly fields: Field[] = [
    { name: 'primerNombre',    label: 'Primer nombre',        type: 'text',     autocomplete: 'given-name' },
    { name: 'segundoNombre',   label: 'Segundo nombre',       type: 'text',     autocomplete: 'additional-name' },
    { name: 'primerApellido',  label: 'Primer apellido',      type: 'text',     autocomplete: 'family-name' },
    { name: 'segundoApellido', label: 'Segundo apellido',     type: 'text',     autocomplete: 'off' },
    { name: 'apodo',           label: 'Apodo',                type: 'text',     autocomplete: 'nickname',
      hint: 'Si lo dejas vacío usaremos tu primer nombre.' },
    { name: 'fechaNacimiento', label: 'Fecha de nacimiento',  type: 'date',     autocomplete: 'bday' },
    { name: 'email',           label: 'Correo Electrónico',   type: 'email',    autocomplete: 'email' },
    { name: 'password',        label: 'Contraseña',           type: 'password', autocomplete: 'new-password',
      hint: 'Mínimo 8 caracteres, con letras y números.' },
    { name: 'confirmar',       label: 'Verificar Contraseña', type: 'password', autocomplete: 'new-password' },
  ];

  readonly leftFields = this.fields.slice(0, 5);
  readonly rightFields = this.fields.slice(5);

  readonly form = this.fb.nonNullable.group(
    {
      primerNombre:    ['', [Validators.required, notBlank, Validators.pattern(NAME_PATTERN), Validators.maxLength(40)]],
      segundoNombre:   ['', [Validators.pattern(NAME_PATTERN), Validators.maxLength(40)]],
      primerApellido:  ['', [Validators.required, notBlank, Validators.pattern(NAME_PATTERN), Validators.maxLength(40)]],
      segundoApellido: ['', [Validators.pattern(NAME_PATTERN), Validators.maxLength(40)]],
      apodo:           ['', [Validators.maxLength(30)]],
      fechaNacimiento: ['', [Validators.required, notFuture, notTooOld]],
      email:           ['', [Validators.required, Validators.email]],
      password:        ['', [Validators.required, strongPassword]],
      confirmar:       ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  /** Mensajes por campo y tipo de error. */
  private readonly messages: Record<FieldName, Record<string, string>> = {
    primerNombre:    { required: 'Escribe tu primer nombre.', blank: 'Escribe tu primer nombre.', pattern: 'Usa solo letras.', maxlength: 'Máximo 40 caracteres.' },
    segundoNombre:   { pattern: 'Usa solo letras.', maxlength: 'Máximo 40 caracteres.' },
    primerApellido:  { required: 'Escribe tu primer apellido.', blank: 'Escribe tu primer apellido.', pattern: 'Usa solo letras.', maxlength: 'Máximo 40 caracteres.' },
    segundoApellido: { pattern: 'Usa solo letras.', maxlength: 'Máximo 40 caracteres.' },
    apodo:           { maxlength: 'Máximo 30 caracteres.' },
    fechaNacimiento: { required: 'Indica tu fecha de nacimiento.', future: 'La fecha no puede ser futura.', tooOld: 'Revisa el año.' },
    email:           { required: 'Escribe tu correo.', email: 'Escribe un correo válido.' },
    password:        { required: 'Escribe una contraseña.', weak: 'Mínimo 8 caracteres, con letras y números.' },
    confirmar:       { required: 'Repite tu contraseña.' },
  };

  /** Mensaje de error del campo, o null si no hay que mostrarlo todavía. */
  error(name: FieldName): string | null {
    const control = this.form.controls[name];
    if (!(control.touched || this.submitted())) return null;

    if (name === 'confirmar' && control.value !== '' && this.form.hasError('mismatch')) {
      return 'Las contraseñas no coinciden.';
    }
    if (!control.errors) return null;

    const key = Object.keys(control.errors)[0];
    return this.messages[name][key] ?? 'Revisa este campo.';
  }

  /** Ids de la pista y del error, para que el lector de pantalla los lea con el campo. */
  describedBy(field: Field): string | null {
    const ids = [field.hint ? `${field.name}-hint` : null, this.error(field.name) ? `${field.name}-error` : null];
    const used = ids.filter(Boolean);
    return used.length ? used.join(' ') : null;
  }

  async onSubmit(): Promise<void> {
    this.submitted.set(true);
    this.serverError.set(null);

    const firstInvalid = this.fields.find(f => this.error(f.name));
    if (firstInvalid) {
      document.getElementById(firstInvalid.name)?.focus();
      return;
    }

    this.sending.set(true);
    try {
      await this.registration.register(this.buildPayload());
      await this.router.navigate(['/verify']);
    } catch {
      // TODO: distinguir "correo ya registrado" de un error general cuando exista el backend.
      this.serverError.set('No pudimos crear tu cuenta. Revisa tus datos e inténtalo de nuevo.');
    } finally {
      this.sending.set(false);
    }
  }

  private buildPayload(): RegisterData {
    const v = this.form.getRawValue();
    const primerNombre = v.primerNombre.trim();
    return {
      primerNombre,
      segundoNombre: v.segundoNombre.trim(),
      primerApellido: v.primerApellido.trim(),
      segundoApellido: v.segundoApellido.trim(),
      apodo: v.apodo.trim() || primerNombre,   // sin apodo → primer nombre
      fechaNacimiento: v.fechaNacimiento,
      email: v.email.trim().toLowerCase(),
      password: v.password,
    };
  }
}
