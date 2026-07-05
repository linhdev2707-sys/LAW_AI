import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feedback } from './entities/feedback.entity';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(Feedback)
    private readonly feedbackRepository: Repository<Feedback>,
  ) {}

  async create(userId: string | null, dto: CreateFeedbackDto): Promise<Feedback> {
    const feedback = this.feedbackRepository.create({
      userId,
      responses: dto.responses,
    });
    return this.feedbackRepository.save(feedback);
  }

  async findAll(): Promise<Feedback[]> {
    return this.feedbackRepository.find({
      relations: ['user'],
      order: {
        createdAt: 'DESC',
      },
    });
  }
}
