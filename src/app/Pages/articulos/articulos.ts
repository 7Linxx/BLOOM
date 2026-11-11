import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface Article {
  id: number;
  title: string;
  summary: string;
  category: string;
  source: string;
  url: string;
  imageUrl: string | null;
  createdAt: string;
}

interface ArticleComment {
  id: number;
  nickname: string;
  message: string;
  createdAt: string;
}

@Component({
  selector: 'app-articulos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './articulos.html',
  styleUrl: './articulos.css'
})
export class Articulos {
  searchText = '';
  selectedCategory = 'Todos';
  selectedArticleId: number | null = null;

  nickname = '';
  commentDraft = '';

  categories = [
    'Todos',
    'Menstruación',
    'Ciclo menstrual',
    'Síntomas',
    'Bienestar',
    'Autocuidado',
    'Salud reproductiva'
  ];

  articles: Article[] = [
    {
      id: 1,
      title: 'Conoce más sobre la salud menstrual',
      summary:
        'La salud menstrual forma parte del bienestar general. Conocer el ciclo, tener acceso a información confiable y reconocer cuándo consultar a un profesional son aspectos importantes del cuidado personal.',
      category: 'Menstruación',
      source: 'Organización Mundial de la Salud (OMS)',
      url: 'https://www.who.int/es/news-room/fact-sheets/detail/menstrual-health',
      imageUrl: null,
      createdAt: new Date().toISOString()
    },
    {
      id: 2,
      title: 'Comprende tu primer periodo',
      summary:
        'Aprende qué es la menstruación, cuánto puede durar, cómo se cuenta un ciclo menstrual y qué productos de higiene menstrual existen.',
      category: 'Ciclo menstrual',
      source: 'American College of Obstetricians and Gynecologists (ACOG)',
      url: 'https://www.acog.org/womens-health/faqs/your-first-period',
      imageUrl: null,
      createdAt: new Date().toISOString()
    },
    {
      id: 3,
      title: 'Conoce tu salud vulvovaginal',
      summary:
        'Conocer los cambios habituales del flujo vaginal y prestar atención a cambios persistentes de olor, color o consistencia puede ayudarte a reconocer cuándo necesitas orientación profesional.',
      category: 'Autocuidado',
      source: 'American College of Obstetricians and Gynecologists (ACOG)',
      url: 'https://www.acog.org/womens-health/faqs/salud-vulvovaginal',
      imageUrl: null,
      createdAt: new Date().toISOString()
    }
  ];

  comments: Record<number, ArticleComment[]> = {};

  constructor() {
    this.loadComments();
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
    return Object.values(this.comments)
      .reduce((total, articleComments) => total + articleComments.length, 0);
  }

  selectCategory(category: string): void {
    this.selectedCategory = category;
  }

  toggleComments(articleId: number): void {
    this.selectedArticleId =
      this.selectedArticleId === articleId ? null : articleId;

    this.nickname = '';
    this.commentDraft = '';
  }

  getComments(articleId: number): ArticleComment[] {
    return this.comments[articleId] ?? [];
  }

  getCommentCount(articleId: number): number {
    return this.getComments(articleId).length;
  }

  addComment(articleId: number): void {
    const nickname = this.nickname.trim();
    const message = this.commentDraft.trim();

    if (!nickname || !message) {
      return;
    }

    const newComment: ArticleComment = {
      id: Date.now(),
      nickname,
      message,
      createdAt: new Date().toISOString()
    };

    const currentComments = this.getComments(articleId);

    this.comments = {
      ...this.comments,
      [articleId]: [...currentComments, newComment]
    };

    this.nickname = '';
    this.commentDraft = '';

    this.saveComments();
  }

  formatDate(date: string): string {
    return new Intl.DateTimeFormat('es-CO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date(date));
  }

  private loadComments(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      const savedComments = localStorage.getItem('bloom_article_comments');

      if (savedComments) {
        this.comments = JSON.parse(savedComments);
      }
    } catch {
      this.comments = {};
    }
  }

  private saveComments(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(
        'bloom_article_comments',
        JSON.stringify(this.comments)
      );
    } catch {
      console.error('No fue posible guardar los comentarios.');
    }
  }
}
