import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CycleMode, Registration, SurveyData } from '../../Core/registration';
import { endNotBeforeStart, notFuture, notTooOld, todayIso } from '../../Core/validators';

/** Máximo de ciclos pasados que se pueden registrar. */
const MAX_CYCLES = 3;

const CYCLE_NAMES = ['El más reciente', 'El anterior', 'El anterior a ese'];

@Component({
  selector: 'app-survey',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './survey.html',
  styleUrl: './survey.css',
})
export class Survey {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly registration = inject(Registration);
  private readonly destroyRef = inject(DestroyRef);

  readonly today = todayIso();
  readonly maxCycles = MAX_CYCLES;
  readonly submitted = signal(false);
  readonly sending = signal(false);
  readonly serverError = signal<string | null>(null);

  readonly form = this.fb.group({
    // Datos básicos (opcionales; si se llenan, se revisan los rangos)
    altura: this.fb.control<number | null>(null, [Validators.min(100), Validators.max(230)]),
    peso:   this.fb.control<number | null>(null, [Validators.min(30), Validators.max(250)]),
    sueno:  this.fb.control<number | null>(null, [Validators.min(1), Validators.max(16)]),

    // Cómo quiere contar su ciclo
    modo: this.fb.nonNullable.control<CycleMode>('duraciones'),

    // Opción 1: duraciones
    duracionCiclo:   this.fb.control<number | null>(null, [Validators.required, Validators.min(15), Validators.max(60)]),
    duracionPeriodo: this.fb.control<number | null>(null, [Validators.required, Validators.min(1), Validators.max(14)]),

    // Opción 2: fechas de hasta 3 ciclos
    ciclos: this.fb.array([this.newCycle()]),
  });

  constructor() {
    // Sin registro verificado no se puede responder la encuesta.
    if (!this.registration.verified()) {
      this.router.navigate(['/register']);
      return;
    }

    this.applyMode(this.form.controls.modo.value);
    this.form.controls.modo.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(mode => this.applyMode(mode));
  }

  get ciclos() { return this.form.controls.ciclos; }
  get mode(): CycleMode { return this.form.controls.modo.value; }

  cycleName(i: number): string { return CYCLE_NAMES[i] ?? `Ciclo ${i + 1}`; }

  addCycle(): void {
    if (this.ciclos.length < MAX_CYCLES) this.ciclos.push(this.newCycle());
  }

  removeCycle(i: number): void {
    if (this.ciclos.length > 1) this.ciclos.removeAt(i);
  }

  // ─── Errores ──────────────────────────────────

  get alturaError()  { return this.numberError(this.form.controls.altura, 'tu altura', 100, 230, 'cm'); }
  get pesoError()    { return this.numberError(this.form.controls.peso, 'tu peso', 30, 250, 'kg'); }
  get suenoError()   { return this.numberError(this.form.controls.sueno, 'tus horas de sueño', 1, 16, 'horas'); }
  get cicloError()   { return this.numberError(this.form.controls.duracionCiclo, 'la duración de tu ciclo', 15, 60, 'días'); }
  get periodoError() { return this.numberError(this.form.controls.duracionPeriodo, 'la duración de tu periodo', 1, 14, 'días'); }

  /** Error de un número (altura, peso, sueño o duraciones). */
  numberError(control: AbstractControl, label: string, min: number, max: number, unit: string): string | null {
    if (!(control.touched || this.submitted()) || !control.errors) return null;
    if (control.hasError('required')) return `Escribe ${label}.`;
    return `Debe estar entre ${min} y ${max} ${unit}.`;
  }

  /** Error de una fecha dentro de un ciclo. */
  cycleError(i: number, field: 'inicio' | 'fin'): string | null {
    const group = this.ciclos.at(i);
    const control = group.controls[field];
    if (!(control.touched || this.submitted())) return null;

    if (control.hasError('required')) return 'Indica la fecha.';
    if (control.hasError('future')) return 'La fecha no puede ser futura.';
    if (control.hasError('tooOld')) return 'Revisa el año.';
    if (field === 'fin' && group.hasError('endBeforeStart')) return 'No puede ser antes del inicio.';
    return null;
  }

  // ─── Envío ────────────────────────────────────

  async onSubmit(): Promise<void> {
    this.submitted.set(true);
    this.serverError.set(null);

    if (this.form.invalid) {
      this.focusFirstInvalid();
      return;
    }

    this.sending.set(true);
    try {
      await this.registration.saveSurvey(this.buildPayload());
      await this.router.navigate(['/home']);
    } catch {
      this.serverError.set('No pudimos guardar tus respuestas. Inténtalo de nuevo.');
    } finally {
      this.sending.set(false);
    }
  }

  // ─── Internos ─────────────────────────────────

  private newCycle() {
    return this.fb.nonNullable.group(
      {
        inicio: ['', [Validators.required, notFuture, notTooOld]],
        fin: ['', [notFuture, notTooOld]],
      },
      { validators: endNotBeforeStart },
    );
  }

  /** Solo la opción elegida cuenta para la validación: la otra se desactiva. */
  private applyMode(mode: CycleMode): void {
    const { duracionCiclo, duracionPeriodo, ciclos } = this.form.controls;
    const set = (on: boolean, ...controls: AbstractControl[]) =>
      controls.forEach(c => (on ? c.enable({ emitEvent: false }) : c.disable({ emitEvent: false })));

    set(mode === 'duraciones', duracionCiclo, duracionPeriodo);
    set(mode === 'fechas', ciclos);
  }

  private focusFirstInvalid(): void {
    // Los campos desactivados (la opción de ciclo que no eligió) no tienen la clase ng-invalid.
    document.querySelector<HTMLElement>('.survey-card input.ng-invalid')?.focus();
  }

  private buildPayload(): SurveyData {
    const v = this.form.getRawValue();
    const mode = v.modo;
    return {
      alturaCm: v.altura,
      pesoKg: v.peso,
      horasSueno: v.sueno,
      modoCiclo: mode,
      duracionCiclo: mode === 'duraciones' ? v.duracionCiclo : null,
      duracionPeriodo: mode === 'duraciones' ? v.duracionPeriodo : null,
      ciclos: mode === 'fechas' ? v.ciclos.map(c => ({ inicio: c.inicio, fin: c.fin || null })) : [],
    };
  }
}
