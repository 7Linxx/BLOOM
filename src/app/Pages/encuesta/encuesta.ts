import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import {
  CycleMode,
  Registration,
  SurveyData
} from '../../Core/registration';

import {
  endNotBeforeStart,
  notFuture,
  notTooOld,
  todayIso,
} from '../../Core/validators';
import { mensajeDeError } from '../../Core/Services/bloom-api.service';

const MAX_CYCLES = 3;

const CYCLE_NAMES = [
  'Menstruación más reciente',
  'Menstruación anterior',
  'Tercera menstruación',
];

/** Las dos opciones que acepta el backend (ingresoRango): duraciones o fechas de 1 a 3 menstruaciones. */
type CycleOption = 'duraciones' | 'fechas';

@Component({
  selector: 'app-encuesta',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './encuesta.html',
  styleUrl: './encuesta.css',
})
export class Encuesta {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly registration = inject(Registration);
  private readonly destroyRef = inject(DestroyRef);

  readonly today = todayIso();
  readonly maxCycles = MAX_CYCLES;

  readonly submitted = signal(false);
  readonly sending = signal(false);
  readonly serverError = signal<string | null>(null);

  readonly opcionesCiclo: {
    value: CycleOption;
    label: string;
    description: string;
  }[] = [
    {
      value: 'duraciones',
      label: 'Sé cuánto duran',
      description: 'Te pediremos la duración de tu ciclo y de tu menstruación.',
    },
    {
      value: 'fechas',
      label: 'Recuerdo las fechas',
      description: 'Te pediremos las fechas de tus últimas menstruaciones (de 1 a 3).',
    },
  ];

  readonly form = this.fb.group({
    // Altura, peso y horas de sueño son obligatorios en el backend.
    altura: this.fb.control<number | null>(
      null,
      [Validators.required, Validators.min(100), Validators.max(230)],
    ),

    peso: this.fb.control<number | null>(
      null,
      [Validators.required, Validators.min(30), Validators.max(250)],
    ),

    sueno: this.fb.control<number | null>(
      null,
      [Validators.required, Validators.min(1), Validators.max(16)],
    ),

    // Opción elegida: se envía al backend como ingresoRango.
    modo: this.fb.control<CycleOption | null>(null, [Validators.required]),

    // Solo se usan (y se validan) cuando la opción es "duraciones".
    duracionCiclo: this.fb.control<number | null>(
      null,
      [Validators.required, Validators.min(15), Validators.max(60)],
    ),

    // El backend acepta hasta 15 días de menstruación.
    duracionPeriodo: this.fb.control<number | null>(
      null,
      [Validators.required, Validators.min(1), Validators.max(15)],
    ),

    // Solo se usan (y se validan) cuando la opción es "fechas".
    ciclos: this.fb.array([this.newCycle()]),
  });

  constructor() {
    if (!this.registration.verified()) {
      this.router.navigate(['/register']);
      return;
    }

    // Al empezar no hay opción elegida: los campos de las dos opciones están desactivados.
    this.aplicarModo(null);

    this.form.controls.modo.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(modo => this.aplicarModo(modo));

    this.destroyRef.onDestroy(() => {
      this.form.reset();
    });
  }

  get modo(): CycleOption | null {
    return this.form.controls.modo.value;
  }

  get ciclos(): FormArray {
    return this.form.controls.ciclos;
  }

  cycleName(index: number): string {
    return CYCLE_NAMES[index] ?? `Menstruación ${index + 1}`;
  }

  addCycle(): void {
    if (this.ciclos.length < MAX_CYCLES) {
      this.ciclos.push(this.newCycle());
    }
  }

  removeCycle(index: number): void {
    if (this.ciclos.length > 1) {
      this.ciclos.removeAt(index);
    }
  }

  get modoError(): string | null {
    const control = this.form.controls.modo;

    if (!(control.touched || this.submitted()) || !control.hasError('required')) {
      return null;
    }

    return 'Elige una opción para continuar.';
  }

  get alturaError(): string | null {
    return this.numberError(
      this.form.controls.altura,
      100,
      230,
      'cm',
      'Escribe tu altura en centímetros.',
    );
  }

  get pesoError(): string | null {
    return this.numberError(
      this.form.controls.peso,
      30,
      250,
      'kg',
      'Escribe tu peso en kilogramos.',
    );
  }

  get suenoError(): string | null {
    return this.numberError(
      this.form.controls.sueno,
      1,
      16,
      'horas',
      'Escribe cuántas horas duermes.',
    );
  }

