import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@law-ai/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RagService } from './rag.service';
import { CreateRagDocumentDto } from './dto/create-rag-document.dto';
import { RagDocumentIdParamDto } from './dto/rag-document-id.dto';

@ApiTags('admin-rag')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/rag')
export class RagAdminController {
  constructor(private readonly ragService: RagService) {}

  @Get('documents')
  list() {
    return this.ragService.listDocuments();
  }

  @Post('documents')
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser('sub') userId: string, @Body() dto: CreateRagDocumentDto) {
    return this.ragService.ingest(dto, userId);
  }

  @Get('documents/:id')
  getOne(@Param() params: RagDocumentIdParamDto) {
    return this.ragService.getDocument(params.id);
  }

  @Delete('documents/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param() params: RagDocumentIdParamDto) {
    await this.ragService.deleteDocument(params.id);
  }
}
