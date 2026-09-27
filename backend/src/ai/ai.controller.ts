import { Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { NotificationService } from 'src/notification/notification.service';
import { QueryHistoryDto } from './dtos/query-history.dto';

@Controller('ai-recommendations')
@UseGuards(JwtGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly notificationService: NotificationService
  ) {}

                                                   
                                                                                             
  @Get('market-analysis/my-farmlands')
  @UseGuards(JwtGuard)
  async getMyAndGroupMarketAnalysis(
    @Req() req: any,
    @Query() query: QueryHistoryDto,
  ) {
    const userId = req.user.userId
    return await this.aiService.getMyAndGroupMarketAnalysisHistory(
      userId,
      req.user.farmer_group_id || null,
      query,
    );
  }

                                           
                                            
  @Get('market-analysis/:id')
  async getMarketAnalysisDetail(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return await this.aiService.getMarketAnalysisDetail(id, req.user.userId, req.user.farmer_group_id || null);
  }

  @Get('recommendations/my-farmlands')
  async getMyAndGroupRecommendations(
    @Req() req: any,
    @Query() query: QueryHistoryDto,
  ) {
    return await this.aiService.getMyAndGroupRecommendationsHistory(
      req.user.userId,
      req.user.farmer_group_id || null,
      query,
    );
  }

                                           
                                              
  @Get('recommendations/:id')
  async getRecommendationDetail(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return await this.aiService.getRecommendationDetail(
      id,
      req.user.userId,
      req.user.farmer_group_id || null,
    );
  }

                                                             
                                                                    
  @Get('farmlands/:farmlandId/recommendations')
  async getFarmlandRecommendationsHistory(
    @Param('farmlandId', ParseIntPipe) farmlandId: number,
    @Query() query: QueryHistoryDto,
  ) {
    return await this.aiService.getFarmlandRecommendationsHistory(
      farmlandId,
      query,
    );
  }

  @Get('farmlands/:farmlandId/market-analysis')
  async getFarmlandMarketAnalysisHistory(
    @Param('farmlandId', ParseIntPipe) farmlandId: number,
    @Query() query: QueryHistoryDto,
  ) {
    return await this.aiService.getFarmlandMarketAnalysisHistory(
      farmlandId,
      query,
    );
  }

}