  get cicloError(): string | null {
    return this.numberError(
      this.form.controls.duracionCiclo,
      15,
      60,
      'días',
      'Escribe cuántos días dura tu ciclo.',
    );
  }

  get periodoError(): string | null {
    return this.numberError(
      this.form.controls.duracionPeriodo,
      1,
      15,
      'días',
      'Escribe cuántos días dura tu menstruación.',
    );
  }

  private numberError(
    control: AbstractControl,
    min: number,
    max: number,
    unit: string,
    requiredMessage: string,
  ): string | null {
    if (!(control.touched || this.submitted()) || !control.errors) {
      return null;
    }

    if (control.hasError('required')) {
      return requiredMessage;
    }

    if (control.hasError('min') || control.hasError('max')) {
      return `El valor debe estar entre ${min} y ${max} ${unit}.`;
    }

    return null;
  }

  cycleError(index: number, field: 'inicio' | 'fin'): string | null {
    const group = this.ciclos.at(index);
    const control = group.get(field);

    if (!control || !(control.touched || this.submitted())) {
      return null;
    }

    if (control.hasError('required')) {
      return field === 'inicio'
        ? 'Indica la fecha de inicio.'
        : 'Indica la fecha de finalización.';
    }

    if (control.hasError('future')) {
      return 'La fecha no puede ser futura.';
    }

    if (control.hasError('tooOld')) {
      return 'Revisa la fecha ingresada.';
    }

    if (field === 'fin' && group.hasError('endBeforeStart')) {
      return 'La fecha de finalización no puede ser anterior al inicio.';
    }

    return null;
  }

  async onSubmit(): Promise<void> {
    this.submitted.set(true);
    this.serverError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstInvalid();
      return;
    }

    this.sending.set(true);

    try {
      await this.registration.saveSurvey(this.buildPayload());
      await this.router.navigate(['/home']);
    } catch (error) {
      // El backend explica qué falta o qué está mal.
      this.serverError.set(
        this.traducirError(
          mensajeDeError(error, 'No pudimos guardar tus respuestas. Inténtalo de nuevo.'),
        ),
      );
    } finally {
      this.sending.set(false);
    }
  }

  /**
   * Activa solo los campos de la opción elegida. Los campos desactivados no se validan,
   * así que no estorban aunque la usuaria cambie de opción.
   */
  private aplicarModo(modo: CycleOption | null): void {
    const { duracionCiclo, duracionPeriodo } = this.form.controls;

    if (modo === 'duraciones') {
      duracionCiclo.enable();
      duracionPeriodo.enable();
      this.ciclos.disable();
    } else if (modo === 'fechas') {
      duracionCiclo.disable();
      duracionPeriodo.disable();
      this.ciclos.enable();
    } else {
      duracionCiclo.disable();
      duracionPeriodo.disable();
      this.ciclos.disable();
    }
  }

  /**
   * El backend guarda la altura en metros y a veces lo dice en su mensaje,
   * pero en pantalla se pide en centímetros: se cambia por un mensaje claro.
   */
  private traducirError(mensaje: string): string {
    if (/altura/i.test(mensaje) && /metro/i.test(mensaje)) {
      return 'Revisa tu altura: escríbela en centímetros, entre 100 y 230 cm.';
    }

    return mensaje;
  }

  private newCycle() {
    return this.fb.group(
      {
        // El backend necesita las dos fechas de cada menstruación.
        inicio: this.fb.nonNullable.control('', [Validators.required, notFuture, notTooOld]),
        fin: this.fb.nonNullable.control('', [Validators.required, notFuture, notTooOld]),
      },
      {
        validators: endNotBeforeStart,
      },
    );
  }

  private focusFirstInvalid(): void {
    document
      .querySelector<HTMLElement>('.survey-card input.ng-invalid')
      ?.focus();
  }

  private buildPayload(): SurveyData {
    const v = this.form.getRawValue();

    // Ya validado: siempre hay una opción elegida.
    const mode: CycleMode = v.modo ?? 'duraciones';
    const usaDuraciones = mode === 'duraciones';

    return {
      alturaCm: v.altura,
      pesoKg: v.peso,
      horasSueno: v.sueno,

      modoCiclo: mode,
      duracionCiclo: usaDuraciones ? v.duracionCiclo : null,
      duracionPeriodo: usaDuraciones ? v.duracionPeriodo : null,

      ciclos: usaDuraciones
        ? []
        : v.ciclos.map(cycle => ({
          inicio: cycle.inicio,
          fin: cycle.fin,
        })),

      // La encuesta del backend no guarda síntomas ni flujo.
      sintomas: [],
      flujoMenstrual: null,
    };
  }
}
