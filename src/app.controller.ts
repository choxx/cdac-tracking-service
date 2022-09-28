import { Controller, Get, Param, Put } from "@nestjs/common";
import { AppService } from './app.service';
import { randomUUID } from "crypto";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Put('track/:messageId')
  public async track(
    @Param('messageId') messageId: string
  ) {
    return this.appService.add(messageId);
  }

  @Get('simulate')
  public async simulate() {
    return this.appService.add(randomUUID());
  }
}
