import { Injectable, Logger, OnModuleInit, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  source: string;
  link?: string;
  image?: string;
  publishedAt: Date;
  createdAt: Date;
}

@Injectable()
export class NewsService implements OnModuleInit {
  private readonly logger = new Logger(NewsService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    this.logger.log('Initializing News database table...');
    try {
      await this.dataSource.query(
        'CREATE TABLE IF NOT EXISTS "news_articles" (' +
          '  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),' +
          '  "title" VARCHAR(255) NOT NULL,' +
          '  "summary" TEXT NOT NULL,' +
          '  "content" TEXT NOT NULL,' +
          '  "source" VARCHAR(100) NOT NULL,' +
          '  "link" VARCHAR(255) UNIQUE,' +
          '  "published_at" TIMESTAMPTZ NOT NULL,' +
          '  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()' +
          ');',
      );

      await this.dataSource.query(
        'ALTER TABLE "news_articles" ADD COLUMN IF NOT EXISTS "link" VARCHAR(255) UNIQUE;',
      );

      await this.dataSource.query(
        'ALTER TABLE "news_articles" ADD COLUMN IF NOT EXISTS "image" TEXT;',
      );
    } catch (err) {
      this.logger.error('Failed to initialize news table', err);
    }
  }

  async getLatestNews(): Promise<NewsArticle[]> {
    return this.dataSource.query(
      'SELECT ' +
        '  "id", ' +
        '  "title", ' +
        '  "summary", ' +
        '  "content", ' +
        '  "source", ' +
        '  "link", ' +
        '  "image", ' +
        '  "published_at" as "publishedAt", ' +
        '  "created_at" as "createdAt" ' +
        'FROM "news_articles" ' +
        'WHERE "published_at" <= now() ' +
        'ORDER BY "published_at" DESC ' +
        'LIMIT 10',
    );
  }

  async getAllNewsForAdmin(): Promise<NewsArticle[]> {
    return this.dataSource.query(
      'SELECT ' +
        '  "id", ' +
        '  "title", ' +
        '  "summary", ' +
        '  "content", ' +
        '  "source", ' +
        '  "link", ' +
        '  "image", ' +
        '  "published_at" as "publishedAt", ' +
        '  "created_at" as "createdAt" ' +
        'FROM "news_articles" ' +
        'ORDER BY "published_at" DESC',
    );
  }

  async createNews(title: string, content: string, image: string, source: string): Promise<NewsArticle> {
    const summary = content.length > 300 ? content.slice(0, 300) + '...' : content;
    const dbSource = source.trim() || 'Admin';
    const publishedAt = new Date();

    const results = await this.dataSource.query(
      'INSERT INTO "news_articles" ("title", "summary", "content", "source", "image", "published_at") ' +
        'VALUES ($1, $2, $3, $4, $5, $6) ' +
        'RETURNING "id", "title", "summary", "content", "source", "image", "published_at" as "publishedAt", "created_at" as "createdAt"',
      [title, summary, content, dbSource, image, publishedAt],
    );

    return results[0];
  }

  async updateNews(id: string, title: string, content: string, image: string, source: string): Promise<NewsArticle> {
    const summary = content.length > 300 ? content.slice(0, 300) + '...' : content;
    const dbSource = source.trim() || 'Admin';

    const results = await this.dataSource.query(
      'UPDATE "news_articles" ' +
        'SET "title" = $1, "summary" = $2, "content" = $3, "image" = $4, "source" = $5 ' +
        'WHERE "id" = $6 ' +
        'RETURNING "id", "title", "summary", "content", "source", "image", "published_at" as "publishedAt", "created_at" as "createdAt"',
      [title, summary, content, image, dbSource, id],
    );

    if (!results || results.length === 0) {
      throw new NotFoundException(`News article with ID ${id} not found`);
    }

    return results[0];
  }

  async deleteNews(id: string): Promise<void> {
    const result = await this.dataSource.query(
      'DELETE FROM "news_articles" WHERE "id" = $1 RETURNING "id"',
      [id],
    );
    if (!result || result.length === 0) {
      throw new NotFoundException(`News article with ID ${id} not found`);
    }
  }
}
