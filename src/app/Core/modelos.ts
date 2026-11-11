/**
 * Interfaces con la MISMA forma de los DTO del backend (paquete co.edu.unbosque.dto).
 * Los nombres de los atributos deben ser iguales a los del backend, porque el JSON se arma con ellos.
 * Las fechas llegan como texto: LocalDate -> '2026-11-11', LocalDateTime -> '2026-11-11T08:30:00'.
 */

/** Todas las respuestas del backend vienen dentro de este objeto (RespuestaDTO). */
export interface RespuestaApi<T> {
  codigo: number;
  mensaje: string;
  datos: T;
}

/** POST /autenticacion/registrar (RegistroUsuariaDTO). */
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

/** Datos de la usuaria (UsuariaDTO). altura en METROS. */
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

/** Un ciclo ingresado en la encuesta (CicloEncuestaDTO). */
export interface CicloEncuesta {
  fechaInicioMenstruacion: string;
  fechaFinMenstruacion: string;
}

/** Encuesta inicial (EncuestaInicialDTO). altura en METROS. */
export interface EncuestaInicial {
  altura: number | null;
  peso: number | null;
  horasSueno: number | null;
  /** true = la usuaria da las duraciones (opción 2); false = da las fechas de 1 a 3 ciclos (opción 1). */
  ingresoRango: boolean;
  duracionCiclo: number | null;
  duracionMenstruacion: number | null;
  ciclosIniciales: CicloEncuesta[];
}

/** Ajustes de la usuaria (AjustesDTO). */
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

/** Lo que se puede cambiar en ajustes (ActualizarAjustesDTO). Lo que vaya en null NO se cambia. */
export interface ActualizarAjustes {
  apodo?: string | null;
  altura?: number | null;
  peso?: number | null;
  horasSueno?: number | null;
  metodoCalculo?: 'AUTOMATICO' | 'MANUAL' | null;
  duracionCiclo?: number | null;
  duracionMenstruacion?: number | null;
}

/** Catálogos (SintomaDTO, EmocionDTO, ActividadSexualDTO). */
export interface Sintoma { idSintoma: number; nombre: string; categoria: string; }
export interface Emocion { idEmocion: number; nombre: string; categoria: string; }
export interface ActividadSexual { idActividadSexual: number; nombre: string; }
export interface Catalogos {
  sintomas: Sintoma[];
  emociones: Emocion[];
  actividadesSexuales: ActividadSexual[];
}

/** Tipos de flujo que acepta el backend. */
export type TipoFlujo = 'MANCHADO' | 'LIGERO' | 'MEDIO' | 'ABUNDANTE';

/** Registro de un día (RegistroDiarioDTO). Para enviar, sintomas/emociones/actividades solo necesitan el id. */
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

/** Indicadores del calendario (constantes de CalendarioService). */
export type IndicadorDia =
  | 'PERIODO_CONFIRMADO'
  | 'PERIODO_PRONOSTICADO'
  | 'PERIODO_RETRASADO'
  | 'DIA_OVULACION'
  | 'FASE_OVULACION'
  | 'NINGUNO';

/** Un día del calendario (DiaCalendarioDTO). */
export interface DiaCalendario {
  fecha: string;
  indicador: IndicadorDia;
  tieneRegistro: boolean;
  idRegistroDiario: number | null;
  esEditable: boolean;
  esHoy: boolean;
  diaDelCiclo: number | null;
}

/** Ciclo actual con sus predicciones (CicloActualDTO). */
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

/** Menstruación (MenstruacionDTO). */
export interface Menstruacion {
  idMenstruacion: number;
  fechaInicio: string;
  fechaFin: string | null;
  duracion: number | null;
  estado: 'CONFIRMADA' | 'ESTIMADA';
  idCicloMenstrual: number;
}

/** Calendario de un mes (CalendarioDTO). */
export interface Calendario {
  anio: number;
  mes: number;
  dias: DiaCalendario[];
  cicloActual: CicloActual | null;
  proximasMenstruaciones: Menstruacion[];
}

/** Resumen de un ciclo para estadísticas (CicloResumenDTO). */
export interface CicloResumen { idCicloMenstrual: number; fechaInicio: string; duracion: number; }

/** Conteo de un síntoma (SintomaConteoDTO). */
export interface SintomaConteo { idSintoma: number; nombre: string; conteo: number; }

/** Estadísticas generales (EstadisticaResumenDTO, viene de MongoDB). */
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

/** Estadísticas de un periodo año-mes a año-mes (EstadisticaPeriodoDTO, viene de MongoDB). */
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

/** Comentario de un artículo (ComentarioDTO). */
export interface Comentario {
  idComentario: string;
  idArticulo: string;
  idUsuario: number;
  apodo: string;
  contenido: string;
  fechaCreacion: string;
  fechaEdicion: string | null;
}

/** Artículo (ArticuloDTO, viene de MongoDB). */
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
