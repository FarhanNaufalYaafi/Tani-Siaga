import { Body, Controller, HttpCode, HttpStatus, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { UpdateUserDto } from './dtos/update-user.dto';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {

  }

  @Patch('update')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard)
  async update (
    @Body() requestBody: UpdateUserDto,
    @Req() req
  ){
    await this.userService.userUpdate(req.user.userId, requestBody)
    return {
      message: 'succesfully updated'
    }
 }
}
