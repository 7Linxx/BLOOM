import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import { API_URL } from '../api.config';
import {
  ActualizarAjustes,
  Ajustes,
  Articulo,
  Calendario,
  Catalogos,
  CicloActual,
  Comentario,
  EncuestaInicial,
  EstadisticaPeriodo,
  EstadisticaResumen,
  RegistroDiario,
  RegistroUsuaria,
  RespuestaApi,
  Usuaria,
} from '../modelos';

/**
 * Error que lanzan los métodos de este servicio cuando el backend responde con un código de error.
 * - estado: el código HTTP (400, 401, 403, 404, 409, 410, 500...). 0 = no hubo conexión con el backend.
 * - message: el "mensaje" que mandó el backend (ya viene en español y se puede mostrar en pantalla).
 */
export class ErrorApi extends Error {
  constructor(public readonly estado: number, mensaje: string) {
    super(mensaje);
  }
}

/** Devuelve el texto que se puede mostrar al usuario para cualquier error (o el mensaje por defecto). */
export function mensajeDeError(error: unknown, porDefecto: string): string {
  if (error instanceof ErrorApi && error.message) {
    return error.message;
  }
  return porDefecto;
}

/**
 * ÚNICO lugar del front que habla con el backend.
 * Cada método corresponde a una ruta de un Controller del backend (ver Swagger: http://localhost:8080/swagger-ui.html).
 * Todos devuelven una Promise con el contenido de "datos" de la respuesta, o lanzan ErrorApi si algo falla.
 */
@Injectable({ providedIn: 'root' })
export class BloomApi {
  private readonly http = inject(HttpClient);

  /** Catálogos guardados en memoria (casi nunca cambian, así no se piden cada vez). */
  private catalogosEnMemoria: Catalogos | null = null;

  // ================================================================ AUTENTICACIÓN (AutenticacionController)

  /** POST /autenticacion/registrar -> devuelve la usuaria creada (sin verificar). */
  registrar(datos: RegistroUsuaria): Promise<Usuaria> {
    return this.post<Usuaria>('/autenticacion/registrar', datos);
  }

  /** POST /autenticacion/iniciar-sesion -> 401 credenciales malas, 403 correo sin verificar. */
  iniciarSesion(correoElectronico: string, contrasenia: string): Promise<Usuaria> {
    return this.post<Usuaria>('/autenticacion/iniciar-sesion', { correoElectronico, contrasenia });
  }

  /** POST /autenticacion/solicitar-codigo -> genera un código nuevo de 6 dígitos y lo envía al correo. */
  solicitarCodigo(correoElectronico: string): Promise<void> {
    return this.post<void>('/autenticacion/solicitar-codigo', { correoElectronico });
  }

  /** POST /autenticacion/enviar-codigo -> verifica la cuenta. 400 código malo, 410 código vencido. */
  verificarCodigo(correoElectronico: string, codigo: string): Promise<void> {
    return this.post<void>('/autenticacion/enviar-codigo', { correoElectronico, codigo });
  }

  // ================================================================ USUARIA (UsuariaController)

  /** GET /usuarias/{id} */
  verUsuaria(idUsuario: number): Promise<Usuaria> {
    return this.get<Usuaria>(`/usuarias/${idUsuario}`);
  }

  /** GET /usuarias/{id}/ajustes */
  verAjustes(idUsuario: number): Promise<Ajustes> {
    return this.get<Ajustes>(`/usuarias/${idUsuario}/ajustes`);
  }

  /** PUT /usuarias/{id}/ajustes -> lo que vaya en null no se cambia. */
  actualizarAjustes(idUsuario: number, ajustes: ActualizarAjustes): Promise<Ajustes> {
    return this.put<Ajustes>(`/usuarias/${idUsuario}/ajustes`, ajustes);
  }

  // ================================================================ ENCUESTA (EncuestaInicialController)

  /** POST /usuarias/{id}/encuesta */
  llenarEncuesta(idUsuario: number, encuesta: EncuestaInicial): Promise<EncuestaInicial> {
    return this.post<EncuestaInicial>(`/usuarias/${idUsuario}/encuesta`, encuesta);
  }

  // ================================================================ CALENDARIO (CalendarioController)

  /** GET /usuarias/{id}/calendario?anio=&mes= (mes de 1 a 12). */
  verCalendario(idUsuario: number, anio: number, mes: number): Promise<Calendario> {
    const params = new HttpParams().set('anio', anio).set('mes', mes);
    return this.get<Calendario>(`/usuarias/${idUsuario}/calendario`, params);
  }

  /** GET /usuarias/{id}/ciclo-actual -> null si todavía no hay ciclos (el backend responde 404). */
  async verCicloActual(idUsuario: number): Promise<CicloActual | null> {
    try {
      return await this.get<CicloActual>(`/usuarias/${idUsuario}/ciclo-actual`);
    } catch (error) {
      if (error instanceof ErrorApi && error.estado === 404) {
        return null;
      }
      throw error;
    }
  }

  // ================================================================ REGISTRO DIARIO (RegistroDiarioController)

  /** GET /usuarias/{id}/registros-diarios (todos los días registrados). */
  verRegistros(idUsuario: number): Promise<RegistroDiario[]> {
    return this.get<RegistroDiario[]>(`/usuarias/${idUsuario}/registros-diarios`);
  }

