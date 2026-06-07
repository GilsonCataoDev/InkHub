import { Module } from '@nestjs/common';
import { BriefingController } from './briefing.controller';
import { BriefingService } from './briefing.service';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

@Module({
  imports: [
    MulterModule.register({
      storage: diskStorage({
        destination: './uploads/briefings',
        filename: (_req, file, cb) => {
          cb(null, `${uuidv4()}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        cb(null, allowed.test(extname(file.originalname).toLowerCase()));
      },
      limits: { fileSize: 10 * 1024 * 1024, files: 5 },
    }),
  ],
  controllers: [BriefingController],
  providers: [BriefingService],
})
export class BriefingModule {}
