import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { BloomApi, mensajeDeError } from '../../Core/Services/bloom-api.service';
import { Sesion } from '../../Core/Services/sesion.service';
import { Articulo, Comentario } from '../../Core/modelos';

/** Artículo como lo usa el HTML (se arma con el ArticuloDTO que manda el backend). */
interface Article {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  source: string;
  url: string;
  imageUrl: string | null;
  createdAt: string;
}

/** Comentario como lo usa el HTML (se arma con el ComentarioDTO del backend). */
interface ArticleComment {
  id: string;
  userId: string | null;
  nickname: string;
  message: string;
  createdAt: string;
}

/** Mensaje de error o confirmación de los comentarios de un artículo. */
interface CommentMessage {
  articleId: string;
  tipo: 'ok' | 'error';
  texto: string;
}

/**
 * Artículos y comentarios conectados al backend (MongoDB):
 *  - GET /articulos, GET /articulos/{id}/comentarios, POST /articulos/{id}/comentarios.
 *  - PUT y DELETE /articulos/{id}/comentarios/{idComentario}: editar y eliminar el comentario propio.
 * El apodo de quien comenta lo pone el backend (es el de la usuaria con sesión), por eso el formulario
 * ya no pide apodo.
 * Las categorías salen de los mismos artículos que manda el backend, así siempre coinciden.
 */
@Component({
  selector: 'app-articulos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './articulos.html',
  styleUrl: './articulos.css'
})
export class Articulos {
  private readonly api = inject(BloomApi);
  private readonly sesion = inject(Sesion);

  searchText = '';
  selectedCategory = 'Todos';
  selectedArticleId: string | null = null;

  /** Artículo con el contenido completo abierto. */
  expandedArticleId: string | null = null;

  commentDraft = '';

  /** Edición de un comentario propio. */
  editingCommentId: string | null = null;
  editDraft = '';
  savingEdit = false;

  /** Comentario que está pidiendo confirmación para eliminarse. */
  deletingCommentId: string | null = null;

  /** Artículos que manda el backend. */
  articles: Article[] = [];

  /** Mensaje si el backend no respondió (por ejemplo, MongoDB apagado). Se muestra sobre la lista. */
  errorMessage = '';

  /** Mensaje de error o confirmación al publicar un comentario (se muestra en ese artículo). */
  commentMessage: CommentMessage | null = null;

  /** true mientras se publica un comentario, para no enviarlo dos veces. */
  sendingComment = false;

  /** Comentarios ya cargados de cada artículo (se piden al abrir los comentarios). */
  comments: Record<string, ArticleComment[]> = {};

  /** Total de comentarios de cada artículo según el backend (antes de abrirlos). */
  private totales: Record<string, number> = {};

  constructor() {
    this.cargarArticulos();
  }

  /** Categorías reales de los artículos que existen (así no se desajustan con Mongo). */
  get categories(): string[] {
    const categorias = this.articles
      .map(article => article.category)
      .filter(categoria => !!categoria);

    return ['Todos', ...Array.from(new Set(categorias))];
  }

  get filteredArticles(): Article[] {
    const search = this.searchText.trim().toLowerCase();

    return this.articles.filter(article => {
      const matchesCategory =
        this.selectedCategory === 'Todos' ||
        article.category === this.selectedCategory;

      const matchesSearch =
        !search ||
        article.title.toLowerCase().includes(search) ||
        article.summary.toLowerCase().includes(search) ||
        article.category.toLowerCase().includes(search) ||
        article.source.toLowerCase().includes(search);

      return matchesCategory && matchesSearch;
    });
  }

  get totalComments(): number {
    return Object.values(this.totales)
      .reduce((total, cantidad) => total + cantidad, 0);
  }

  /** Apodo con el que se publicará el comentario (el de la sesión). */
  get commentAuthor(): string {
    return this.sesion.usuaria()?.apodo ?? '';
  }

  selectCategory(category: string): void {
    this.selectedCategory = category;
  }

  /** Abre o cierra el contenido completo del artículo. */
  toggleContent(articleId: string): void {
    this.expandedArticleId =
      this.expandedArticleId === articleId ? null : articleId;
  }

  /** Párrafos del contenido completo. */
  getParagraphs(article: Article): string[] {
    return article.content
      .split(/\n+/)
      .map(parrafo => parrafo.trim())
      .filter(parrafo => parrafo.length > 0);
  }

  /** Abre o cierra los comentarios. Al abrirlos se piden al backend. */
  toggleComments(articleId: string): void {
    this.selectedArticleId =
      this.selectedArticleId === articleId ? null : articleId;

    this.commentDraft = '';
    this.commentMessage = null;
    this.cancelEdit();
    this.deletingCommentId = null;

    if (this.selectedArticleId) {
      this.cargarComentarios(this.selectedArticleId);
    }
  }

  getComments(articleId: string): ArticleComment[] {
    return this.comments[articleId] ?? [];
  }

  getCommentCount(articleId: string): number {
    return this.comments[articleId]?.length ?? this.totales[articleId] ?? 0;
  }

  /** true si el comentario es de la usuaria con sesión. */
  isMine(comment: ArticleComment): boolean {
    if (comment.userId !== null) {
      return String(comment.userId) === String(this.sesion.idUsuario);
    }
    // Si el backend no manda quién lo escribió, se compara el apodo.
    return !!this.commentAuthor && comment.nickname === this.commentAuthor;
  }

