import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { RegisterTokenDto } from './dtos/register-token.dtos';
import { UnregisterTokenDto } from './dtos/unregister-token.dto';

@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('device-token')
  @UseGuards(JwtGuard)
  async registerDeviceToken(
  @Body() dto: RegisterTokenDto,
  @Req() req: any
) {
    const userId = req.user.userId 
    return await this.notificationService.saveDeviceToken(userId, dto.fcmToken, dto.deviceType);
  } 

  @Delete('device-token')
  @UseGuards(JwtGuard)
  async unregisterDeviceToken(
    @Body() dto: UnregisterTokenDto,
    @Req() req: any,
  ) {
    return await this.notificationService.removeDeviceToken(req.user.userId, dto.fcmToken);
  }

  @Get()
  @UseGuards(JwtGuard)
  async getNotifications(@Req() req: any) {
    return this.notificationService.getInAppNotifications(req.user.userId);
  }

  @Get(':id')
  @UseGuards(JwtGuard)
  async getNotification(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.notificationService.getInAppNotification(req.user.userId, id);
  }

  @Patch(':id/read')
  @UseGuards(JwtGuard)
  async markNotificationRead(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.notificationService.markInAppNotificationRead(req.user.userId, id);
  }

  @Patch('read-all')
  @UseGuards(JwtGuard)
  async markAllNotificationsRead(@Req() req: any) {
    return this.notificationService.markAllInAppNotificationsRead(req.user.userId);
  }

  @Delete(':id')
  @UseGuards(JwtGuard)
  async deleteNotification(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.notificationService.deleteInAppNotification(req.user.userId, id);
  }

  @Delete()
  @UseGuards(JwtGuard)
  async deleteAllNotifications(@Req() req: any) {
    return this.notificationService.deleteAllInAppNotifications(req.user.userId);
  }

}
