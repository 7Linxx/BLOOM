
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { BloomApi } from '../../Core/Services/bloom-api.service';
import { Sesion } from '../../Core/Services/sesion.service';
import { CicloActual, DiaCalendario } from '../../Core/modelos';
import { fechaATexto, indicadorATipoDia, textoAFecha } from '../../Core/mapeos';

type DayKind = 'predicted' | 'confirmed' | 'fertile' | 'ovulation' | 'late' | 'none';

interface WeekDay {
  label: string;
  num: number;
  kind: DayKind;
  isToday: boolean;
  isFuture: boolean;
  hasNote: boolean;
}

interface Article {
  id: number;
  titulo: string;
  resumen: string;
  categoria: string;
  imagen?: string;
  enlace: string;
  tono: 'rose' | 'lilac' | 'butter';
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private readonly api = inject(BloomApi);
  private readonly sesion = inject(Sesion);

  constructor() {
    this.cargarDatos();
  }

  // DATOS GENERALES

  readonly today = new Date();

  // Apodo de la usuaria que inició sesión.
  apodo = signal(this.sesion.usuaria()?.apodo ?? '');

  fechaLarga = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(this.today);

  greeting = computed(() => {
    const hour = this.today.getHours();

    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';

    return 'Buenas noches';
  });

  cicloActual = signal<CicloActual | null>(null);

  cycleLength = computed(() => this.cicloActual()?.duracionEstimada ?? 28);
  periodLength = computed(() => this.cicloActual()?.duracionEstimadaMenstruacion ?? 5);

  private diaDelCiclo = computed(() => this.cicloActual()?.diaDelCiclo ?? 1);

  cycleDay = computed(() => this.cicloActual() ? this.diaDelCiclo() : '—');

  ovulationDay = computed(() => {
    const ciclo = this.cicloActual();
    if (!ciclo) {
      return this.cycleLength() - 14;
    }
    return this.daysBetween(textoAFecha(ciclo.fechaInicio), textoAFecha(ciclo.fechaEstimadaOvulacion)) + 1;
  });

  periodoRetrasado = computed(() => this.cicloActual()?.periodoRetrasado ?? false);

  nextPeriod = computed(() => {
    const ciclo = this.cicloActual();
    return ciclo ? this.formatDate(textoAFecha(ciclo.fechaEstimadaSiguientePeriodo)) : 'Sin datos';
  });

  nextOvulation = computed(() => {
    const ciclo = this.cicloActual();
    return ciclo ? this.formatDate(textoAFecha(ciclo.fechaEstimadaOvulacion)) : 'Sin datos';
  });

  phase = computed(() => {
    switch (this.cicloActual()?.fase) {
      case 'MENSTRUAL':
        return {
          name: 'Fase menstrual',
          tone: 'menstrual',
          msg: 'Un momento para descansar y escucharte.',
        };
      case 'FOLICULAR':
        return {
          name: 'Fase folicular',
          tone: 'follicular',
          msg: 'Una etapa de renovación y energía.',
        };
      case 'OVULATORIA':
        return {
          name: 'Ventana fértil estimada',
          tone: 'fertile',
          msg: 'Tu cuerpo se acerca a la ovulación.',
        };
      case 'LUTEA':
        return {
          name: 'Fase lútea',
          tone: 'luteal',
          msg: 'Un momento para priorizar tu bienestar.',
        };
      default:
        return {
          name: 'Sin datos del ciclo',
          tone: 'follicular',
          msg: 'Registra tu menstruación para empezar a ver tu ciclo.',
        };
    }
  });


  // CÍRCULO DEL CICLO

  readonly R = 82;
  readonly C = 2 * Math.PI * this.R;

  periodArc = computed(() => {
    return this.arc(1, this.periodLength());
  });

  fertileArc = computed(() => {
    const start = Math.max(1, this.ovulationDay() - 5);
    return this.arc(start, 6);
  });

  marker = computed(() => {
    const angle =
      ((this.diaDelCiclo() - 1) / this.cycleLength()) *
      2 * Math.PI - Math.PI / 2;

    return {
      x: 100 + this.R * Math.cos(angle),
      y: 100 + this.R * Math.sin(angle),
    };
  });

  private arc(startDay: number, duration: number) {
    const fraction = Math.min(duration / this.cycleLength(), 1);
    const length = this.C * fraction;

    return {
      dasharray: `${length} ${this.C}`,
      dashoffset: -this.C * ((startDay - 1) / this.cycleLength()),
    };
  }


  // LEYENDA DEL CICLO

  legend = [
    { kind: 'confirmed', label: 'Periodo registrado' },
    { kind: 'predicted', label: 'Periodo estimado' },
    { kind: 'fertile', label: 'Ventana fértil' },
    { kind: 'ovulation', label: 'Ovulación estimada' },
  ];


  // ESTADO DE ÁNIMO

  moods = [
    { emoji: '😊', label: 'Feliz' },
    { emoji: '🥰', label: 'Tranquila' },
    { emoji: '😐', label: 'Neutral' },
    { emoji: '😔', label: 'Triste' },
    { emoji: '😣', label: 'Estresada' },
    { emoji: '😴', label: 'Cansada' },
  ];

