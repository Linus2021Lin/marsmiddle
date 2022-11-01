import {Entity, model, property, hasMany} from '@loopback/repository';
import {Controller} from './controller.model';

@model()
export class Site extends Entity {
  
  @property({
    type: 'string',
    id: true,
    generated: true,
    hidden: true,
  })
  siteId: string;

  @property({
    type: 'string',
    required: true,
  })
  siteName: string;

  @property({
    type: 'string',
    default: '',
  })
  siteDescription?: string;

  @hasMany(() => Controller, {keyTo: 'siteId'})
  controllers: Controller[];

  constructor(data?: Partial<Site>) {
    super(data);
  }
}

export interface SiteRelations {
  // describe navigational properties here
}

export type SiteWithRelations = Site & SiteRelations;