  /** POST /articulos/{id}/comentarios y vuelve a cargar los comentarios. */
  async addComment(articleId: string): Promise<void> {
    const message = this.commentDraft.trim();

    if (!message || this.sendingComment) {
      return;
    }

    this.commentMessage = null;
    this.sendingComment = true;

    try {
      await this.api.crearComentario(articleId, this.sesion.idUsuario, message);
      this.commentDraft = '';
      this.totales[articleId] = (this.totales[articleId] ?? 0) + 1;
      await this.cargarComentarios(articleId);
      this.commentMessage = {
        articleId,
        tipo: 'ok',
        texto: 'Tu comentario fue publicado ♡'
      };
    } catch (error) {
      this.commentMessage = {
        articleId,
        tipo: 'error',
        texto: mensajeDeError(error, 'No se pudo publicar tu comentario.')
      };
    } finally {
      this.sendingComment = false;
    }
  }

  startEdit(comment: ArticleComment): void {
    this.deletingCommentId = null;
    this.commentMessage = null;
    this.editingCommentId = comment.id;
    this.editDraft = comment.message;
  }

  cancelEdit(): void {
    this.editingCommentId = null;
    this.editDraft = '';
  }

  /** PUT /articulos/{id}/comentarios/{idComentario} */
  async saveEdit(articleId: string, comment: ArticleComment): Promise<void> {
    const message = this.editDraft.trim();

    if (!message || this.savingEdit) {
      return;
    }

    this.commentMessage = null;
    this.savingEdit = true;

    try {
      // ⚠ ajusta: se asume editarComentario(idArticulo, idComentario, idUsuario, contenido) en BloomApi.
      await (this.api as any).editarComentario(articleId, comment.id, this.sesion.idUsuario, message);
      this.cancelEdit();
      await this.cargarComentarios(articleId);
      this.commentMessage = {
        articleId,
        tipo: 'ok',
        texto: 'Tu comentario se actualizó ♡'
      };
    } catch (error) {
      this.commentMessage = {
        articleId,
        tipo: 'error',
        texto: mensajeDeError(error, 'No se pudo actualizar tu comentario.')
      };
    } finally {
      this.savingEdit = false;
    }
  }

  askDelete(commentId: string): void {
    this.cancelEdit();
    this.commentMessage = null;
    this.deletingCommentId = commentId;
  }

  cancelDelete(): void {
    this.deletingCommentId = null;
  }

  /** DELETE /articulos/{id}/comentarios/{idComentario} */
  async confirmDelete(articleId: string, comment: ArticleComment): Promise<void> {
    this.commentMessage = null;

    try {
      // ⚠ ajusta: se asume eliminarComentario(idArticulo, idComentario, idUsuario) en BloomApi.
      await (this.api as any).eliminarComentario(articleId, comment.id, this.sesion.idUsuario);
      this.deletingCommentId = null;
      this.totales[articleId] = Math.max(0, (this.totales[articleId] ?? 1) - 1);
      await this.cargarComentarios(articleId);
      this.commentMessage = {
        articleId,
        tipo: 'ok',
        texto: 'Tu comentario fue eliminado.'
      };
    } catch (error) {
      this.deletingCommentId = null;
      this.commentMessage = {
        articleId,
        tipo: 'error',
        texto: mensajeDeError(error, 'No se pudo eliminar tu comentario.')
      };
    }
  }

  formatDate(date: string): string {
    return new Intl.DateTimeFormat('es-CO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
      // Una fecha sola ('2026-11-10') se lee a mediodía para que la zona horaria no la corra un día.
    }).format(new Date(date.length === 10 ? `${date}T12:00:00` : date));
  }

  /** GET /articulos y los convierte al formato del HTML. */
  private async cargarArticulos(): Promise<void> {
    try {
      const lista = await this.api.verArticulos();
      this.articles = lista.map(articulo => this.aArticle(articulo));
      for (const articulo of lista) {
        this.totales[articulo.idArticulo] = articulo.totalComentarios ?? 0;
      }
      this.errorMessage = '';
    } catch (error) {
      this.articles = [];
      this.errorMessage = mensajeDeError(error, 'No se pudieron cargar los artículos.');
    }
  }

  /** GET /articulos/{id}/comentarios */
  private async cargarComentarios(articleId: string): Promise<void> {
    try {
      const lista = await this.api.verComentarios(articleId);
      this.comments = {
        ...this.comments,
        [articleId]: lista.map(comentario => this.aComment(comentario))
      };
      this.totales[articleId] = lista.length;
    } catch {
      this.comments = { ...this.comments, [articleId]: [] };
    }
  }

  private aArticle(articulo: Articulo): Article {
    return {
      id: articulo.idArticulo,
      title: articulo.titulo,
      summary: articulo.resumen,
      content: (articulo as any).contenido ?? '',
      category: articulo.categoria,
      source: articulo.fuente?.nombre ?? articulo.autor ?? 'Bloom',
      url: articulo.fuente?.url ?? '',
      imageUrl: articulo.urlImagen,
      createdAt: articulo.fechaPublicacion
    };
  }

  private aComment(comentario: Comentario): ArticleComment {
    // ⚠ ajusta: se asume que el comentario trae idUsuario para saber cuáles son de la usuaria.
    const idUsuario = (comentario as any).idUsuario;

    return {
      id: comentario.idComentario,
      userId: idUsuario !== undefined && idUsuario !== null ? String(idUsuario) : null,
      nickname: comentario.apodo,
      message: comentario.contenido,
      createdAt: comentario.fechaCreacion
    };
  }
}
