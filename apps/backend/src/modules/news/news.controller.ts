import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@law-ai/shared';
import { NewsService } from './news.service';
import { CreateNewsDto, UpdateNewsDto } from './dto/news.dto';

@ApiTags('news')
@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  async getLatest() {
    return this.newsService.getLatestNews();
  }

  @ApiBearerAuth('access-token')
  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAllForAdmin() {
    return this.newsService.getAllNewsForAdmin();
  }

  @ApiBearerAuth('access-token')
  @Post('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async create(@Body() dto: CreateNewsDto) {
    return this.newsService.createNews(dto.title, dto.content, dto.image || '', dto.source || 'Admin');
  }

  @ApiBearerAuth('access-token')
  @Put('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async update(@Param('id') id: string, @Body() dto: UpdateNewsDto) {
    return this.newsService.updateNews(id, dto.title, dto.content, dto.image || '', dto.source || 'Admin');
  }

  @ApiBearerAuth('access-token')
  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async remove(@Param('id') id: string) {
    await this.newsService.deleteNews(id);
    return { success: true };
  }
}
