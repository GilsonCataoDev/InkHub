import { Module } from '@nestjs/common';
import { TattooArtistsService } from './tattoo-artists.service';
import { TattooArtistsController } from './tattoo-artists.controller';

@Module({
  controllers: [TattooArtistsController],
  providers: [TattooArtistsService],
  exports: [TattooArtistsService],
})
export class TattooArtistsModule {}
