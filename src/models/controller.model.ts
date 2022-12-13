import {Entity, model, property} from '@loopback/repository';

@model()
export class Controller extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: false,
    required: true,
  })
  controllerName: string;

  @property({
    type: 'string',
    required: true,
    hidden: true,
  })
  siteId: string;

  // only for response, should not save into DB
  @property({
    type: 'string',
  })
  siteName?: string;

  @property({
    type: 'string',
    required: true,
  })
  ipAddress: string;

  @property({
    type: 'string',
    required: true,
  })
  loginAccount: string;

  @property({
    type: 'string',
    required: true,
    hidden: true,
  })
  loginPassword: string;

  @property({
    type: 'string',
    default: '',
  })
  description?: string;

   // only for response, should not save into DB
  @property({
    type: 'boolean',
    // default: false,
  })
  loginStatus?: boolean;

   // only for response, should not save into DB
  @property({
    type: 'number',
    // default: -1,
  })
  cpuIdle?: number;

   // only for response, should not save into DB
  @property({
    type: 'number',
    // default: -1,
  })
  ramUsage?: number;

  // only for response, should not save into DB
  @property({
    type: 'number',
    // default: -1,
  })
  deviceCounts?: number;

  // only for response, should not save into DB
  @property({
    type: 'number',
    // default: -1,
  })
  availableDeviceCounts?: number;

  constructor(data?: Partial<Controller>) {
    super(data);
  }
}

export interface ControllerRelations {
  // describe navigational properties here
}

export type ControllerWithRelations = Controller & ControllerRelations;
