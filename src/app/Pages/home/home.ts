
import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

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

  // DATOS GENERALES

  readonly today = new Date();

  apodo = signal('Luna');

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


  // INFORMACIÓN DEL CICLO

  cycleLength = signal(28);
  periodLength = signal(5);

  // Fecha de inicio de ejemplo: hace 12 días.
  // Posteriormente se conectará con los datos reales de la usuaria.
  lastPeriodStart = signal(this.addDays(this.today, -12));

  cycleDay = computed(() => {
    const difference = this.daysBetween(
      this.lastPeriodStart(),
      this.today,
    );

    return difference + 1;
  });

  ovulationDay = computed(() => this.cycleLength() - 14);

  daysToNextPeriod = computed(() => {
    return Math.max(0, this.cycleLength() - this.cycleDay());
  });

  periodoRetrasado = computed(() => {
    return this.cycleDay() > this.cycleLength();
  });

  nextPeriod = computed(() => {
    const date = this.addDays(
      this.lastPeriodStart(),
      this.cycleLength(),
    );

    return this.formatDate(date);
  });

  nextOvulation = computed(() => {
    const date = this.addDays(
      this.lastPeriodStart(),
      this.ovulationDay() - 1,
    );

    return this.formatDate(date);
  });

  phase = computed(() => {
    const day = this.cycleDay();
    const ovulation = this.ovulationDay();

    if (day <= this.periodLength()) {
      return {
        name: 'Fase menstrual',
        tone: 'menstrual',
        msg: 'Un momento para descansar y escucharte.',
      };
    }

    if (day < ovulation - 5) {
      return {
        name: 'Fase folicular',
        tone: 'follicular',
        msg: 'Una etapa de renovación y energía.',
      };
    }

    if (day <= ovulation + 1) {
      return {
        name: 'Ventana fértil estimada',
        tone: 'fertile',
        msg: 'Tu cuerpo se acerca a la ovulación.',
      };
    }

    return {
      name: 'Fase lútea',
      tone: 'luteal',
      msg: 'Un momento para priorizar tu bienestar.',
    };
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
      ((this.cycleDay() - 1) / this.cycleLength()) *
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


  // RESUMEN DE LA SEMANA

  week = computed<WeekDay[]>(() => {
    const currentDate = this.stripTime(this.today);
    const firstDay = new Date(currentDate);

    const dayOfWeek = (firstDay.getDay() + 6) % 7;
    firstDay.setDate(firstDay.getDate() - dayOfWeek);

    const labels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    return labels.map((label, index) => {
      const date = this.addDays(firstDay, index);
      const isToday = this.sameDay(date, currentDate);

      return {
        label,
        num: date.getDate(),
        kind: this.kindFor(date),
        isToday,
        isFuture: date > currentDate,
        hasNote: index === 1 || index === 4,
      };
    });
  });

  private kindFor(date: Date): DayKind {
    const day = this.daysBetween(this.lastPeriodStart(), date) + 1;

    if (day < 1 || day > this.cycleLength()) {
      return 'none';
    }

    if (day <= this.periodLength()) {
      return 'confirmed';
    }

    if (day === this.ovulationDay()) {
      return 'ovulation';
    }

    if (
      day >= this.ovulationDay() - 5 &&
      day < this.ovulationDay()
    ) {
      return 'fertile';
    }

    if (day > this.cycleLength() - this.periodLength()) {
      return 'predicted';
    }

    return 'none';
  }


  // ESTADÍSTICAS DE EJEMPLO

  stats = signal([
    {
      icon: '🌸',
      label: 'Duración promedio del ciclo',
      value: '28',
      unit: 'días',
    },
    {
      icon: '🩸',
      label: 'Duración promedio del periodo',
      value: '5',
      unit: 'días',
    },
    {
      icon: '📅',
      label: 'Ciclos registrados',
      value: '3',
      unit: 'ciclos',
    },
  ]);

  sintomaFrecuente = signal('Cólic​os');


  // ARTÍCULOS DE EJEMPLO

  articles = signal<Article[]>([
    {
      id: 1,
      titulo: 'Conoce las fases de tu ciclo menstrual',
      resumen: 'Descubre qué sucede en tu cuerpo durante cada etapa del ciclo.',
      categoria: 'Ciclo menstrual',
      enlace: '/articulos',
      tono: 'rose',
    },
    {
      id: 2,
      titulo: 'La importancia de escuchar tu cuerpo',
      resumen: 'Aprende a reconocer tus emociones y necesidades.',
      categoria: 'Bienestar emocional',
      enlace: '/articulos',
      tono: 'lilac',
    },
    {
      id: 3,
      titulo: 'Pequeños hábitos para cuidarte',
      resumen: 'Ideas sencillas para incorporar el autocuidado a tu rutina.',
      categoria: 'Autocuidado',
      enlace: '/articulos',
      tono: 'butter',
    },
  ]);


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
