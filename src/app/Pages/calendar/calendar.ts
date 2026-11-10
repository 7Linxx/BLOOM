
import { Component, computed, signal } from '@angular/core';

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

  readonly today = this.normalizeDate(new Date());

  // Datos demostrativos del ciclo
  readonly cycleLength = 28;
  readonly periodLength = 5;
  readonly lastPeriodStart = this.addDays(this.today, -12);

  readonly ovulationDay = this.cycleLength - 14;

  readonly currentMonth = signal(
    new Date(this.today.getFullYear(), this.today.getMonth(), 1)
  );

  readonly selectedDate = signal(this.today);

  readonly monthLabel = computed(() =>
    this.currentMonth().toLocaleDateString('es-CO', {
      month: 'long',
      year: 'numeric',
    })
  );

  readonly calendarDays = computed((): CalendarDay[] => {
    const firstDay = this.currentMonth();
    const mondayOffset = (firstDay.getDay() + 6) % 7;

    const startDate = this.addDays(firstDay, -mondayOffset);

    return Array.from({ length: 42 }, (_, index) => {
      const date = this.addDays(startDate, index);
      const cycle = this.getCycleInfo(date);

      return {
        date,
        key: this.dateKey(date),
        number: date.getDate(),
        currentMonth: date.getMonth() === firstDay.getMonth(),
        today: this.isSameDay(date, this.today),
        kind: cycle.kind,
        cycleDay: cycle.cycleDay,
      };
    });
  });

  readonly nextPeriod = this.addDays(
    this.lastPeriodStart,
    this.cycleLength
  );

  readonly nextOvulation = this.addDays(
    this.lastPeriodStart,
    this.ovulationDay - 1
  );

  readonly daysUntilPeriod = Math.max(
    0,
    this.daysBetween(this.today, this.nextPeriod)
  );

  readonly daysUntilOvulation = Math.max(
    0,
    this.daysBetween(this.today, this.nextOvulation)
  );

  readonly selectedInfo = computed(() => {
    const date = this.selectedDate();
    const cycle = this.getCycleInfo(date);

    const descriptions: Record<DayKind, string> = {
      confirmed: 'Menstruación registrada',
      predicted: 'Menstruación estimada',
      fertile: 'Ventana fértil estimada',
      ovulation: 'Ovulación estimada',
      late: 'Posible retraso menstrual',
      none: 'Sin eventos registrados',
    };

    return {
      date: date.toLocaleDateString('es-CO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
      description: descriptions[cycle.kind],
      cycleDay: cycle.cycleDay,
      kind: cycle.kind,
    };
  });

  readonly legend = [
    { kind: 'confirmed', label: 'Menstruación' },
    { kind: 'predicted', label: 'Menstruación estimada' },
    { kind: 'fertile', label: 'Días fértiles' },
    { kind: 'ovulation', label: 'Ovulación' },
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
  }

  isSelected(day: CalendarDay): boolean {
    return this.isSameDay(day.date, this.selectedDate());
  }

  private getCycleInfo(date: Date): {
    kind: DayKind;
    cycleDay: number | null;
  } {
    const difference = this.daysBetween(
      this.lastPeriodStart,
      date
    );

    if (difference < 0) {
      return { kind: 'none', cycleDay: null };
    }

    const cycleNumber = Math.floor(difference / this.cycleLength);
    const dayInCycle = difference % this.cycleLength + 1;

    // Menstruación del ciclo inicial
    if (cycleNumber === 0 && dayInCycle <= this.periodLength) {
      return { kind: 'confirmed', cycleDay: dayInCycle };
    }

    // Periodo que ya debería haber llegado
    if (cycleNumber >= 1 && date <= this.today) {
      return { kind: 'late', cycleDay: dayInCycle };
    }

    // Menstruaciones futuras estimadas
    if (cycleNumber >= 1 && dayInCycle <= this.periodLength) {
      return { kind: 'predicted', cycleDay: dayInCycle };
    }

    // Ovulación
    if (dayInCycle === this.ovulationDay) {
      return { kind: 'ovulation', cycleDay: dayInCycle };
    }

    // Ventana fértil
    if (
      dayInCycle >= this.ovulationDay - 5 &&
      dayInCycle < this.ovulationDay
    ) {
      return { kind: 'fertile', cycleDay: dayInCycle };
    }

    return { kind: 'none', cycleDay: dayInCycle };
  }

  private normalizeDate(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return this.normalizeDate(result);
  }

  private daysBetween(start: Date, end: Date): number {
    const oneDay = 24 * 60 * 60 * 1000;

    return Math.round(
      (this.normalizeDate(end).getTime() -
        this.normalizeDate(start).getTime()) / oneDay
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
