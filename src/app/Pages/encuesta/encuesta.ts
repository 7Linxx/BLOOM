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
  MenstrualFlow,
  Registration,
  SurveyData
} from '../../Core/registration';

import {
  endNotBeforeStart,
  notFuture,
  notTooOld,
  todayIso,
} from '../../Core/validators';

const MAX_CYCLES = 3;

const CYCLE_NAMES = [
  'Menstruación más reciente',
  'Menstruación anterior',
  'Tercera menstruación',
];

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

  readonly sintomasDisponibles = [
    'Cólicos',
    'Dolor de cabeza',
    'Dolor de espalda',
    'Sensibilidad en los senos',
    'Hinchazón',
    'Acné',
    'Cansancio',
    'Cambios de humor',
    'Ansiedad',
    'Antojos',
    'Náuseas',
    'Dolor muscular',
    'Ninguno',
  ];

  readonly tiposFlujo: {
    value: MenstrualFlow;
    label: string;
    description: string;
  }[] = [
    {
      value: 'ligero',
      label: 'Ligero',
      description: 'Poca cantidad de sangrado.',
    },
    {
      value: 'moderado',
      label: 'Moderado',
      description: 'Una cantidad intermedia.',
    },
    {
      value: 'abundante',
      label: 'Abundante',
      description: 'Una cantidad elevada.',
    },
    {
      value: 'variable',
      label: 'Variable',
      description: 'Cambia durante el periodo.',
    },
    {
      value: 'no_se',
      label: 'No lo sé',
      description: 'No estoy segura.',
    },
  ];

  readonly form = this.fb.group({
    altura: this.fb.control<number | null>(
      null,
      [Validators.min(100), Validators.max(230)],
    ),

    peso: this.fb.control<number | null>(
      null,
      [Validators.min(30), Validators.max(250)],
    ),

    sueno: this.fb.control<number | null>(
      null,
      [Validators.min(1), Validators.max(16)],
    ),

    duracionCiclo: this.fb.control<number | null>(
      null,
      [Validators.min(15), Validators.max(60)],
    ),

    duracionPeriodo: this.fb.control<number | null>(
      null,
      [Validators.min(1), Validators.max(14)],
    ),

    ciclos: this.fb.array([this.newCycle()]),

    sintomas: this.fb.nonNullable.control<string[]>([]),

    flujoMenstrual: this.fb.control<MenstrualFlow | null>(null),
  });

  constructor() {
    if (!this.registration.verified()) {
      this.router.navigate(['/register']);
      return;
    }

    this.destroyRef.onDestroy(() => {
      this.form.reset();
    });
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

  isSymptomSelected(symptom: string): boolean {
    return this.form.controls.sintomas.value.includes(symptom);
  }

  toggleSymptom(symptom: string, checked: boolean): void {
    const control = this.form.controls.sintomas;
    const current = control.value;

    if (symptom === 'Ninguno') {
      control.setValue(checked ? ['Ninguno'] : []);
      return;
    }

    const updated = checked
      ? [...current.filter(item => item !== 'Ninguno'), symptom]
      : current.filter(item => item !== symptom);

    control.setValue(updated);
    control.markAsTouched();
  }

  get alturaError(): string | null {
    return this.numberError(
      this.form.controls.altura,
      100,
      230,
      'cm',
    );
  }

  get pesoError(): string | null {
    return this.numberError(
      this.form.controls.peso,
      30,
      250,
      'kg',
    );
  }

  get suenoError(): string | null {
    return this.numberError(
      this.form.controls.sueno,
      1,
      16,
      'horas',
    );
  }

  get cicloError(): string | null {
    return this.numberError(
      this.form.controls.duracionCiclo,
      15,
      60,
      'días',
    );
  }

  get periodoError(): string | null {
    return this.numberError(
      this.form.controls.duracionPeriodo,
      1,
      14,
      'días',
    );
  }

  private numberError(
    control: AbstractControl,
    min: number,
    max: number,
    unit: string,
  ): string | null {
    if (!(control.touched || this.submitted()) || !control.errors) {
      return null;
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
    } catch {
      this.serverError.set(
        'No pudimos guardar tus respuestas. Inténtalo de nuevo.',
      );
    } finally {
      this.sending.set(false);
    }
  }

  private newCycle() {
    return this.fb.group(
      {
        inicio: this.fb.nonNullable.control('', [notFuture, notTooOld]),
        fin: this.fb.nonNullable.control('', [notFuture, notTooOld]),
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

    const cycles = v.ciclos
      .filter(cycle => !!cycle.inicio)
      .map(cycle => ({
        inicio: cycle.inicio,
        fin: cycle.fin || null,
      }));

    const hasDurations =
      v.duracionCiclo !== null ||
      v.duracionPeriodo !== null;

    const hasDates = cycles.length > 0;

    let mode: CycleMode = 'ninguno';

    if (hasDurations && hasDates) {
      mode = 'ambos';
    } else if (hasDurations) {
      mode = 'duraciones';
    } else if (hasDates) {
      mode = 'fechas';
    }

    return {
      alturaCm: v.altura,
      pesoKg: v.peso,
      horasSueno: v.sueno,

      modoCiclo: mode,
      duracionCiclo: hasDurations ? v.duracionCiclo : null,
      duracionPeriodo: hasDurations ? v.duracionPeriodo : null,

      ciclos: cycles,

      sintomas: v.sintomas,
      flujoMenstrual: v.flujoMenstrual,
    };
  }

}
