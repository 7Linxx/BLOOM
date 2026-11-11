import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { CycleService, DayRecord } from '../../Core/Services/cycle.service';

type PeriodRange = '3m' | '6m' | '12m' | 'all';

interface CycleInfo {
  start: Date;
  duration: number;
}

interface PeriodInfo {
  start: Date;
  duration: number;
}

interface Indicator {
  title: string;
  value: string;
  description: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-analisis',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './analisis.html',
  styleUrl: './analisis.css'
})
export class Analisis {
  private cycleService = inject(CycleService);

  today = new Date();
  selectedRange: PeriodRange = '6m';

  rangeOptions = [
    { value: '3m', label: 'Últimos 3 meses' },
    { value: '6m', label: 'Últimos 6 meses' },
    { value: '12m', label: 'Último año' },
    { value: 'all', label: 'Todo el historial' }
  ];

  private get records(): Record<string, DayRecord> {
    return this.cycleService.records();
  }

  private get allPeriodDays(): Date[] {
    return Object.entries(this.records)
      .filter(([, record]) => record.isPeriod)
      .map(([key]) => this.parseDate(key))
      .filter((date): date is Date => date !== null)
      .sort((a, b) => a.getTime() - b.getTime());
  }

  private get allPeriodStarts(): Date[] {
    const days = this.allPeriodDays;
    const starts: Date[] = [];

    for (const day of days) {
      const previousDay = this.addDays(day, -1);

      const isFirstDay = !days.some(
        recordedDay => this.sameDay(recordedDay, previousDay)
      );

      if (isFirstDay) {
        starts.push(day);
      }
    }

    return starts;
  }

  private get allCycles(): CycleInfo[] {
    const starts = this.allPeriodStarts;
    const cycles: CycleInfo[] = [];

    for (let i = 0; i < starts.length - 1; i++) {
      const duration = this.daysBetween(starts[i], starts[i + 1]);

      if (duration > 0 && duration <= 90) {
        cycles.push({
          start: starts[i],
          duration
        });
      }
    }

    return cycles;
  }

  private get allPeriods(): PeriodInfo[] {
    const days = this.allPeriodDays;
    const periods: PeriodInfo[] = [];

    if (days.length === 0) {
      return periods;
    }

    let start = days[0];
    let duration = 1;
    let previous = days[0];

    for (let i = 1; i < days.length; i++) {
      const current = days[i];
      const difference = this.daysBetween(previous, current);

      if (difference === 1) {
        duration++;
      } else {
        periods.push({ start, duration });
        start = current;
        duration = 1;
      }

      previous = current;
    }

    periods.push({ start, duration });

    return periods;
  }

  private get rangeStart(): Date | null {
    if (this.selectedRange === 'all') {
      return null;
    }

    const months = Number(this.selectedRange.replace('m', ''));
    const date = new Date(
      this.today.getFullYear(),
      this.today.getMonth() - months,
      this.today.getDate()
    );

    return date;
  }

  private isInsideRange(date: Date): boolean {
    if (!this.rangeStart) {
      return true;
    }

    return date >= this.rangeStart && date <= this.today;
  }

  get filteredCycles(): CycleInfo[] {
    return this.allCycles.filter(cycle =>
      this.isInsideRange(cycle.start)
    );
  }

  get filteredPeriods(): PeriodInfo[] {
    return this.allPeriods.filter(period =>
      this.isInsideRange(period.start)
    );
  }

  get averageCycle(): number | null {
    const durations = this.filteredCycles.map(cycle => cycle.duration);

    if (durations.length === 0) {
      return null;
    }

    return Math.round(
      durations.reduce((total, value) => total + value, 0) /
      durations.length
    );
  }

  get averagePeriod(): number | null {
    const durations = this.filteredPeriods.map(period => period.duration);

    if (durations.length === 0) {
      return null;
    }

    return Math.round(
      durations.reduce((total, value) => total + value, 0) /
      durations.length
    );
  }

  get shortestCycle(): number | null {
    const durations = this.filteredCycles.map(cycle => cycle.duration);

    return durations.length > 0 ? Math.min(...durations) : null;
  }

  get longestCycle(): number | null {
    const durations = this.filteredCycles.map(cycle => cycle.duration);

    return durations.length > 0 ? Math.max(...durations) : null;
  }

  get frequentSymptom(): string {
    const symptomCounts = new Map<string, number>();

    Object.entries(this.records).forEach(([key, record]) => {
      const date = this.parseDate(key);

      if (!date || !this.isInsideRange(date)) {
        return;
      }

      (record.symptoms ?? []).forEach(symptom => {
        symptomCounts.set(
          symptom,
          (symptomCounts.get(symptom) ?? 0) + 1
        );
      });
    });

    let mostFrequent = '';
    let highestCount = 0;

    symptomCounts.forEach((count, symptom) => {
      if (count > highestCount) {
        highestCount = count;
        mostFrequent = symptom;
      }
    });

    return mostFrequent;
  }

  get frequentSymptomCount(): number {
    if (!this.frequentSymptom) {
      return 0;
    }

    let count = 0;

    Object.entries(this.records).forEach(([key, record]) => {
      const date = this.parseDate(key);

      if (
        date &&
        this.isInsideRange(date) &&
        (record.symptoms ?? []).includes(this.frequentSymptom)
      ) {
        count++;
      }
    });

    return count;
  }

  get confirmedCycleStart(): Date | null {
    const starts = this.allPeriodStarts.filter(
      date => date <= this.today
    );

    return starts.length > 0 ? starts[starts.length - 1] : null;
  }

  get currentCycleDay(): number | null {
    if (!this.confirmedCycleStart) {
      return null;
    }

    return this.daysBetween(this.confirmedCycleStart, this.today) + 1;
  }

