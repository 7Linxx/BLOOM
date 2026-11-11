import { Injectable, signal } from '@angular/core';

export type MenstrualFlow =
  | 'ligero'
  | 'moderado'
  | 'abundante'
  | 'variable'
  | 'no_se';

export type DailyMood = 'general' | 'positivo' | 'negativo';

export interface DayRecord {
  isPeriod: boolean;
  symptoms: string[];
  flow: MenstrualFlow | null;
  note: string;

  // Información adicional del registro diario
  flowIntensity?: number;
  mood?: DailyMood | null;
  sexualActivity?: boolean | null;
  contraceptiveMethod?: string | null;
  temperature?: number | null;
  weight?: number | null;
}

interface SurveyCycle {
  inicio: string;
  fin: string | null;
}

interface CycleSurveyData {
  duracionCiclo: number | null;
  duracionPeriodo: number | null;
  ciclos: SurveyCycle[];
  pesoKg?: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class CycleService {
  private readonly storageKey = 'bloom_cycle_records';
  private readonly settingsKey = 'bloom_cycle_settings';

  readonly useFixedCycleRanges = signal(false);
  readonly records = signal<Record<string, DayRecord>>({});

  readonly cycleLength = signal(28);
  readonly periodLength = signal(5);
  readonly initialWeight = signal<number | null>(null);

  constructor() {
    this.loadData();
  }

  initializeFromSurvey(data: CycleSurveyData): void {
    if (data.duracionCiclo !== null) {
      this.cycleLength.set(data.duracionCiclo);
    }

    if (data.duracionPeriodo !== null) {
      this.periodLength.set(data.duracionPeriodo);
    }

    if (data.pesoKg !== undefined && data.pesoKg !== null) {
      this.initialWeight.set(data.pesoKg);
    }

    const updatedRecords = { ...this.records() };

    for (const cycle of data.ciclos) {
      if (!cycle.inicio) {
        continue;
      }

      const start = this.parseDate(cycle.inicio);

      const end = cycle.fin
        ? this.parseDate(cycle.fin)
        : this.addDays(start, this.periodLength() - 1);

      const current = new Date(start);

      while (current <= end) {
        const key = this.toDateKey(current);

        updatedRecords[key] = {
          ...updatedRecords[key],
          isPeriod: true,
          symptoms: updatedRecords[key]?.symptoms ?? [],
          flow: updatedRecords[key]?.flow ?? null,
          note: updatedRecords[key]?.note ?? '',
        };

        current.setDate(current.getDate() + 1);
      }
    }

    this.records.set(updatedRecords);
    this.persistData();
  }

  saveDay(key: string, record: DayRecord): void {
    const updatedRecords = { ...this.records() };

    const hasInformation =
      record.isPeriod ||
      record.symptoms.length > 0 ||
      record.flow !== null ||
      record.note.trim().length > 0 ||
      (record.flowIntensity ?? 0) > 0 ||
      record.mood != null ||
      record.sexualActivity != null ||
      record.contraceptiveMethod != null ||
      record.temperature != null ||
      record.weight != null;

    if (hasInformation) {
      updatedRecords[key] = {
        ...record,
        symptoms: [...record.symptoms],
        note: record.note.trim(),
      };
    } else {
      delete updatedRecords[key];
    }

    this.records.set(updatedRecords);
    this.persistData();
  }

  deleteDay(key: string): void {
    const updatedRecords = { ...this.records() };
    delete updatedRecords[key];

    this.records.set(updatedRecords);
    this.persistData();
  }

  getPeriodStarts(): Date[] {
    const periodKeys = Object.keys(this.records())
      .filter(key => this.records()[key].isPeriod)
      .sort();

    return periodKeys
      .filter((key, index) => {
        if (index === 0) {
          return true;
        }

        const currentDate = this.parseDate(key);
        const previousDate = this.parseDate(periodKeys[index - 1]);

        const difference = this.daysBetween(previousDate, currentDate);

        return difference > 1;
      })
      .map(key => this.parseDate(key));
  }

  getEstimatedCycleLength(starts: Date[]): number {
    if (starts.length < 2) {
      return this.cycleLength();
    }

    const differences: number[] = [];

    for (let index = 1; index < starts.length; index++) {
      differences.push(
        this.daysBetween(starts[index - 1], starts[index])
      );
    }

    const average =
      differences.reduce((total, days) => total + days, 0) /
      differences.length;

    return Math.round(Math.min(60, Math.max(15, average)));
  }

  getEstimatedPeriodLength(): number {
    return this.periodLength();
  }

  private loadData(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      const savedRecords = localStorage.getItem(this.storageKey);
      const savedSettings = localStorage.getItem(this.settingsKey);

      if (savedRecords) {
        this.records.set(JSON.parse(savedRecords));
      }

      if (savedSettings) {
        const settings = JSON.parse(savedSettings);

        if (typeof settings.cycleLength === 'number') {
          this.cycleLength.set(settings.cycleLength);
        }

        if (typeof settings.periodLength === 'number') {
          this.periodLength.set(settings.periodLength);
        }

        if (typeof settings.initialWeight === 'number') {
          this.initialWeight.set(settings.initialWeight);
        }

        if (typeof settings.useFixedCycleRanges === 'boolean') {
          this.useFixedCycleRanges.set(settings.useFixedCycleRanges);
        }

      }
    } catch {
      this.records.set({});
    }
  }

  private persistData(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify(this.records())
      );

      localStorage.setItem(
        this.settingsKey,
        JSON.stringify({
          cycleLength: this.cycleLength(),
          periodLength: this.periodLength(),
          initialWeight: this.initialWeight(),
          useFixedCycleRanges: this.useFixedCycleRanges(),
        })
      );
    } catch {
      console.error('No fue posible guardar los datos del ciclo.');
    }
  }

  private parseDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);

    return new Date(year, month - 1, day);
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private daysBetween(start: Date, end: Date): number {
    const startUtc = Date.UTC(
      start.getFullYear(),
      start.getMonth(),
      start.getDate()
    );

    const endUtc = Date.UTC(
      end.getFullYear(),
      end.getMonth(),
      end.getDate()
    );

    return Math.round((endUtc - startUtc) / 86400000);
  }
  setFixedCycleRanges(value: boolean): void {
    this.useFixedCycleRanges.set(value);

    this.persistData();
  }

  setInitialWeight(value: number | null): void {
    this.initialWeight.set(value);
    this.persistData();
  }
}
