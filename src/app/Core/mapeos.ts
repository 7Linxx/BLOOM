import { Catalogos, IndicadorDia, RegistroDiario, TipoFlujo } from './modelos';

/**
 * "Traducciones" entre lo que muestra el front y lo que entiende el backend.
 * Están todas aquí para que, si cambian los nombres en el HTML o en el catálogo, solo se toque este archivo.
 */

/** Tipo de día que pinta el calendario y el home. */
export type TipoDia = 'confirmed' | 'predicted' | 'fertile' | 'ovulation' | 'late' | 'none';

/** Indicador del backend (DiaCalendarioDTO.indicador) -> clase CSS del front. */
export function indicadorATipoDia(indicador: IndicadorDia | null | undefined): TipoDia {
  switch (indicador) {
    case 'PERIODO_CONFIRMADO':
      return 'confirmed';
    case 'PERIODO_PRONOSTICADO':
      return 'predicted';
    case 'PERIODO_RETRASADO':
      return 'late';
    case 'DIA_OVULACION':
      return 'ovulation';
    case 'FASE_OVULACION':
      return 'fertile';
    default:
      return 'none';
  }
}

/** Flujo del calendario (texto) -> backend. 'variable' y 'no_se' no existen en el backend: se guarda sin tipo. */
export function flujoTextoABackend(flujo: string | null): TipoFlujo | null {
  switch (flujo) {
    case 'ligero':
      return 'LIGERO';
    case 'moderado':
      return 'MEDIO';
    case 'abundante':
      return 'ABUNDANTE';
    default:
      return null;
  }
}

/** Flujo del backend -> texto del calendario. MANCHADO no tiene opción en el calendario: se muestra como 'ligero'. */
export function flujoBackendATexto(flujo: TipoFlujo | null): 'ligero' | 'moderado' | 'abundante' | null {
  switch (flujo) {
    case 'MANCHADO':
    case 'LIGERO':
      return 'ligero';
    case 'MEDIO':
      return 'moderado';
    case 'ABUNDANTE':
      return 'abundante';
    default:
      return null;
  }
}

/** Intensidad 0-5 de la página Registro (care) -> backend. 0 = sin menstruación. */
export function intensidadABackend(intensidad: number): TipoFlujo | null {
  if (intensidad <= 0) return null;
  if (intensidad === 1) return 'MANCHADO';
  if (intensidad === 2) return 'LIGERO';
  if (intensidad === 3) return 'MEDIO';
  return 'ABUNDANTE';
}

/** Backend -> intensidad 0-5 de la página Registro (care). ABUNDANTE se muestra como 4 ("Abundante"). */
export function backendAIntensidad(flujo: TipoFlujo | null, hayMenstruacion: boolean): number {
  switch (flujo) {
    case 'MANCHADO':
      return 1;
    case 'LIGERO':
      return 2;
    case 'MEDIO':
      return 3;
    case 'ABUNDANTE':
      return 4;
    default:
      return hayMenstruacion ? 1 : 0;
  }
}

/**
 * Nombres que usa el front y que en el catálogo del backend se llaman distinto.
 * (Los que no aparecen aquí se buscan con el mismo nombre.)
 */
const SINONIMOS_SINTOMA: Record<string, string> = {
  'Dolor de espalda': 'Dolor lumbar',
  'Mareos': 'Mareo',
  'Cansancio': 'Fatiga',
  'Dificultad para dormir': 'Insomnio',
};

/** Síntomas "emocionales" del front que en el backend son EMOCIONES del catálogo. */
const SINONIMOS_EMOCION: Record<string, string> = {
  'Ansiedad': 'Ansiosa',
  'Irritabilidad': 'Irritable',
  'Tristeza': 'Triste',
  'Cambios de humor': 'Cambios de humor',
};

/** Compara textos sin importar mayúsculas ni tildes. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

/**
 * Convierte la lista de nombres que marcó la usuaria en ids del catálogo.
 * Devuelve también los nombres que NO existen en el backend (no se pueden guardar).
 */
export function nombresACatalogo(nombres: string[], catalogos: Catalogos): {
  sintomas: { idSintoma: number }[];
  emociones: { idEmocion: number }[];
  noGuardados: string[];
} {
  const sintomas: { idSintoma: number }[] = [];
  const emociones: { idEmocion: number }[] = [];
  const noGuardados: string[] = [];

  for (const nombre of nombres) {
    const nombreEmocion = SINONIMOS_EMOCION[nombre];
    if (nombreEmocion) {
      const emocion = catalogos.emociones.find(e => normalizar(e.nombre) === normalizar(nombreEmocion));
      if (emocion) {
        emociones.push({ idEmocion: emocion.idEmocion });
        continue;
      }
    }
    const nombreSintoma = SINONIMOS_SINTOMA[nombre] ?? nombre;
    const sintoma = catalogos.sintomas.find(s => normalizar(s.nombre) === normalizar(nombreSintoma));
    if (sintoma) {
      sintomas.push({ idSintoma: sintoma.idSintoma });
    } else {
      noGuardados.push(nombre);
    }
  }
  return { sintomas, emociones, noGuardados };
}

/**
 * Convierte los síntomas y emociones guardados en el backend en los nombres que muestra la página.
 * opcionesDelFront = los nombres que existen en esa página (para marcar las casillas correctas).
 */
export function registroANombres(registro: RegistroDiario, opcionesDelFront: string[]): string[] {
  const nombres: string[] = [];
  const guardados: string[] = [];
  for (const sintoma of registro.sintomas) {
    if (sintoma.nombre) guardados.push(sintoma.nombre);
  }
  for (const emocion of registro.emociones) {
    if (emocion.nombre) guardados.push(emocion.nombre);
  }
  for (const opcion of opcionesDelFront) {
    const enBackend = SINONIMOS_EMOCION[opcion] ?? SINONIMOS_SINTOMA[opcion] ?? opcion;
    if (guardados.some(g => normalizar(g) === normalizar(enBackend))) {
      nombres.push(opcion);
    }
  }
  return nombres;
}

/** Fecha 'AAAA-MM-DD' -> Date local (sin problemas de zona horaria). */
export function textoAFecha(texto: string): Date {
  const [anio, mes, dia] = texto.substring(0, 10).split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

/** Date -> 'AAAA-MM-DD' en hora local. */
export function fechaATexto(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}
