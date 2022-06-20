import {Entity, model, property} from '@loopback/repository';

@model()
export class Marsmodel extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: false,
    required: true,
  })
  name: string;

  @property({
    type: 'string',
    required: true,
  })
  ip: string;

  @property({
    type: 'string',
    required: true,
  })
  loginacc: string;

  @property({
    type: 'string',
    required: true,
  })
  loginpwd: string;

  @property({
    type: 'string',
  })
  desc?: string;


  constructor(data?: Partial<Marsmodel>) {
    super(data);
  }
}

export interface MarsmodelRelations {
  // describe navigational properties here
}

export type MarsmodelWithRelations = Marsmodel & MarsmodelRelations;
