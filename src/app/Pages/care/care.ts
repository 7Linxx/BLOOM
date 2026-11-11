
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CycleService,
  DayRecord,
  DailyMood
} from '../../Core/Services/cycle.service';

type MoodOption = 'general' | 'positivo' | 'negativo';

interface SymptomGroup {
  title: string;
  symptoms: string[];
}

interface HistoryItem {
  date: string;
  label: string;
  record: DayRecord;
}

@Component({
  selector: 'app-care',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './care.html',
  styleUrl: './care.css'
})
export class Care {
  today = this.getLocalDate();
  selectedDate = this.today;

  isPeriod = false;
  flowIntensity = 0;

  flowLevels = [
    { value: 0, label: 'Ninguno' },
    { value: 1, label: 'Muy ligero' },
    { value: 2, label: 'Ligero' },
    { value: 3, label: 'Moderado' },
    { value: 4, label: 'Abundante' },
    { value: 5, label: 'Muy abundante' }
  ];

  symptomGroups: SymptomGroup[] = [
    {
      title: 'Síntomas físicos',
      symptoms: [
        'Cólicos',
        'Dolor de cabeza',
        'Dolor de espalda',
        'Sensibilidad en los senos',
        'Hinchazón',
        'Acné',
        'Fatiga',
        'Náuseas',
        'Mareos'
      ]
    },
    {
      title: 'Síntomas emocionales',
      symptoms: [
        'Ansiedad',
        'Estrés',
        'Irritabilidad',
        'Tristeza',
        'Cambios de humor',
        'Dificultad para dormir'
      ]
    }
  ];

  selectedSymptoms: string[] = [];

  mood: MoodOption | null = null;

  sexualActivity: boolean | null = null;

  contraceptiveMethod = '';

  contraceptiveOptions = [
    'Ninguno',
    'Pastillas anticonceptivas',
    'Inyección',
    'Implante subdérmico',
    'DIU hormonal',
    'DIU de cobre',
    'Parche anticonceptivo',
    'Anillo vaginal',
    'Preservativo',
    'Otro'
  ];

  temperature: number | null = null;
  weight: number | null = null;
  note = '';

  savedMessage = '';

  constructor(public cycleService: CycleService) {
    this.loadRecord(this.today);
  }

  get selectedDateLabel(): string {
    const date = new Date(`${this.selectedDate}T12:00:00`);

    return date.toLocaleDateString('es-CO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  get canEditSelected(): boolean {
    return this.selectedDate <= this.today;
  }

  get hasRecord(): boolean {
    return !!this.cycleService.records()[this.selectedDate];
  }

  get history(): HistoryItem[] {
    return Object.entries(this.cycleService.records())
      .filter(([date]) => date <= this.today)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, record]) => ({
        date,
        label: new Date(`${date}T12:00:00`).toLocaleDateString('es-CO', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        }),
        record
      }));
  }

  get hasAnyInformation(): boolean {
    return (
      this.isPeriod ||
      this.selectedSymptoms.length > 0 ||
      this.mood !== null ||
      this.sexualActivity !== null ||
      this.contraceptiveMethod !== '' ||
      this.temperature !== null ||
      this.weight !== null ||
      this.note.trim() !== ''
    );
  }

  private getLocalDate(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  selectDate(date: string): void {
    if (!date) return;

    this.selectedDate = date;
    this.savedMessage = '';
    this.loadRecord(date);
  }

  private loadRecord(date: string): void {
    const record = this.cycleService.records()[date];

    this.isPeriod = record?.isPeriod ?? false;

    this.flowIntensity = record?.flowIntensity ??
      (record?.isPeriod ? 1 : 0);

    this.selectedSymptoms = record?.symptoms
      ? [...record.symptoms]
      : [];

    this.mood = record?.mood ?? null;

    this.sexualActivity = record?.sexualActivity ?? null;

    this.contraceptiveMethod = record?.contraceptiveMethod ?? '';

    this.temperature = record?.temperature ?? null;

    this.weight = record?.weight ??
      this.cycleService.initialWeight();

    this.note = record?.note ?? '';
  }

  onPeriodChange(value: boolean): void {
    this.isPeriod = value;

    if (!value) {
      this.flowIntensity = 0;
    } else if (this.flowIntensity === 0) {
      this.flowIntensity = 1;
    }
  }

  setFlow(value: number): void {
    if (!this.canEditSelected) return;

    this.flowIntensity = value;
    this.isPeriod = value > 0;
  }

  isSymptomSelected(symptom: string): boolean {
    return this.selectedSymptoms.includes(symptom);
  }

  toggleSymptom(symptom: string, checked: boolean): void {
    if (!this.canEditSelected) return;

    if (checked && !this.selectedSymptoms.includes(symptom)) {
      this.selectedSymptoms = [...this.selectedSymptoms, symptom];
    } else if (!checked) {
      this.selectedSymptoms = this.selectedSymptoms.filter(
        item => item !== symptom
      );
    }
  }

  setMood(value: MoodOption): void {
    if (!this.canEditSelected) return;
    this.mood = value;
  }

  saveRecord(): void {
    if (!this.canEditSelected) return;

    const record: DayRecord = {
      isPeriod: this.isPeriod,
      symptoms: [...this.selectedSymptoms],
      flow: this.isPeriod ? this.getMenstrualFlow() : null,
      flowIntensity: this.isPeriod ? this.flowIntensity : 0,
      mood: this.mood as DailyMood | null,
      sexualActivity: this.sexualActivity,
      contraceptiveMethod: this.contraceptiveMethod || null,
      temperature: this.temperature,
      weight: this.weight,
      note: this.note.trim()
    };

    this.cycleService.saveDay(this.selectedDate, record);

    this.savedMessage = '¡Tu registro se guardó correctamente!';
  }

  deleteRecord(): void {
    if (!this.canEditSelected || !this.hasRecord) return;

    const confirmed = window.confirm(
      '¿Estás segura de que deseas eliminar este registro? También se eliminará la información de ese día del calendario.'
    );

    if (!confirmed) return;

    this.cycleService.deleteDay(this.selectedDate);
    this.loadRecord(this.selectedDate);

    this.savedMessage = 'El registro fue eliminado.';
  }

  openRecord(date: string): void {
    this.selectDate(date);
  }

  getMoodEmoji(mood: string | null | undefined): string {
    switch (mood) {
      case 'positivo':
        return '😊';
      case 'negativo':
        return '😔';
      case 'general':
        return '😐';
      default:
        return '—';
    }
  }

  getRecordSummary(record: DayRecord): string {
    const details: string[] = [];

    if (record.isPeriod) {
      details.push('Menstruación');
    }

    if (record.symptoms.length > 0) {
      details.push(`${record.symptoms.length} síntomas`);
    }

    if (record.mood) {
      details.push(`Ánimo: ${record.mood}`);
    }

    if (record.temperature !== null && record.temperature !== undefined) {
      details.push('Temperatura');
    }

    if (record.note.trim()) {
      details.push('Nota personal');
    }

    return details.length > 0
      ? details.join(' · ')
      : 'Registro diario';
  }

  private getMenstrualFlow(): DayRecord['flow'] {
    if (this.flowIntensity <= 1) return 'ligero';
    if (this.flowIntensity === 2) return 'ligero';
    if (this.flowIntensity === 3) return 'moderado';
    return 'abundante';
  }
}
