import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { FarmerGroupService } from './farmer-group.service';
import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { create } from 'domain';
import { CreateFarmerDto } from './dtos/create-farmer-group.dto';
import { AddMemberDto } from './dtos/add-member.dto';

@Controller('farmer-group')
export class FarmerGroupController {
  constructor(private readonly farmerGroupService: FarmerGroupService) {

  }
  @Post()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard)
  async createFarmerGrop(
    @Body() requestBody: CreateFarmerDto,
    @Req() req: any
  ){
    const leaderUserId = req.user.userId
    return await this.farmerGroupService.create(requestBody, leaderUserId)
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard)
  async getAll(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '8',
    @Query('search') search = '',
  ){
    return await this.farmerGroupService.getAll(req.user.userId, Number(page), Number(limit), search)
  }

  @Get('/pending')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard)
  async getPendingMembers(@Req() req: any) {
    const leaderId = req.user.userId
    return await this.farmerGroupService.getPendingMembers(leaderId);
  } 

  @Post('/add-members')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard)
  async addMember(
    @Body() dto: AddMemberDto,
    @Req() req: any,
  ) {
    const leaderId = req.user.userId;
    return await this.farmerGroupService.addMember(dto.userId, leaderId);
  }

  @Post('leave')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard)
  async leaveGroup(@Req() req: any) {
    const userId = req.user.userId;
    return await this.farmerGroupService.leaveGroup(userId);
  }

  @Get("/:id")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard)
  async getById(
    @Param('id', ParseIntPipe) farmerGroupId: number,
    @Req() req: any,
  ){
    return await this.farmerGroupService.get(farmerGroupId, req.user.userId)
  }

  @Post(':id/apply')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard)
  async applyToGroup(
    @Param('id', ParseIntPipe) groupId: number,
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    return await this.farmerGroupService.applyToGroup(groupId, userId);
  }

  @Post('/approve/:userId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard)
  async approveMember(
    @Param('userId', ParseIntPipe) targetUserId: number,
    @Req() req: any,
  ) {
    const leaderId = req.user.userId;
    return await this.farmerGroupService.approveMember(targetUserId, leaderId);
  }

  @Post('/reject/:userId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard)
  async rejectMember(
    @Param('userId', ParseIntPipe) targetUserId: number,
    @Req() req: any,
  ) {
    const leaderId = req.user.userId;
    return await this.farmerGroupService.rejectMember(targetUserId, leaderId);
  }

  @Delete('members/:userId')
  @UseGuards(JwtGuard)
  async removeMember(
    @Param('userId', ParseIntPipe) targetUserId: number,
    @Req() req: any,
  ) {
    const leaderUserId = req.user.userId;
    return await this.farmerGroupService.removeMember(targetUserId, leaderUserId);
  }
}
