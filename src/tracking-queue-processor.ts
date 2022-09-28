import { Process, Processor } from "@nestjs/bull";
import { JOBS, QUEUES } from "./constants.enum";
import { Job } from "bull";
import { AppService } from "./app.service";

@Processor(QUEUES.CDAC_TRACKING)
export class TrackingQueueProcessor {
  constructor(private readonly appService: AppService) {}

  @Process(JOBS.CDAC_TRACKING_JOB)
  process(job:Job<unknown>){
    const data = job.data;
    this.appService.checkDeliveryStatus(data);
  }
}
