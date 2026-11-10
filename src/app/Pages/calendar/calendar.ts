import { Component, computed, inject, signal } from '@angular/core';
import {
  CycleService,
  DayRecord,
  MenstrualFlow,
} from '../../Core/Services/cycle.service';

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

@Component({
  selector: 'app-calendar',
  standalone: true,
  templateUrl: './calendar.html',
  styleUrl: './calendar.css',
})
export class Calendar {
  private readonly cycleService = inject(CycleService);

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
    'Otros',
  ];

  readonly flowOptions: {
    value: MenstrualFlow;
    label: string;
  }[] = [
    { value: 'ligero', label: 'Ligero' },
    { value: 'moderado', label: 'Moderado' },
    { value: 'abundante', label: 'Abundante' },
    { value: 'variable', label: 'Variable' },
    { value: 'no_se', label: 'No lo sé' },
  ];

  readonly isPeriodDraft = signal(false);
  readonly symptomsDraft = signal<string[]>([]);
  readonly flowDraft = signal<MenstrualFlow | null>(null);
  readonly noteDraft = signal('');

  readonly monthLabel = computed(() =>
    this.currentMonth().toLocaleDateString('es-CO', {
      month: 'long',
      year: 'numeric',
    })
  );

  readonly cycleLength = computed(() => {
    return this.cycleService.getEstimatedCycleLength(
      this.cycleService.getPeriodStarts()
    );
  });

  readonly periodLength = computed(() =>
    this.cycleService.getEstimatedPeriodLength()
  );

  readonly currentCycleDay = computed(() => {
    const start = this.getLatestStart(this.today);

    return start
      ? this.daysBetween(start, this.today) + 1
      : null;
  });

  readonly nextPeriod = computed(() => {
    const start = this.getLatestStart(this.today);

    return start
      ? this.addDays(start, this.cycleLength())
      : null;
  });

  readonly daysUntilPeriod = computed(() => {
    const next = this.nextPeriod();

    return next
      ? this.daysBetween(this.today, next)
      : null;
  });

  readonly nextOvulation = computed(() => {
    const start = this.getLatestStart(this.today);

    if (!start) return null;

    const ovulationDay = Math.max(10, this.cycleLength() - 14);

    let date = this.addDays(start, ovulationDay - 1);

    if (date < this.today) {
      date = this.addDays(date, this.cycleLength());
    }

    return date;
  });

  readonly daysUntilOvulation = computed(() => {
    const date = this.nextOvulation();

    return date
      ? this.daysBetween(this.today, date)
      : null;
  });

  readonly calendarDays = computed((): CalendarDay[] => {
    const firstDay = this.currentMonth();
    const mondayOffset = (firstDay.getDay() + 6) % 7;
    const startDate = this.addDays(firstDay, -mondayOffset);

    return Array.from({ length: 42 }, (_, index) => {
      const date = this.addDays(startDate, index);
      const key = this.dateKey(date);
      const cycle = this.getCycleInfo(date);
      const record = this.cycleService.records()[key];

      const hasRecord = !!(
        record?.note.trim() ||
        record?.symptoms.length ||
        record?.flow
      );

      return {
        date,
        key,
        number: date.getDate(),
        currentMonth: date.getMonth() === firstDay.getMonth(),
        today: this.isSameDay(date, this.today),
        future: date > this.today,
        hasRecord,
        kind: cycle.kind,
        cycleDay: cycle.cycleDay,
      };
    });
  });

  readonly selectedRecord = computed(() => {
    return this.cycleService.records()[this.dateKey(this.selectedDate())] ?? {
      isPeriod: false,
      symptoms: [],
      flow: null,
      note: '',
    };
  });

  readonly canEditSelected = computed(() =>
    this.selectedDate() <= this.today
  );

  readonly selectedInfo = computed(() => {
    const date = this.selectedDate();
    const cycle = this.getCycleInfo(date);

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
      description: descriptions[cycle.kind],
      cycleDay: cycle.cycleDay,
      kind: cycle.kind,
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
  }

  nextMonthView(): void {
    this.currentMonth.update(month =>
      new Date(month.getFullYear(), month.getMonth() + 1, 1)
    );
  }

  selectDay(day: CalendarDay): void {
    this.selectedDate.set(day.date);

    const record = this.cycleService.records()[day.key];

    this.isPeriodDraft.set(record?.isPeriod ?? false);
    this.symptomsDraft.set(record?.symptoms ?? []);
    this.flowDraft.set(record?.flow ?? null);
    this.noteDraft.set(record?.note ?? '');
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

  saveSelectedDay(): void {
    if (!this.canEditSelected()) return;

    const record: DayRecord = {
      isPeriod: this.isPeriodDraft(),
      symptoms: this.symptomsDraft(),
      flow: this.flowDraft(),
      note: this.noteDraft().trim(),
    };

    this.cycleService.saveDay(
      this.dateKey(this.selectedDate()),
      record
    );
  }

  private getCycleInfo(date: Date): {
    kind: DayKind;
    cycleDay: number | null;
  } {
    const key = this.dateKey(date);
    const record = this.cycleService.records()[key];

    if (record?.isPeriod) {
      return {
        kind: 'confirmed',
        cycleDay: this.getCycleDay(date),
      };
    }

    const start = this.getLatestStart(date);

    if (!start) {
      return { kind: 'none', cycleDay: null };
    }

    const cycleLength = this.cycleLength();
    const periodLength = this.periodLength();

    const difference = this.daysBetween(start, date);
    const cycleDay = difference + 1;
    const nextStart = this.addDays(start, cycleLength);

    if (date >= nextStart) {
      if (date <= this.today) {
        return { kind: 'late', cycleDay };
      }

      const predictedEnd = this.addDays(nextStart, periodLength - 1);

      if (date <= predictedEnd) {
        return { kind: 'predicted', cycleDay };
      }

      return { kind: 'none', cycleDay };
    }

    const ovulationDay = Math.max(10, cycleLength - 14);

    if (cycleDay === ovulationDay) {
      return { kind: 'ovulation', cycleDay };
    }

    if (
      cycleDay >= ovulationDay - 5 &&
      cycleDay < ovulationDay
    ) {
      return { kind: 'fertile', cycleDay };
    }

    return { kind: 'none', cycleDay };
  }

  private getLatestStart(date: Date): Date | null {
    const starts = this.cycleService.getPeriodStarts()
      .filter(start => start <= date);

    return starts.length
      ? starts[starts.length - 1]
      : null;
  }

  private getCycleDay(date: Date): number | null {
    const start = this.getLatestStart(date);

    return start
      ? this.daysBetween(start, date) + 1
      : null;
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
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
