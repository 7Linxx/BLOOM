import { Component, computed, inject, signal } from '@angular/core';

import { BloomApi, mensajeDeError } from '../../Core/Services/bloom-api.service';
import { Sesion } from '../../Core/Services/sesion.service';
import { CicloActual, DiaCalendario, RegistroDiario } from '../../Core/modelos';
import {
  fechaATexto,
  flujoBackendATexto,
  flujoTextoABackend,
  indicadorATipoDia,
  nombresACatalogo,
  registroANombres,
  textoAFecha,
} from '../../Core/mapeos';

type MenstrualFlow = 'ligero' | 'moderado' | 'abundante';

type DayKind =
  | 'confirmed'
  | 'predicted'
  | 'fertile'
  | 'ovulation'
  | 'late'
  | 'none';

interface CalendarDay {
  date: Date;
  key: string;
  number: number;
  currentMonth: boolean;
  today: boolean;
  future: boolean;
  hasRecord: boolean;
  kind: DayKind;
  cycleDay: number | null;
}

interface SelectedRecord {
  isPeriod: boolean;
  symptoms: string[];
  flow: MenstrualFlow | null;
  note: string;
}

interface Mensaje {
  tipo: 'ok' | 'aviso' | 'error';
  texto: string;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  templateUrl: './calendar.html',
  styleUrl: './calendar.css',
})
export class Calendar {
  private readonly api = inject(BloomApi);
  private readonly sesion = inject(Sesion);

  readonly today = this.normalizeDate(new Date());

  readonly currentMonth = signal(
    new Date(this.today.getFullYear(), this.today.getMonth(), 1)
  );

  readonly selectedDate = signal(this.today);

  readonly symptomsAvailable = [
    'Cólicos',
    'Dolor de cabeza',
    'Sensibilidad en los senos',
    'Hinchazón',
    'Cansancio',
    'Acné',
    'Cambios de humor',
    'Dolor lumbar',
    'Náuseas',
    'Antojos',
    'Insomnio',
  ];

  readonly flowOptions: {
    value: MenstrualFlow;
    label: string;
  }[] = [
    { value: 'ligero', label: 'Ligero' },
    { value: 'moderado', label: 'Moderado' },
    { value: 'abundante', label: 'Abundante' },
  ];

  readonly isPeriodDraft = signal(false);
  readonly symptomsDraft = signal<string[]>([]);
  readonly flowDraft = signal<MenstrualFlow | null>(null);
  readonly noteDraft = signal('');

  readonly mensaje = signal<Mensaje | null>(null);

  readonly guardando = signal(false);

  private readonly diasDelMes = signal<Record<string, DiaCalendario>>({});

  private readonly registros = signal<Record<string, RegistroDiario>>({});

  private readonly cicloActual = signal<CicloActual | null>(null);

  private cargaDeMes = 0;

  constructor() {
    this.cargarRegistros();
    this.cargarMes();
    this.cargarCicloActual();
  }

  readonly monthLabel = computed(() =>
    this.currentMonth().toLocaleDateString('es-CO', {
      month: 'long',
      year: 'numeric',
    })
  );

  readonly cycleLength = computed(() => this.cicloActual()?.duracionEstimada ?? 28);

  readonly currentCycleDay = computed(() => this.cicloActual()?.diaDelCiclo ?? null);

  readonly daysUntilPeriod = computed(() => {
    const ciclo = this.cicloActual();
    if (!ciclo) return null;
    return ciclo.periodoRetrasado ? -ciclo.diasRetraso : ciclo.diasParaSiguientePeriodo;
  });

  readonly daysUntilOvulation = computed(() => {
    const ciclo = this.cicloActual();
    if (!ciclo) return null;
    let dias = this.daysBetween(this.today, textoAFecha(ciclo.fechaEstimadaOvulacion));
    // Si la ovulación de este ciclo ya pasó, la próxima es en el siguiente ciclo.
    if (dias < 0) {
      dias += ciclo.duracionEstimada;
    }
    return dias;
  });

