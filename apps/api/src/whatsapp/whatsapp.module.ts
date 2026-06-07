import { Module, forwardRef } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { BaileysService } from './baileys.service';

@Module({
  controllers: [WhatsappController],
  providers: [WhatsappService, BaileysService],
  exports: [WhatsappService, BaileysService],
})
export class WhatsappModule {}
