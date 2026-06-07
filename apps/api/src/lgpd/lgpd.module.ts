import { Module } from '@nestjs/common';
import { LgpdController } from './lgpd.controller';
import { LgpdService } from './lgpd.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LgpdController],
  providers: [LgpdService],
})
export class LgpdModule {}
