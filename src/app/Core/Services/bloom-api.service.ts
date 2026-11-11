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

export class ErrorApi extends Error {
  constructor(public readonly estado: number, mensaje: string) {
    super(mensaje);
  }
}

export function mensajeDeError(error: unknown, porDefecto: string): string {
  if (error instanceof ErrorApi && error.message) {
    return error.message;
  }
  return porDefecto;
}

@Injectable({ providedIn: 'root' })
export class BloomApi {
  private readonly http = inject(HttpClient);

  private catalogosEnMemoria: Catalogos | null = null;

  registrar(datos: RegistroUsuaria): Promise<Usuaria> {
    return this.post<Usuaria>('/autenticacion/registrar', datos);
  }

  iniciarSesion(correoElectronico: string, contrasenia: string): Promise<Usuaria> {
    return this.post<Usuaria>('/autenticacion/iniciar-sesion', { correoElectronico, contrasenia });
  }

  solicitarCodigo(correoElectronico: string): Promise<void> {
    return this.post<void>('/autenticacion/solicitar-codigo', { correoElectronico });
  }

  verificarCodigo(correoElectronico: string, codigo: string): Promise<void> {
    return this.post<void>('/autenticacion/enviar-codigo', { correoElectronico, codigo });
  }

  verUsuaria(idUsuario: number): Promise<Usuaria> {
    return this.get<Usuaria>(`/usuarias/${idUsuario}`);
  }

  verAjustes(idUsuario: number): Promise<Ajustes> {
    return this.get<Ajustes>(`/usuarias/${idUsuario}/ajustes`);
  }

  actualizarAjustes(idUsuario: number, ajustes: ActualizarAjustes): Promise<Ajustes> {
    return this.put<Ajustes>(`/usuarias/${idUsuario}/ajustes`, ajustes);
  }

  llenarEncuesta(idUsuario: number, encuesta: EncuestaInicial): Promise<EncuestaInicial> {
    return this.post<EncuestaInicial>(`/usuarias/${idUsuario}/encuesta`, encuesta);
  }

  verCalendario(idUsuario: number, anio: number, mes: number): Promise<Calendario> {
    const params = new HttpParams().set('anio', anio).set('mes', mes);
    return this.get<Calendario>(`/usuarias/${idUsuario}/calendario`, params);
  }

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

  verRegistros(idUsuario: number): Promise<RegistroDiario[]> {
    return this.get<RegistroDiario[]>(`/usuarias/${idUsuario}/registros-diarios`);
  }

  crearRegistro(idUsuario: number, registro: RegistroDiario): Promise<RegistroDiario> {
    return this.post<RegistroDiario>(`/usuarias/${idUsuario}/registros-diarios`, registro);
  }

  editarRegistro(idUsuario: number, registro: RegistroDiario): Promise<RegistroDiario> {
    return this.put<RegistroDiario>(`/usuarias/${idUsuario}/registros-diarios/${registro.fecha}`, registro);
  }

  guardarRegistro(idUsuario: number, registro: RegistroDiario, yaExiste: boolean): Promise<RegistroDiario> {
    return yaExiste ? this.editarRegistro(idUsuario, registro) : this.crearRegistro(idUsuario, registro);
  }

  eliminarRegistro(idUsuario: number, fecha: string): Promise<void> {
    return this.delete<void>(`/usuarias/${idUsuario}/registros-diarios/${fecha}`);
  }

  async verCatalogos(): Promise<Catalogos> {
    if (!this.catalogosEnMemoria) {
      this.catalogosEnMemoria = await this.get<Catalogos>('/catalogos');
    }
    return this.catalogosEnMemoria;
  }

  verEstadisticas(idUsuario: number): Promise<EstadisticaResumen> {
    return this.get<EstadisticaResumen>(`/usuarias/${idUsuario}/estadisticas`);
  }

  verEstadisticasPeriodo(idUsuario: number, desde: string, hasta: string): Promise<EstadisticaPeriodo> {
    const params = new HttpParams().set('desde', desde).set('hasta', hasta);
    return this.get<EstadisticaPeriodo>(`/usuarias/${idUsuario}/estadisticas/periodo`, params);
  }

  verArticulos(categoria?: string): Promise<Articulo[]> {
    let params = new HttpParams();
    if (categoria) {
      params = params.set('categoria', categoria);
    }
    return this.get<Articulo[]>('/articulos', params);
  }

  verComentarios(idArticulo: string, pagina = 0, tamanio = 50): Promise<Comentario[]> {
    const params = new HttpParams().set('pagina', pagina).set('tamanio', tamanio);
    return this.get<Comentario[]>(`/articulos/${idArticulo}/comentarios`, params);
  }

  crearComentario(idArticulo: string, idUsuario: number, contenido: string): Promise<Comentario> {
    return this.post<Comentario>(`/articulos/${idArticulo}/comentarios`, { idUsuario, contenido });
  }

  private get<T>(ruta: string, params?: HttpParams): Promise<T> {
    return this.ejecutar(this.http.get<RespuestaApi<T>>(API_URL + ruta, { params }));
  }

  private post<T>(ruta: string, cuerpo: unknown): Promise<T> {
    return this.ejecutar(this.http.post<RespuestaApi<T>>(API_URL + ruta, cuerpo));
  }

  private put<T>(ruta: string, cuerpo: unknown): Promise<T> {
    return this.ejecutar(this.http.put<RespuestaApi<T>>(API_URL + ruta, cuerpo));
  }

  private delete<T>(ruta: string): Promise<T> {
    return this.ejecutar(this.http.delete<RespuestaApi<T>>(API_URL + ruta));
  }

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
