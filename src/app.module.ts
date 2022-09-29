import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import { BullModule } from "@nestjs/bull";
import { QUEUES } from "./constants.enum";
import { TrackingQueueProcessor } from "./tracking-queue-processor";

@Module({
  imports: [
    HttpModule,
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
    }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT),
      },
      limiter: {
        max: 10,  // we can register here for global rate limiter
        duration: 1000
      }
    }),
    BullModule.registerQueue({
      name: QUEUES.CDAC_TRACKING,
      limiter: {
        max: 1, // this queue's rate limiter
        duration: 1000
      }
    }),
  ],
  controllers: [AppController],
  providers: [AppService, TrackingQueueProcessor],
})
export class AppModule {}