  selectedMood = signal('');

  pickMood(mood: string) {
    this.selectedMood.set(mood);
  }

  diasCalendario = signal<Record<string, DiaCalendario>>({});

  week = computed<WeekDay[]>(() => {
    const currentDate = this.stripTime(this.today);
    const firstDay = new Date(currentDate);

    const dayOfWeek = (firstDay.getDay() + 6) % 7;
    firstDay.setDate(firstDay.getDate() - dayOfWeek);

    const labels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    return labels.map((label, index) => {
      const date = this.addDays(firstDay, index);
      const isToday = this.sameDay(date, currentDate);

      const dia = this.diasCalendario()[fechaATexto(date)];

      return {
        label,
        num: date.getDate(),
        kind: indicadorATipoDia(dia?.indicador) as DayKind,
        isToday,
        isFuture: date > currentDate,
        hasNote: dia?.tieneRegistro ?? false,
      };
    });
  });


  // ESTADÍSTICAS (GET /usuarias/{id}/estadisticas, viene de MongoDB)

  stats = signal([
    {
      icon: '🌸',
      label: 'Duración promedio del ciclo',
      value: '—',
      unit: 'días',
    },
    {
      icon: '🩸',
      label: 'Duración promedio del periodo',
      value: '—',
      unit: 'días',
    },
    {
      icon: '📅',
      label: 'Ciclos registrados',
      value: '—',
      unit: 'ciclos',
    },
  ]);

  sintomaFrecuente = signal('Todavía no hay información');


  // ARTÍCULOS (GET /articulos: se muestran los 3 primeros)

  articles = signal<Article[]>([]);


  private cargarDatos(): void {
    const usuaria = this.sesion.usuaria();
    if (!usuaria) {
      return;
    }
    const id = usuaria.idUsuario;

    this.api.verCicloActual(id)
      .then(ciclo => this.cicloActual.set(ciclo))
      .catch(() => this.cicloActual.set(null));

    // La semana puede tocar dos meses: se pide el calendario de cada mes que aparezca.
    const lunes = this.addDays(this.stripTime(this.today), -((this.today.getDay() + 6) % 7));
    const domingo = this.addDays(lunes, 6);
    const meses = [lunes];
    if (domingo.getMonth() !== lunes.getMonth()) {
      meses.push(domingo);
    }
    for (const fecha of meses) {
      this.api.verCalendario(id, fecha.getFullYear(), fecha.getMonth() + 1)
        .then(calendario => {
          const dias = { ...this.diasCalendario() };
          for (const dia of calendario.dias) {
            dias[dia.fecha] = dia;
          }
          this.diasCalendario.set(dias);
        })
        .catch(() => undefined);
    }

    this.api.verEstadisticas(id)
      .then(estadistica => {
        this.stats.set([
          {
            icon: '🌸',
            label: 'Duración promedio del ciclo',
            value: estadistica.promedioDuracionCiclo !== null ? String(Math.round(estadistica.promedioDuracionCiclo)) : '—',
            unit: 'días',
          },
          {
            icon: '🩸',
            label: 'Duración promedio del periodo',
            value: estadistica.promedioDuracionPeriodo !== null ? String(Math.round(estadistica.promedioDuracionPeriodo)) : '—',
            unit: 'días',
          },
          {
            icon: '📅',
            label: 'Ciclos registrados',
            value: String(estadistica.totalCiclos ?? 0),
            unit: 'ciclos',
          },
        ]);
        if (estadistica.sintomasFrecuentes?.length > 0) {
          this.sintomaFrecuente.set(estadistica.sintomasFrecuentes[0].nombre);
        }
      })
      .catch(() => undefined);

    const tonos: Article['tono'][] = ['rose', 'lilac', 'butter'];
    this.api.verArticulos()
      .then(articulos => {
        this.articles.set(articulos.slice(0, 3).map((articulo, indice) => ({
          id: indice + 1,
          titulo: articulo.titulo,
          resumen: articulo.resumen,
          categoria: articulo.categoria,
          imagen: articulo.urlImagen ?? undefined,
          enlace: '/articulos',
          tono: tonos[indice % tonos.length],
        })));
      })
      .catch(() => undefined);
  }


  // FUNCIONES AUXILIARES

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private stripTime(date: Date): Date {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );
  }

  private daysBetween(start: Date, end: Date): number {
    const first = Date.UTC(
      start.getFullYear(),
      start.getMonth(),
      start.getDate(),
    );

    const second = Date.UTC(
      end.getFullYear(),
      end.getMonth(),
      end.getDate(),
    );

    return Math.round((second - first) / 86400000);
  }

  private sameDay(first: Date, second: Date): boolean {
    return (
      first.getFullYear() === second.getFullYear() &&
      first.getMonth() === second.getMonth() &&
      first.getDate() === second.getDate()
    );
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('es-CO', {
      day: 'numeric',
      month: 'long',
    }).format(date);
  }
}