  /** POST /usuarias/{id}/registros-diarios (día nuevo; 409 si ese día ya existe). */
  crearRegistro(idUsuario: number, registro: RegistroDiario): Promise<RegistroDiario> {
    return this.post<RegistroDiario>(`/usuarias/${idUsuario}/registros-diarios`, registro);
  }

  /** PUT /usuarias/{id}/registros-diarios/{fecha} (editar un día que ya existe). */
  editarRegistro(idUsuario: number, registro: RegistroDiario): Promise<RegistroDiario> {
    return this.put<RegistroDiario>(`/usuarias/${idUsuario}/registros-diarios/${registro.fecha}`, registro);
  }

  /** Crea el día si no existe o lo edita si ya existe. */
  guardarRegistro(idUsuario: number, registro: RegistroDiario, yaExiste: boolean): Promise<RegistroDiario> {
    return yaExiste ? this.editarRegistro(idUsuario, registro) : this.crearRegistro(idUsuario, registro);
  }

  /** DELETE /usuarias/{id}/registros-diarios/{fecha} */
  eliminarRegistro(idUsuario: number, fecha: string): Promise<void> {
    return this.delete<void>(`/usuarias/${idUsuario}/registros-diarios/${fecha}`);
  }

  // ================================================================ CATÁLOGOS (CatalogoController)

  /** GET /catalogos (síntomas, emociones y actividades). Se piden una sola vez. */
  async verCatalogos(): Promise<Catalogos> {
    if (!this.catalogosEnMemoria) {
      this.catalogosEnMemoria = await this.get<Catalogos>('/catalogos');
    }
    return this.catalogosEnMemoria;
  }

  // ================================================================ ESTADÍSTICAS (EstadisticaController, MongoDB)

  /** GET /usuarias/{id}/estadisticas */
  verEstadisticas(idUsuario: number): Promise<EstadisticaResumen> {
    return this.get<EstadisticaResumen>(`/usuarias/${idUsuario}/estadisticas`);
  }

  /** GET /usuarias/{id}/estadisticas/periodo?desde=AAAA-MM&hasta=AAAA-MM */
  verEstadisticasPeriodo(idUsuario: number, desde: string, hasta: string): Promise<EstadisticaPeriodo> {
    const params = new HttpParams().set('desde', desde).set('hasta', hasta);
    return this.get<EstadisticaPeriodo>(`/usuarias/${idUsuario}/estadisticas/periodo`, params);
  }

  // ================================================================ ARTÍCULOS (ArticuloController, MongoDB)

  /** GET /articulos (todos, o de una categoría). */
  verArticulos(categoria?: string): Promise<Articulo[]> {
    let params = new HttpParams();
    if (categoria) {
      params = params.set('categoria', categoria);
    }
    return this.get<Articulo[]>('/articulos', params);
  }

  /** GET /articulos/{id}/comentarios?pagina=&tamanio= */
  verComentarios(idArticulo: string, pagina = 0, tamanio = 50): Promise<Comentario[]> {
    const params = new HttpParams().set('pagina', pagina).set('tamanio', tamanio);
    return this.get<Comentario[]>(`/articulos/${idArticulo}/comentarios`, params);
  }

  /** POST /articulos/{id}/comentarios (el apodo lo pone el backend con el de la usuaria). */
  crearComentario(idArticulo: string, idUsuario: number, contenido: string): Promise<Comentario> {
    return this.post<Comentario>(`/articulos/${idArticulo}/comentarios`, { idUsuario, contenido });
  }

  // ================================================================ MÉTODOS DE APOYO

  /** Hace un GET y devuelve "datos". */
  private get<T>(ruta: string, params?: HttpParams): Promise<T> {
    return this.ejecutar(this.http.get<RespuestaApi<T>>(API_URL + ruta, { params }));
  }

  /** Hace un POST y devuelve "datos". */
  private post<T>(ruta: string, cuerpo: unknown): Promise<T> {
    return this.ejecutar(this.http.post<RespuestaApi<T>>(API_URL + ruta, cuerpo));
  }

  /** Hace un PUT y devuelve "datos". */
  private put<T>(ruta: string, cuerpo: unknown): Promise<T> {
    return this.ejecutar(this.http.put<RespuestaApi<T>>(API_URL + ruta, cuerpo));
  }

  /** Hace un DELETE y devuelve "datos". */
  private delete<T>(ruta: string): Promise<T> {
    return this.ejecutar(this.http.delete<RespuestaApi<T>>(API_URL + ruta));
  }

  /** Espera la respuesta, saca "datos" y convierte los errores HTTP en ErrorApi con el mensaje del backend. */
  private async ejecutar<T>(peticion: Observable<RespuestaApi<T>>): Promise<T> {
    try {
      const respuesta = await firstValueFrom(peticion);
      return respuesta.datos;
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        const cuerpo = error.error as Partial<RespuestaApi<unknown>> | null;
        const mensaje = error.status === 0
          ? 'No hay conexión con el servidor de Bloom. Revisa que el backend esté encendido.'
          : cuerpo?.mensaje ?? 'Ocurrió un error inesperado. Inténtalo de nuevo.';
        throw new ErrorApi(error.status, mensaje);
      }
      throw error;
    }
  }
}
