import { Controller } from '@nestjs/common';
import { BmkgService } from './bmkg.service';

@Controller('bmkg')
export class BmkgController {
  constructor(private readonly bmkgService: BmkgService) {}
}
