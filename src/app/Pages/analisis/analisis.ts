import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';

import { BloomApi, mensajeDeError } from '../../Core/Services/bloom-api.service';
import { Sesion } from '../../Core/Services/sesion.service';
import { CicloActual, EstadisticaPeriodo, EstadisticaResumen } from '../../Core/modelos';
import { textoAFecha } from '../../Core/mapeos';

type PeriodRange = '3m' | '6m' | '12m' | 'all';

interface Indicator {
  title: string;
  value: string;
  description: string;
  icon: string;
  color: string;
}

interface SymptomRank {
  position: number;
  name: string;
  count: number;
  percent: number;
}

interface CycleRow {
  start: Date | null;
  end: Date | null;
  days: number | null;
  inProgress: boolean;
}

type Estadistica = EstadisticaResumen | EstadisticaPeriodo;

@Component({
  selector: 'app-analisis',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './analisis.html',
  styleUrl: './analisis.css'
})
export class Analisis {
  private readonly api = inject(BloomApi);
  private readonly sesion = inject(Sesion);

  today = new Date();
  selectedRange: PeriodRange = '6m';

  rangeOptions = [
    { value: '3m', label: 'Últimos 3 meses' },
    { value: '6m', label: 'Últimos 6 meses' },
    { value: '12m', label: 'Último año' },
    { value: 'all', label: 'Todo el historial' }
  ];

  private estadistica: Estadistica | null = null;

  private cicloActual: CicloActual | null = null;

  private cycleRows: CycleRow[] = [];

  private readonly cyclesPreview = 6;
  showAllCycles = false;

  errorMessage = '';

  constructor() {
    this.cargarEstadisticas();
    this.api.verCicloActual(this.sesion.idUsuario)
      .then(ciclo => this.cicloActual = ciclo)
      .catch(() => this.cicloActual = null);
    this.cargarCiclos();
  }

  get totalCycles(): number {
    return this.estadistica?.totalCiclos ?? 0;
  }

  get frequentSymptom(): string {
    return this.estadistica?.sintomasFrecuentes?.[0]?.nombre ?? '';
  }

  get frequentSymptomCount(): number {
    return this.estadistica?.sintomasFrecuentes?.[0]?.conteo ?? 0;
  }

  get topSymptoms(): SymptomRank[] {
    const lista = (this.estadistica?.sintomasFrecuentes ?? []).slice(0, 5);
    const maximo = Math.max(0, ...lista.map(item => item.conteo ?? 0));

    return lista.map((item, index) => ({
      position: index + 1,
      name: item.nombre,
      count: item.conteo ?? 0,
      percent: maximo > 0 ? Math.round(((item.conteo ?? 0) / maximo) * 100) : 0
    }));
  }

  get visibleCycles(): CycleRow[] {
    return this.showAllCycles
      ? this.cycleRows
      : this.cycleRows.slice(0, this.cyclesPreview);
  }

  get totalCycleRows(): number {
    return this.cycleRows.length;
  }

  get canToggleCycles(): boolean {
    return this.cycleRows.length > this.cyclesPreview;
  }

  get nextPeriodDate(): Date | null {
    return this.cicloActual ? textoAFecha(this.cicloActual.fechaEstimadaSiguientePeriodo) : null;
  }

  get calculationMethod(): string {
    return this.cicloActual?.metodoCalculo === 'MANUAL'
      ? 'Duración fija de tus ajustes'
      : 'Historial de ciclos';
  }

  get calculationDescription(): string {
    return this.cicloActual?.metodoCalculo === 'MANUAL'
      ? 'Elegiste el cálculo manual: BLOOM usa la duración de ciclo que guardaste en tu perfil.'
      : 'BLOOM utiliza el promedio de tus últimos ciclos registrados para estimar las próximas fechas.';
  }

