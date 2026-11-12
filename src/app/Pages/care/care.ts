import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { BloomApi, mensajeDeError } from '../../Core/Services/bloom-api.service';
import { Sesion } from '../../Core/Services/sesion.service';
import { Catalogos, RegistroDiario } from '../../Core/modelos';
import {
  backendAIntensidad,
  intensidadABackend,
  nombresACatalogo,
  registroANombres,
} from '../../Core/mapeos';

interface DayRecord {
  isPeriod: boolean;
  symptoms: string[];
  emotions: string[];
  sexualActivities: string[];
  note: string;
}

interface SymptomGroup {
  title: string;
  symptoms: string[];
}

interface CatalogOption {
  name: string;
  emoji: string;
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
    { value: 4, label: 'Abundante' }
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
        'Irritabilidad',
        'Tristeza',
        'Dificultad para dormir'
      ]
    }
  ];

  selectedSymptoms: string[] = [];

  emotionOptions: CatalogOption[] = [
    { name: 'Feliz', emoji: '😊' },
    { name: 'Con energía', emoji: '⚡' },
    { name: 'Tranquila', emoji: '😌' },
    { name: 'Sensible', emoji: '🥹' },
    { name: 'Cambios de humor', emoji: '🎭' },
    { name: 'Triste', emoji: '😔' },
    { name: 'Ansiosa', emoji: '😰' },
    { name: 'Irritable', emoji: '😤' }
  ];

  selectedEmotions: string[] = [];

  sexualActivityOptions: CatalogOption[] = [
    { name: 'Con protección', emoji: '🛡️' },
    { name: 'Sin protección', emoji: '💞' },
    { name: 'Masturbación', emoji: '🌸' }
  ];

  selectedSexualActivities: string[] = [];

  note = '';

  savedMessage = '';

  private readonly api = inject(BloomApi);
  private readonly sesion = inject(Sesion);

  private registros: Record<string, RegistroDiario> = {};

  private catalogos: Catalogos | null = null;

  history: HistoryItem[] = [];

  constructor() {
    this.cargarRegistros();
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
    return !!this.registros[this.selectedDate];
  }

  private get todosLosSintomas(): string[] {
    const nombres: string[] = [];
    for (const grupo of this.symptomGroups) {
      nombres.push(...grupo.symptoms);
    }
    return nombres;
  }

  private normalizar(texto: string): string {
    return (texto ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/_/g, ' ')
      .trim()
      .toLowerCase();
  }

  private nombresDe(lista: any[] | null | undefined, opciones: CatalogOption[]): string[] {
    const guardados = (lista ?? []).map(item => this.normalizar(item?.nombre));
    return opciones
      .filter(opcion => guardados.includes(this.normalizar(opcion.name)))
      .map(opcion => opcion.name);
  }

  private traducir(
    nombres: string[],
    catalogo: any[] | null | undefined
  ): { encontrados: any[]; noGuardados: string[] } {
    const encontrados: any[] = [];
    const noGuardados: string[] = [];

    for (const nombre of nombres) {
      const item = (catalogo ?? []).find(
        elemento => this.normalizar(elemento?.nombre) === this.normalizar(nombre)
      );
      if (item) {
        encontrados.push(item);
      } else {
        noGuardados.push(nombre);
      }
    }

    return { encontrados, noGuardados };
  }

  private aVista(registro: RegistroDiario): DayRecord {
    return {
      isPeriod: registro.hayMenstruacion,
      symptoms: registroANombres(registro, this.todosLosSintomas),
      emotions: this.nombresDe(registro.emociones, this.emotionOptions),
      sexualActivities: this.nombresDe(registro.actividadesSexuales, this.sexualActivityOptions),
      note: registro.nota ?? '',
    };
  }

  private async cargarRegistros(): Promise<void> {
    try {
      const lista = await this.api.verRegistros(this.sesion.idUsuario);
      const mapa: Record<string, RegistroDiario> = {};
      for (const registro of lista) {
        mapa[registro.fecha] = registro;
      }
      this.registros = mapa;
      this.history = lista
        .filter(registro => registro.fecha <= this.today)
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .map(registro => ({
          date: registro.fecha,
          label: new Date(`${registro.fecha}T12:00:00`).toLocaleDateString('es-CO', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          }),
          record: this.aVista(registro)
        }));
    } catch (error) {
      this.registros = {};
      this.history = [];
      this.savedMessage = mensajeDeError(error, 'No se pudieron cargar tus registros.');
    }
    this.loadRecord(this.selectedDate);
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
    const registro = this.registros[date];

    this.isPeriod = registro?.hayMenstruacion ?? false;

    this.flowIntensity = registro
      ? backendAIntensidad(registro.tipoFlujo, registro.hayMenstruacion)
      : 0;

    this.selectedSymptoms = registro
      ? registroANombres(registro, this.todosLosSintomas)
      : [];

    this.selectedEmotions = registro
      ? this.nombresDe(registro.emociones, this.emotionOptions)
      : [];

    this.selectedSexualActivities = registro
      ? this.nombresDe(registro.actividadesSexuales, this.sexualActivityOptions)
      : [];

    this.note = registro?.nota ?? '';
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

  isEmotionSelected(emotion: string): boolean {
    return this.selectedEmotions.includes(emotion);
  }

  toggleEmotion(emotion: string, checked: boolean): void {
    if (!this.canEditSelected) return;

    if (checked && !this.selectedEmotions.includes(emotion)) {
      this.selectedEmotions = [...this.selectedEmotions, emotion];
    } else if (!checked) {
      this.selectedEmotions = this.selectedEmotions.filter(
        item => item !== emotion
      );
    }
  }

  isSexualActivitySelected(activity: string): boolean {
    return this.selectedSexualActivities.includes(activity);
  }

  toggleSexualActivity(activity: string, checked: boolean): void {
    if (!this.canEditSelected) return;

    if (checked && !this.selectedSexualActivities.includes(activity)) {
      this.selectedSexualActivities = [...this.selectedSexualActivities, activity];
    } else if (!checked) {
      this.selectedSexualActivities = this.selectedSexualActivities.filter(
        item => item !== activity
      );
    }
  }

  private unirEmociones(
    primera: RegistroDiario['emociones'],
    segunda: RegistroDiario['emociones']
  ): RegistroDiario['emociones'] {
    const resultado: RegistroDiario['emociones'] = [];
    for (const emocion of [...primera, ...segunda]) {
      if (!resultado.some(e => e.idEmocion === emocion.idEmocion)) {
        resultado.push(emocion);
      }
    }
    return resultado;
  }

  async saveRecord(): Promise<void> {
    if (!this.canEditSelected) return;

    this.savedMessage = '';
    try {
      if (!this.catalogos) {
        this.catalogos = await this.api.verCatalogos();
      }
      const catalogos = this.catalogos as any;

      const traduccionSintomas = nombresACatalogo(this.selectedSymptoms, this.catalogos);
      const emociones = this.traducir(this.selectedEmotions, catalogos?.emociones);
      const actividades = this.traducir(this.selectedSexualActivities, catalogos?.actividadesSexuales);

      const registro: RegistroDiario = {
        fecha: this.selectedDate,
        hayMenstruacion: this.isPeriod,
        tipoFlujo: this.isPeriod ? intensidadABackend(this.flowIntensity) : null,
        nota: this.note.trim() || null,
        sintomas: traduccionSintomas.sintomas,
        emociones: this.unirEmociones(
          emociones.encontrados as RegistroDiario['emociones'],
          traduccionSintomas.emociones
        ),
        actividadesSexuales: actividades.encontrados as RegistroDiario['actividadesSexuales'],
      };


      await this.api.guardarRegistro(this.sesion.idUsuario, registro, this.hasRecord);
      await this.cargarRegistros();

      const sinGuardar: string[] = [
        ...traduccionSintomas.noGuardados,
        ...emociones.noGuardados,
        ...actividades.noGuardados
      ];

      this.savedMessage = sinGuardar.length === 0
        ? '¡Tu registro se guardó correctamente!'
        : '¡Tu registro se guardó! (No se encontró en el catálogo: ' + sinGuardar.join(', ') + '.)';
    } catch (error) {
      this.savedMessage = mensajeDeError(error, 'No se pudo guardar tu registro. Inténtalo de nuevo.');
    }
  }

  async deleteRecord(): Promise<void> {
    if (!this.canEditSelected || !this.hasRecord) return;

    const confirmed = window.confirm(
      '¿Estás segura de que deseas eliminar este registro? También se eliminará la información de ese día del calendario.'
    );

    if (!confirmed) return;

    try {
      await this.api.eliminarRegistro(this.sesion.idUsuario, this.selectedDate);
      await this.cargarRegistros();
      this.savedMessage = 'El registro fue eliminado.';
    } catch (error) {
      this.savedMessage = mensajeDeError(error, 'No se pudo eliminar el registro.');
    }
  }

  openRecord(date: string): void {
    this.selectDate(date);
  }

  getRecordEmoji(record: DayRecord): string {
    const first = record.emotions[0];
    const option = this.emotionOptions.find(item => item.name === first);
    return option ? option.emoji : '—';
  }

  getRecordSummary(record: DayRecord): string {
    const details: string[] = [];

    if (record.isPeriod) {
      details.push('Menstruación');
    }

    if (record.symptoms.length > 0) {
      details.push(`${record.symptoms.length} síntomas`);
    }

    if (record.emotions.length > 0) {
      details.push(
        record.emotions.length === 1
          ? `Emoción: ${record.emotions[0]}`
          : `${record.emotions.length} emociones`
      );
    }

    if (record.sexualActivities.length > 0) {
      details.push('Actividad sexual');
    }

    if (record.note.trim()) {
      details.push('Nota personal');
    }

    return details.length > 0
      ? details.join(' · ')
      : 'Registro diario';
  }
}