  readonly calendarDays = computed((): CalendarDay[] => {
    const firstDay = this.currentMonth();
    const mondayOffset = (firstDay.getDay() + 6) % 7;
    const startDate = this.addDays(firstDay, -mondayOffset);

    return Array.from({ length: 42 }, (_, index) => {
      const date = this.addDays(startDate, index);
      const key = this.dateKey(date);
      const dia = this.diasDelMes()[key];

      return {
        date,
        key,
        number: date.getDate(),
        currentMonth: date.getMonth() === firstDay.getMonth(),
        today: this.isSameDay(date, this.today),
        future: date > this.today,
        hasRecord: dia?.tieneRegistro ?? !!this.registros()[key],
        kind: indicadorATipoDia(dia?.indicador),
        cycleDay: dia?.diaDelCiclo ?? null,
      };
    });
  });

  readonly selectedRecord = computed((): SelectedRecord => {
    const registro = this.registros()[this.dateKey(this.selectedDate())];
    if (!registro) {
      return { isPeriod: false, symptoms: [], flow: null, note: '' };
    }
    return {
      isPeriod: registro.hayMenstruacion,
      symptoms: this.nombresGuardados(registro),
      flow: flujoBackendATexto(registro.tipoFlujo),
      note: registro.nota ?? '',
    };
  });

  readonly canEditSelected = computed(() =>
    this.selectedDate() <= this.today
  );