  get cycleIndicators(): Indicator[] {
    const e = this.estadistica;
    return [
      {
        title: 'Duración promedio del ciclo',
        value: this.dias(e?.promedioDuracionCiclo),
        description: 'Promedio de tus ciclos finalizados',
        icon: '♡',
        color: 'pink'
      },
      {
        title: 'Duración promedio del periodo',
        value: this.dias(e?.promedioDuracionPeriodo),
        description: 'Promedio de tus menstruaciones',
        icon: '✿',
        color: 'peach'
      },
      {
        title: 'Ciclo más corto',
        value: this.dias(e?.cicloMasCorto?.duracion),
        description: 'Entre los ciclos finalizados',
        icon: '↓',
        color: 'lilac'
      },
      {
        title: 'Ciclo más largo',
        value: this.dias(e?.cicloMasLargo?.duracion),
        description: 'Entre los ciclos finalizados',
        icon: '↑',
        color: 'yellow'
      }
    ];
  }

  get trackingIndicators(): Indicator[] {
    const ciclo = this.cicloActual;
    return [
      {
        title: 'Día actual del ciclo',
        value: ciclo ? `Día ${ciclo.diaDelCiclo}` : 'Sin datos',
        description: 'Desde el último inicio confirmado',
        icon: '☼',
        color: 'peach'
      },
      {
        title: 'Próximo periodo estimado',
        value: this.nextPeriodDate ? this.formatDate(this.nextPeriodDate) : 'Sin estimación',
        description: 'Fecha aproximada, no confirmada',
        icon: '♡',
        color: 'pink'
      },
      {
        title: 'Duración estimada del ciclo',
        value: ciclo ? `${ciclo.duracionEstimada} días` : 'Sin datos',
        description: 'Según tu historial o tus ajustes',
        icon: '◷',
        color: 'lilac'
      },
      {
        title: 'Días para el próximo periodo',
        value: !ciclo
          ? 'Sin estimación'
          : ciclo.periodoRetrasado
            ? `${ciclo.diasRetraso} días de retraso`
            : `${ciclo.diasParaSiguientePeriodo} días`,
        description: 'Cálculo basado en tus registros',
        icon: '✧',
        color: 'yellow'
      }
    ];
  }

  get symptomMessage(): string {
    if (this.errorMessage) {
      return this.errorMessage;
    }
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
      this.cargarEstadisticas();
    }
  }

  toggleCycles(): void {
    this.showAllCycles = !this.showAllCycles;
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
  }

  private async cargarEstadisticas(): Promise<void> {
    this.errorMessage = '';
    try {
      if (this.selectedRange === 'all') {
        this.estadistica = await this.api.verEstadisticas(this.sesion.idUsuario);
      } else {
        const meses = Number(this.selectedRange.replace('m', ''));
        const desde = new Date(this.today.getFullYear(), this.today.getMonth() - meses + 1, 1);
        this.estadistica = await this.api.verEstadisticasPeriodo(
          this.sesion.idUsuario,
          this.anioMes(desde),
          this.anioMes(this.today)
        );
      }
    } catch (error) {
      this.estadistica = null;
      this.errorMessage = mensajeDeError(error, 'No se pudieron cargar tus estadísticas.');
    }
  }

  private async cargarCiclos(): Promise<void> {
    try {
      const lista: any[] = await (this.api as any).verCiclos(this.sesion.idUsuario);
      this.cycleRows = (lista ?? [])
        .map(ciclo => this.aFila(ciclo))
        .sort((a, b) => (b.start?.getTime() ?? 0) - (a.start?.getTime() ?? 0));
    } catch {
      this.cycleRows = [];
    }
  }

  private aFila(ciclo: any): CycleRow {
    const start = ciclo?.fechaInicio ? textoAFecha(ciclo.fechaInicio) : null;
    const end = ciclo?.fechaFin ? textoAFecha(ciclo.fechaFin) : null;

    let days: number | null = ciclo?.duracion ?? ciclo?.duracionCiclo ?? null;
    if (days === null && start && end) {
      days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    }

    return { start, end, days, inProgress: !end };
  }

  private anioMes(fecha: Date): string {
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
  }

  private dias(valor: number | null | undefined): string {
    return valor !== null && valor !== undefined ? `${Math.round(valor)} días` : 'Sin datos';
  }
}
