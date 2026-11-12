export interface RespuestaApi<T> {
  codigo: number;
  mensaje: string;
  datos: T;
}

export interface RegistroUsuaria {
  primerNombre: string;
  segundoNombre: string | null;
  primerApellido: string;
  segundoApellido: string | null;
  apodo: string;
  fechaNacimiento: string;
  correoElectronico: string;
  contrasenia: string;
}

export interface Usuaria {
  idUsuario: number;
  primerNombre: string;
  segundoNombre: string | null;
  primerApellido: string;
  segundoApellido: string | null;
  apodo: string;
  fechaNacimiento: string;
  correoElectronico: string;
  fechaRegistro: string;
  altura: number | null;
  peso: number | null;
  horasSueno: number | null;
  metodoCalculo: 'AUTOMATICO' | 'MANUAL';
  cuentaVerificada: boolean;
  encuestaCompletada: boolean;
  fechaUltimoAcceso: string | null;
}

export interface CicloEncuesta {
  fechaInicioMenstruacion: string;
  fechaFinMenstruacion: string;
}

export interface EncuestaInicial {
  altura: number | null;
  peso: number | null;
  horasSueno: number | null;
  ingresoRango: boolean;
  duracionCiclo: number | null;
  duracionMenstruacion: number | null;
  ciclosIniciales: CicloEncuesta[];
}

export interface Ajustes {
  correoElectronico: string;
  primerNombre: string;
  primerApellido: string;
  apodo: string;
  altura: number | null;
  peso: number | null;
  horasSueno: number | null;
  metodoCalculo: 'AUTOMATICO' | 'MANUAL';
  duracionCiclo: number | null;
  duracionMenstruacion: number | null;
}

export interface ActualizarAjustes {
  apodo?: string | null;
  altura?: number | null;
  peso?: number | null;
  horasSueno?: number | null;
  metodoCalculo?: 'AUTOMATICO' | 'MANUAL' | null;
  duracionCiclo?: number | null;
  duracionMenstruacion?: number | null;
}

export interface Sintoma { idSintoma: number; nombre: string; categoria: string; }
export interface Emocion { idEmocion: number; nombre: string; categoria: string; }
export interface ActividadSexual { idActividadSexual: number; nombre: string; }
export interface Catalogos {
  sintomas: Sintoma[];
  emociones: Emocion[];
  actividadesSexuales: ActividadSexual[];
}

export type TipoFlujo = 'MANCHADO' | 'LIGERO' | 'MEDIO' | 'ABUNDANTE';

export interface RegistroDiario {
  idRegistroDiario?: number | null;
  fecha: string;
  hayMenstruacion: boolean;
  tipoFlujo: TipoFlujo | null;
  nota: string | null;
  sintomas: { idSintoma: number; nombre?: string; categoria?: string }[];
  emociones: { idEmocion: number; nombre?: string; categoria?: string }[];
  actividadesSexuales: { idActividadSexual: number; nombre?: string }[];
  idCicloMenstrual?: number | null;
  idMenstruacion?: number | null;
}

export type IndicadorDia =
  | 'PERIODO_CONFIRMADO'
  | 'PERIODO_PRONOSTICADO'
  | 'PERIODO_RETRASADO'
  | 'DIA_OVULACION'
  | 'FASE_OVULACION'
  | 'NINGUNO';

export interface DiaCalendario {
  fecha: string;
  indicador: IndicadorDia;
  tieneRegistro: boolean;
  idRegistroDiario: number | null;
  esEditable: boolean;
  esHoy: boolean;
  diaDelCiclo: number | null;
}

export interface CicloActual {
  idCicloMenstrual: number;
  fechaInicio: string;
  diaDelCiclo: number;
  duracionEstimada: number;
  duracionEstimadaMenstruacion: number;
  fechaEstimadaSiguientePeriodo: string;
  diasParaSiguientePeriodo: number;
  periodoRetrasado: boolean;
  diasRetraso: number;
  fechaEstimadaOvulacion: string;
  fase: 'MENSTRUAL' | 'FOLICULAR' | 'OVULATORIA' | 'LUTEA';
  metodoCalculo: 'AUTOMATICO' | 'MANUAL';
}

export interface Menstruacion {
  idMenstruacion: number;
  fechaInicio: string;
  fechaFin: string | null;
  duracion: number | null;
  estado: 'CONFIRMADA' | 'ESTIMADA';
  idCicloMenstrual: number;
}

export interface Calendario {
  anio: number;
  mes: number;
  dias: DiaCalendario[];
  cicloActual: CicloActual | null;
  proximasMenstruaciones: Menstruacion[];
}

export interface CicloResumen { idCicloMenstrual: number; fechaInicio: string; duracion: number; }

export interface SintomaConteo { idSintoma: number; nombre: string; conteo: number; }

export interface EstadisticaResumen {
  idUsuario: number;
  fechaCalculo: string;
  totalCiclos: number;
  promedioDuracionCiclo: number | null;
  promedioDuracionPeriodo: number | null;
  cicloMasCorto: CicloResumen | null;
  cicloMasLargo: CicloResumen | null;
  sintomasFrecuentes: SintomaConteo[];
  totalDiasRegistrados: number;
}

export interface EstadisticaPeriodo {
  desde: string;
  hasta: string;
  diasRegistrados: number;
  diasMenstruacion: number;
  totalCiclos: number;
  promedioDuracionCiclo: number | null;
  promedioDuracionPeriodo: number | null;
  cicloMasCorto: CicloResumen | null;
  cicloMasLargo: CicloResumen | null;
  sintomasFrecuentes: SintomaConteo[];
}

export interface Comentario {
  idComentario: string;
  idArticulo: string;
  idUsuario: number;
  apodo: string;
  contenido: string;
  fechaCreacion: string;
  fechaEdicion: string | null;
}

export interface Articulo {
  idArticulo: string;
  titulo: string;
  resumen: string;
  contenido: string;
  urlImagen: string | null;
  autor: string | null;
  fechaPublicacion: string;
  categoria: string;
  fuente: { nombre: string; url: string } | null;
  totalComentarios: number;
  comentariosRecientes: Comentario[];
}

export interface CicloMenstrual {
  idCicloMenstrual: number;
  fechaInicio: string;
  fechaFin: string | null;
  duracion: number | null;
  estado: 'FINALIZADO' | 'EN_CURSO' | 'ESTIMADO';
  origen: string;
  menstruacion: Menstruacion | null;
}
