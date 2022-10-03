import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { lastValueFrom, map } from "rxjs";
import { CDAC_TRACKING_STATUS, JOBS, QUEUES } from "./constants.enum";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import * as xmlconverter from "xml-js";

@Injectable()
export class AppService {
  private readonly hasuraGraphqlUrl;
  private readonly hasuraGraphqlSecret;
  private readonly cdacUsername;
  private readonly cdacPassword;
  private readonly cdacTrackingUrl;

  private readonly logger = new Logger(AppService.name); // logger instance

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    @InjectQueue(QUEUES.CDAC_TRACKING) private queue: Queue
  ) {
    this.hasuraGraphqlUrl = configService.get<string>('HASURA_GRAPHQL_URL');
    this.hasuraGraphqlSecret = configService.get<string>('HASURA_GRAPHQL_ADMIN_SECRET');
    this.cdacUsername = configService.get<string>('CDAC_USERNAME');
    this.cdacPassword = configService.get<string>('CDAC_PASSWORD');
    this.cdacTrackingUrl = configService.get<string>('CDAC_TRACKING_URL');
  }

  async hasuraGraphQLCall(
    data,
    url: string = this.hasuraGraphqlUrl,
    headers = {
      'x-hasura-admin-secret': this.hasuraGraphqlSecret,
      'Content-Type': 'application/json',
    },
  ) {
    return await lastValueFrom(
      this.httpService
        .post(url, data, {
          headers: headers,
        })
        .pipe(
          map((res) => {
            const result = res.status == 200 ? res.data : null;
            if (result && result?.errors) {
              // log the error globally & throw 500
              console.error('GraphQl Errors:', result.errors);
              throw new InternalServerErrorException(null, 'GraphQl Error occurred.');
            }
            return result;
          }),
        ),
    );
  }

  public async add(messageId: string) {
    const data = {
      query: `mutation MyMutation($message_id: String = "", $status: smallint = "") {
        insert_cdac_tracking_one(object: {message_id: $message_id, status: $status}) {
          id
          message_id
          status
          last_response
        }
      }`,
      variables: {
        "message_id": messageId,
        "status": CDAC_TRACKING_STATUS.QUEUED
      }
    };

    const response = await this.hasuraGraphQLCall(data);
    console.log(response);
    if (response?.data?.insert_cdac_tracking_one) {
      await this.queue.add(JOBS.CDAC_TRACKING_JOB, response.data.insert_cdac_tracking_one, {
        /*timeout: 30000,
        removeOnComplete: true,
        stackTraceLimit: 30,
        attempts: 3,*/
      });
    } else {
      throw new InternalServerErrorException('Something went wrong while dumping to Hasura...');
    }

    return response;
  }

  public async checkDeliveryStatus(record) {
    this.logger.debug(`Tracking status for: record id<${record.id}> & message_id<${record.message_id}>`);
    const url = this.configService.get('CDAC_TRACKING_URL') + `?userid=${this.cdacUsername}&password=${this.cdacPassword}&msgid=${record.message_id}`;
    const axios = require("axios");
    axios({
      method: "get",
      url: url,
    }).then(r => {
        if (r.status == 200) {
          return r.data;
        }
        throw new Error(`Tracking API failed with status code: ${r.status} & message ${r.statusText}`);
      })
      .then(s => {
        this.logger.debug(`Response received:` + JSON.stringify(s));
        try {
          return JSON.parse(xmlconverter.xml2json(s, { compact: true }));
        } catch (e) {
          this.logger.error('Not a valid XML response.')
          throw e;
        }
      })
      .then(t => {
        const status =  this.parseStatusFromResponse(t);
        this.logger.debug(`Current status: ${status}`);
        const update = {
          query: `mutation UpdateCdacTracking($id: bigint = "", $last_response: String = "", $status: smallint = "") {
            update_cdac_tracking_by_pk(pk_columns: {id: $id}, _set: {status: $status, last_response: $last_response}) {
              id
              status
            }
          }`,
          variables: {
            id: record.id,
            status: status,
          }
        }
        this.hasuraGraphQLCall(update);
      })
      .catch(e => {
        this.logger.error(e.toString());
        const update = {
          query: `mutation UpdateCdacTracking($id: bigint = "", $last_response: String = "", $status: smallint = "") {
            update_cdac_tracking_by_pk(pk_columns: {id: $id}, _set: {status: $status, last_response: $last_response}) {
              id
              status
            }
          }`,
          variables: {
            id: record.id,
            last_response: e.toString(),
            status: CDAC_TRACKING_STATUS.API_FAILED,
          }
        }
        this.hasuraGraphQLCall(update);
        return false;
      });
  }

  public parseStatusFromResponse(data) {
    if (parseInt(data.dept.delvSMSCount._text) > 0) {
      return CDAC_TRACKING_STATUS.SUCCESS;
    } else if (parseInt(data.dept.fldSMSCount._text) > 0) {
      return CDAC_TRACKING_STATUS.FAILED;
    } else if (parseInt(data.dept.subSMSCount._text) > 0) {
      let obj = data.dept.fld;
      if (!(Object.entries(obj).length === 0 && obj.constructor === Object)) {
        return CDAC_TRACKING_STATUS.FAILED;
      } else {
        return CDAC_TRACKING_STATUS.PENDING;
      }
    } else {
      return CDAC_TRACKING_STATUS.PENDING;
    }
  }
}
