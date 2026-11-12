import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { BloomApi, mensajeDeError } from '../../Core/Services/bloom-api.service';
import { Sesion } from '../../Core/Services/sesion.service';
import { Articulo, Comentario } from '../../Core/modelos';

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

interface ArticleComment {
  id: string;
  userId: string | null;
  nickname: string;
  message: string;
  createdAt: string;
}

interface CommentMessage {
  articleId: string;
  tipo: 'ok' | 'error';
  texto: string;
}

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

  expandedArticleId: string | null = null;

  commentDraft = '';

  editingCommentId: string | null = null;
  editDraft = '';
  savingEdit = false;

  deletingCommentId: string | null = null;

  articles: Article[] = [];

  errorMessage = '';

  commentMessage: CommentMessage | null = null;

  sendingComment = false;

  comments: Record<string, ArticleComment[]> = {};

  private totales: Record<string, number> = {};

  constructor() {
    this.cargarArticulos();
  }

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

  get commentAuthor(): string {
    return this.sesion.usuaria()?.apodo ?? '';
  }

  selectCategory(category: string): void {
    this.selectedCategory = category;
  }

  toggleContent(articleId: string): void {
    this.expandedArticleId =
      this.expandedArticleId === articleId ? null : articleId;
  }

  getParagraphs(article: Article): string[] {
    return article.content
      .split(/\n+/)
      .map(parrafo => parrafo.trim())
      .filter(parrafo => parrafo.length > 0);
  }

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

  isMine(comment: ArticleComment): boolean {
    if (comment.userId !== null) {
      return String(comment.userId) === String(this.sesion.idUsuario);
    }
    // Si el backend no manda quién lo escribió, se compara el apodo.
    return !!this.commentAuthor && comment.nickname === this.commentAuthor;
  }

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

  async saveEdit(articleId: string, comment: ArticleComment): Promise<void> {
    const message = this.editDraft.trim();

    if (!message || this.savingEdit) {
      return;
    }

    this.commentMessage = null;
    this.savingEdit = true;

    try {
      await this.api.editarComentario(articleId, comment.id, this.sesion.idUsuario, message);
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

  async confirmDelete(articleId: string, comment: ArticleComment): Promise<void> {
    this.commentMessage = null;

    try {
      await this.api.eliminarComentario(articleId, comment.id, this.sesion.idUsuario);
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
    const idUsuario = comentario.idUsuario;

    return {
      id: comentario.idComentario,
      userId: idUsuario !== undefined && idUsuario !== null ? String(idUsuario) : null,
      nickname: comentario.apodo,
      message: comentario.contenido,
      createdAt: comentario.fechaCreacion
    };
  }
}
