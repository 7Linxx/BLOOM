import { Catalogos, IndicadorDia, RegistroDiario, TipoFlujo } from './modelos';

export type TipoDia = 'confirmed' | 'predicted' | 'fertile' | 'ovulation' | 'late' | 'none';

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

export function intensidadABackend(intensidad: number): TipoFlujo | null {
  if (intensidad <= 0) return null;
  if (intensidad === 1) return 'MANCHADO';
  if (intensidad === 2) return 'LIGERO';
  if (intensidad === 3) return 'MEDIO';
  return 'ABUNDANTE';
}

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

const SINONIMOS_SINTOMA: Record<string, string> = {
  'Dolor de espalda': 'Dolor lumbar',
  'Mareos': 'Mareo',
  'Cansancio': 'Fatiga',
  'Dificultad para dormir': 'Insomnio',
};

const SINONIMOS_EMOCION: Record<string, string> = {
  'Ansiedad': 'Ansiosa',
  'Irritabilidad': 'Irritable',
  'Tristeza': 'Triste',
  'Cambios de humor': 'Cambios de humor',
};

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

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

export function textoAFecha(texto: string): Date {
  const [anio, mes, dia] = texto.substring(0, 10).split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

export function fechaATexto(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}