  get estimatedCycleDuration(): number {
    return this.cycleService.getEstimatedCycleLength(
      this.cycleService.getPeriodStarts()
    );
  }
  get estimatedPeriodDuration(): number {
    return this.averagePeriod ??
      this.cycleService.getEstimatedPeriodLength();
  }

  get nextPeriodDate(): Date | null {
    if (!this.confirmedCycleStart) {
      return null;
    }

    return this.addDays(
      this.confirmedCycleStart,
      this.estimatedCycleDuration
    );
  }

  get daysUntilNextPeriod(): number | null {
    if (!this.nextPeriodDate) {
      return null;
    }

    return this.daysBetween(this.today, this.nextPeriodDate);
  }

  get hasCycleHistory(): boolean {
    return this.allPeriodStarts.length > 0;
  }

  get hasEnoughCycleData(): boolean {
    return this.filteredCycles.length > 0;
  }

  get totalCycles(): number {
    return this.filteredCycles.length;
  }

  get totalPeriods(): number {
    return this.filteredPeriods.length;
  }

  get calculationMethod(): string {
    return this.allCycles.length >= 2
      ? 'Historial de ciclos'
      : 'Datos de tu registro inicial';
  }

  get calculationDescription(): string {
    return this.allCycles.length >= 2
      ? 'BLOOM utiliza tus ciclos registrados para estimar las próximas fechas.'
      : 'Aún no hay suficientes ciclos registrados. Por ahora se utilizan los valores de tu registro inicial.';
  }

  get cycleIndicators(): Indicator[] {
    return [
      {
        title: 'Duración promedio del ciclo',
        value: this.averageCycle !== null
          ? `${this.averageCycle} días`
          : this.hasCycleHistory
            ? `${this.estimatedCycleDuration} días`
            : 'Sin datos',
        description: this.averageCycle !== null
          ? 'Promedio de tus ciclos registrados'
          : 'Valor de tu registro inicial',
        icon: '♡',
        color: 'pink'
      },
      {
        title: 'Duración promedio del periodo',
        value: this.averagePeriod !== null
          ? `${this.averagePeriod} días`
          : this.hasCycleHistory
            ? `${this.estimatedPeriodDuration} días`
            : 'Sin datos',
        description: this.averagePeriod !== null
          ? 'Promedio de tus menstruaciones'
          : 'Valor de tu registro inicial',
        icon: '✿',
        color: 'peach'
      },
      {
        title: 'Ciclo más corto',
        value: this.shortestCycle !== null
          ? `${this.shortestCycle} días`
          : 'Sin datos',
        description: 'Entre los ciclos registrados',
        icon: '↓',
        color: 'lilac'
      },
      {
        title: 'Ciclo más largo',
        value: this.longestCycle !== null
          ? `${this.longestCycle} días`
          : 'Sin datos',
        description: 'Entre los ciclos registrados',
        icon: '↑',
        color: 'yellow'
      }
    ];
  }

  get trackingIndicators(): Indicator[] {
    return [
      {
        title: 'Día actual del ciclo',
        value: this.currentCycleDay !== null
          ? `Día ${this.currentCycleDay}`
          : 'Sin datos',
        description: 'Desde el último inicio confirmado',
        icon: '☼',
        color: 'peach'
      },
      {
        title: 'Próximo periodo estimado',
        value: this.nextPeriodDate
          ? this.formatDate(this.nextPeriodDate)
          : 'Sin estimación',
        description: 'Fecha aproximada, no confirmada',
        icon: '♡',
        color: 'pink'
      },
      {
        title: 'Duración estimada del ciclo',
        value: this.hasCycleHistory || this.cycleService.cycleLength()
          ? `${this.estimatedCycleDuration} días`
          : 'Sin datos',
        description: 'Según tu historial o registro inicial',
        icon: '◷',
        color: 'lilac'
      },
      {
        title: 'Días para el próximo periodo',
        value: this.daysUntilNextPeriod !== null
          ? this.daysUntilNextPeriod >= 0
            ? `${this.daysUntilNextPeriod} días`
            : `${Math.abs(this.daysUntilNextPeriod)} días de retraso`
          : 'Sin estimación',
        description: 'Cálculo basado en tus registros',
        icon: '✧',
        color: 'yellow'
      }
    ];
  }

  get symptomMessage(): string {
    if (!this.frequentSymptom) {
      return 'Todavía no hay síntomas registrados en este periodo.';
    }

    return `Has registrado ${this.frequentSymptom.toLowerCase()} ${this.frequentSymptomCount} ${
      this.frequentSymptomCount === 1 ? 'vez' : 'veces'
    }.`;
  }

  changeRange(value: string): void {
    if (
      value === '3m' ||
      value === '6m' ||
      value === '12m' ||
      value === 'all'
    ) {
      this.selectedRange = value;
    }
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
  }

  private parseDate(key: string): Date | null {
    const parts = key.split('-').map(Number);

    if (parts.length !== 3 || parts.some(part => Number.isNaN(part))) {
      return null;
    }

    const [year, month, day] = parts;
    const date = new Date(year, month - 1, day);

    return this.isValidDate(date) ? date : null;
  }

  private isValidDate(date: Date): boolean {
    return !Number.isNaN(date.getTime());
  }

  private addDays(date: Date, amount: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + amount);
    return result;
  }

  private daysBetween(start: Date, end: Date): number {
    const first = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate()
    );

    const second = new Date(
      end.getFullYear(),
      end.getMonth(),
      end.getDate()
    );

    return Math.round(
      (second.getTime() - first.getTime()) / 86400000
    );
  }

  private sameDay(first: Date, second: Date): boolean {
    return first.getFullYear() === second.getFullYear() &&
      first.getMonth() === second.getMonth() &&
      first.getDate() === second.getDate();
  }
}
