import { Controller } from '@nestjs/common';
import { BpsService } from './bps.service';

@Controller('bps')
export class BpsController {
  constructor(private readonly bpsService: BpsService) {}
}
