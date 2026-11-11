import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { Registration, RegisterData } from '../../Core/registration';
import { mensajeDeError } from '../../Core/Services/bloom-api.service';

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
  | 'primerNombre'
  | 'segundoNombre'
  | 'primerApellido'
  | 'segundoApellido'
  | 'apodo'
  | 'fechaNacimiento'
  | 'email'
  | 'password'
  | 'confirmar';

const PASSWORD_RULES = [
  {
    label: 'Mínimo 8 caracteres',
    test: (value: string) => value.length >= 8,
  },
  {
    label: 'Una letra',
    test: (value: string) => /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(value),
  },
  {
    label: 'Un número',
    test: (value: string) => /\d/.test(value),
  },
];

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
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

  readonly showPw = signal(false);
  readonly showPw2 = signal(false);

  private readonly passwordValue = signal('');

  readonly rules = computed(() =>
    PASSWORD_RULES.map(rule => ({
      label: rule.label,
      ok: rule.test(this.passwordValue()),
    }))
  );

  readonly form = this.fb.nonNullable.group(
    {
      primerNombre: [
        '',
        [
          Validators.required,
          notBlank,
          Validators.pattern(NAME_PATTERN),
          Validators.maxLength(40),
        ],
      ],

      segundoNombre: [
        '',
        [
          Validators.pattern(NAME_PATTERN),
          Validators.maxLength(40),
        ],
      ],

      primerApellido: [
        '',
        [
          Validators.required,
          notBlank,
          Validators.pattern(NAME_PATTERN),
          Validators.maxLength(40),
        ],
      ],

      segundoApellido: [
        '',
        [
          Validators.pattern(NAME_PATTERN),
          Validators.maxLength(40),
        ],
      ],

      apodo: [
        '',
        [Validators.maxLength(30)],
      ],

      fechaNacimiento: [
        '',
        [
          Validators.required,
          notFuture,
          notTooOld,
        ],
      ],

      email: [
        '',
        [
          Validators.required,
          Validators.email,
        ],
      ],

      password: [
        '',
        [
          Validators.required,
          strongPassword,
        ],
      ],

      confirmar: [
        '',
        [Validators.required],
      ],
    },
    {
      validators: passwordsMatch,
    },
  );

  constructor() {
    this.form.controls.password.valueChanges.subscribe(value => {
      this.passwordValue.set(value);
    });
  }

  private readonly messages: Record<FieldName, Record<string, string>> = {
    primerNombre: {
      required: 'Escribe tu primer nombre.',
      blank: 'Escribe tu primer nombre.',
      pattern: 'Usa solo letras.',
      maxlength: 'Máximo 40 caracteres.',
    },

    segundoNombre: {
      pattern: 'Usa solo letras.',
      maxlength: 'Máximo 40 caracteres.',
    },

    primerApellido: {
      required: 'Escribe tu primer apellido.',
      blank: 'Escribe tu primer apellido.',
      pattern: 'Usa solo letras.',
      maxlength: 'Máximo 40 caracteres.',
    },

    segundoApellido: {
      pattern: 'Usa solo letras.',
      maxlength: 'Máximo 40 caracteres.',
    },

    apodo: {
      maxlength: 'Máximo 30 caracteres.',
    },

    fechaNacimiento: {
      required: 'Indica tu fecha de nacimiento.',
      future: 'La fecha no puede ser futura.',
      tooOld: 'Revisa el año.',
    },

    email: {
      required: 'Escribe tu correo.',
      email: 'Escribe un correo válido.',
    },

    password: {
      required: 'Escribe una contraseña.',
      weak: 'Usa mínimo 8 caracteres, una letra y un número.',
    },

    confirmar: {
      required: 'Repite tu contraseña.',
    },
  };

  error(name: FieldName): string | null {
    const control = this.form.controls[name];

    if (!(control.touched || this.submitted())) {
      return null;
    }

    if (
      name === 'confirmar' &&
      control.value !== '' &&
      this.form.hasError('mismatch')
    ) {
      return 'Las contraseñas no coinciden.';
    }

    if (!control.errors) {
      return null;
    }

    const key = Object.keys(control.errors)[0];

    return this.messages[name][key] ?? 'Revisa este campo.';
  }

  async onSubmit(): Promise<void> {
    this.submitted.set(true);
    this.serverError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();

      const fields: FieldName[] = [
        'primerNombre',
        'segundoNombre',
        'primerApellido',
        'segundoApellido',
        'apodo',
        'fechaNacimiento',
        'email',
        'password',
        'confirmar',
      ];

      const firstInvalid = fields.find(name =>
        this.form.controls[name].invalid || this.error(name)
      );

      if (firstInvalid) {
        document.getElementById(firstInvalid)?.focus();
      }

      return;
    }

    this.sending.set(true);

    try {
      await this.registration.register(this.buildPayload());

      await this.router.navigate(['/verificar']);

    } catch (error) {
      // El backend explica el problema (ej: "Ya existe una cuenta con ese correo.").
      this.serverError.set(
        mensajeDeError(error, 'No pudimos crear tu cuenta. Revisa tus datos e inténtalo de nuevo.')
      );

    } finally {
      this.sending.set(false);
    }
  }

  private buildPayload(): RegisterData {
    const value = this.form.getRawValue();

    const primerNombre = value.primerNombre.trim();

    return {
      primerNombre,
      segundoNombre: value.segundoNombre.trim(),
      primerApellido: value.primerApellido.trim(),
      segundoApellido: value.segundoApellido.trim(),

      apodo: value.apodo.trim() || primerNombre,

      fechaNacimiento: value.fechaNacimiento,
      email: value.email.trim().toLowerCase(),
      password: value.password,
    };
  }
}