  readonly selectedInfo = computed(() => {
    const date = this.selectedDate();
    const dia = this.diasDelMes()[this.dateKey(date)];
    const kind = indicadorATipoDia(dia?.indicador);

    const descriptions: Record<DayKind, string> = {
      confirmed: 'Menstruación registrada',
      predicted: 'Menstruación estimada',
      fertile: 'Ventana fértil estimada',
      ovulation: 'Día aproximado de ovulación',
      late: 'Posible retraso menstrual',
      none: 'Sin eventos del ciclo',
    };

    return {
      date: date.toLocaleDateString('es-CO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      description: descriptions[kind],
      cycleDay: dia?.diaDelCiclo ?? null,
      kind,
    };
  });

  readonly legend = [
    { kind: 'confirmed', label: 'Periodo confirmado' },
    { kind: 'predicted', label: 'Periodo pronosticado' },
    { kind: 'fertile', label: 'Fase fértil' },
    { kind: 'ovulation', label: 'Día de ovulación' },
    { kind: 'late', label: 'Periodo retrasado' },
    { kind: 'has-record', label: 'Nota o registro adicional' },
  ];

  previousMonth(): void {
    this.currentMonth.update(month =>
      new Date(month.getFullYear(), month.getMonth() - 1, 1)
    );
    this.cargarMes();
  }

  nextMonthView(): void {
    this.currentMonth.update(month =>
      new Date(month.getFullYear(), month.getMonth() + 1, 1)
    );
    this.cargarMes();
  }

  selectDay(day: CalendarDay): void {
    this.mensaje.set(null);
    this.selectedDate.set(day.date);
    this.cargarBorrador();
  }

  isSelected(day: CalendarDay): boolean {
    return this.isSameDay(day.date, this.selectedDate());
  }

  isSymptomSelected(symptom: string): boolean {
    return this.symptomsDraft().includes(symptom);
  }

  toggleSymptom(symptom: string, checked: boolean): void {
    this.symptomsDraft.update(current => {
      if (checked) {
        return current.includes(symptom)
          ? current
          : [...current, symptom];
      }

      return current.filter(item => item !== symptom);
    });
  }

  async saveSelectedDay(): Promise<void> {
    if (!this.canEditSelected() || this.guardando()) return;

    const fecha = this.dateKey(this.selectedDate());
    const yaExiste = !!this.registros()[fecha];
    const idUsuario = this.sesion.idUsuario;

    this.mensaje.set(null);
    this.guardando.set(true);

    try {
      const vacio = !this.isPeriodDraft() && this.symptomsDraft().length === 0 && !this.noteDraft().trim();
      let noGuardados: string[] = [];

      if (vacio) {
        if (yaExiste) {
          await this.api.eliminarRegistro(idUsuario, fecha);
        }
      } else {
        const catalogos = await this.api.verCatalogos();
        const traduccion = nombresACatalogo(this.symptomsDraft(), catalogos);
        const registro: RegistroDiario = {
          fecha,
          hayMenstruacion: this.isPeriodDraft(),
          tipoFlujo: this.isPeriodDraft() ? flujoTextoABackend(this.flowDraft()) : null,
          nota: this.noteDraft().trim() || null,
          sintomas: traduccion.sintomas,
          emociones: traduccion.emociones,
          actividadesSexuales: this.registros()[fecha]?.actividadesSexuales ?? [],
        };
        await this.api.guardarRegistro(idUsuario, registro, yaExiste);
        noGuardados = traduccion.noGuardados;
      }

      await this.recargarTodo();

      if (noGuardados.length > 0) {
        this.mensaje.set({
          tipo: 'aviso',
          texto: 'Se guardó el día, pero estos síntomas no existen en Bloom: ' + noGuardados.join(', ') + '.',
        });
      } else if (vacio && yaExiste) {
        this.mensaje.set({ tipo: 'ok', texto: 'Se eliminó la información de este día.' });
      } else if (vacio) {
        this.mensaje.set({ tipo: 'aviso', texto: 'No hay nada que guardar en este día.' });
      } else {
        this.mensaje.set({ tipo: 'ok', texto: 'Información guardada ♡' });
      }
    } catch (error) {
      this.mensaje.set({
        tipo: 'error',
        texto: mensajeDeError(error, 'No se pudo guardar la información del día.'),
      });
    } finally {
      this.guardando.set(false);
    }
  }

  private async recargarTodo(): Promise<void> {
    await this.cargarRegistros();
    await this.cargarMes();
    await this.cargarCicloActual();
  }

  private async cargarRegistros(): Promise<void> {
    try {
      const lista = await this.api.verRegistros(this.sesion.idUsuario);
      const mapa: Record<string, RegistroDiario> = {};
      for (const registro of lista) {
        mapa[registro.fecha] = registro;
      }
      this.registros.set(mapa);
      this.cargarBorrador();
    } catch {
      this.registros.set({});
    }
  }

  private async cargarMes(): Promise<void> {
    const carga = ++this.cargaDeMes;
    const mes = this.currentMonth();
    const meses = [
      new Date(mes.getFullYear(), mes.getMonth() - 1, 1),
      mes,
      new Date(mes.getFullYear(), mes.getMonth() + 1, 1),
    ];

    const resultados = await Promise.allSettled(
      meses.map(m => this.api.verCalendario(this.sesion.idUsuario, m.getFullYear(), m.getMonth() + 1))
    );

    if (carga !== this.cargaDeMes) return;

    const mapa: Record<string, DiaCalendario> = {};
    for (const resultado of resultados) {
      if (resultado.status === 'fulfilled') {
        for (const dia of resultado.value.dias) {
          mapa[dia.fecha] = dia;
        }
      }
    }
    this.diasDelMes.set(mapa);
  }

  private async cargarCicloActual(): Promise<void> {
    try {
      this.cicloActual.set(await this.api.verCicloActual(this.sesion.idUsuario));
    } catch {
      this.cicloActual.set(null);
    }
  }

  private cargarBorrador(): void {
    const guardado = this.selectedRecord();
    this.isPeriodDraft.set(guardado.isPeriod);
    this.symptomsDraft.set(guardado.symptoms);
    this.flowDraft.set(guardado.flow);
    this.noteDraft.set(guardado.note);
  }

  private nombresGuardados(registro: RegistroDiario): string[] {
    return registroANombres(registro, this.symptomsAvailable);
  }


  private normalizeDate(date: Date): Date {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);

    return this.normalizeDate(result);
  }

  private daysBetween(start: Date, end: Date): number {
    return Math.round(
      (
        Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) -
        Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
      ) / 86400000
    );
  }

  private isSameDay(first: Date, second: Date): boolean {
    return (
      first.getFullYear() === second.getFullYear() &&
      first.getMonth() === second.getMonth() &&
      first.getDate() === second.getDate()
    );
  }

  private dateKey(date: Date): string {
    return fechaATexto(date);
  }
}
