import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {
  post,
  param,
  get,
  getModelSchemaRef,
  patch,
  put,
  del,
  requestBody,
  response,
  HttpErrors
} from '@loopback/rest';
import {Marsmodel} from '../models';
import {MarsmodelRepository} from '../repositories';
const { encrypt, decrypt } = require('./crypto');
const isIp = require('is-ip');
const http = require('http');
var querystring = require('querystring');

class CustomHttpError extends Error {
  statusCode: number

  constructor(status: number, message: string) {
    super(message)
    this.statusCode = status
  }
}
function checkIPconnectivity(marsmodel:Marsmodel, password?: String) {
       return new Promise ((resolve, reject) => {
           let pass = typeof password != 'undefined' ? password: marsmodel.loginpwd;
           let req = http.request({'host': marsmodel.ip,
              'port': 80,
              'path':'/mars/useraccount/v1/login',
              'method': 'POST',
              'timeout': 3000,
              'headers': {'Content-Type': 'application/json', 'Accept': 'application/json'}
              });
           req.on('response', (res:any) => {
               resolve(res);
           });
           req.on('error', (err:any) => {
               reject(err);
           });
           req.on('timeout', () => {
               req.destroy();
           });
           req.write(JSON.stringify({user_name: marsmodel.loginacc, password: pass}));
           req.end();
      });
}

function IntTwoChars(i:number) {
    return (`0${i}`).slice(-2);
}

function gertCurrentTimestamp(plus: number): String {
    let ts = Date.now() + plus*1000; //plus convert to seconds
    let date_ob = new Date(ts);
    let date = IntTwoChars(date_ob.getDate());
    let month = IntTwoChars(date_ob.getMonth() + 1);
    let year = date_ob.getFullYear();
    let hours = IntTwoChars(date_ob.getHours());
    let minutes = IntTwoChars(date_ob.getMinutes());
    let seconds = IntTwoChars(date_ob.getSeconds());
    // prints date & time in 2022-07-25T08:19:00Z
    let dateDisply = year + "-" + month + "-" + date + "T" + hours + ":" + minutes + ":" + seconds + "Z";
    //console.log(dateDisply);
    return dateDisply;
}

async function getCpuRam(marsmodel: Marsmodel) {
    try {
        marsmodel.status = false;
        marsmodel.cpuIdle = 0;
        marsmodel.ramUsage = 0;
        //decode apssword
        let loginpwd = decrypt(marsmodel.loginpwd);
        let res:any = await checkIPconnectivity(marsmodel, loginpwd); //Class: http.IncomingMessage
        if (res.statusCode == 200) {
           marsmodel.status = true;
           let resCpu:any = await getPath(marsmodel.ip, res.headers["mars_g_session_id"] ,'/mars/analyzer/v1/timerangebar_all/ctrl/cpu/' + gertCurrentTimestamp(-60) + '\/' + gertCurrentTimestamp(0) + '/30');
           let cpu:any = JSON.parse(resCpu.toString());
           if (cpu.cpu.length != 0) {
               //console.log(cpu.cpu[0].resources);
               if(cpu.cpu[0].resources.length != 0) {
                   //console.log("result: " + cpu.cpu[0].resources[0].idle_percent);
                   marsmodel.cpuIdle = cpu.cpu[0].resources[0].idle_percent;
               } else {
                   marsmodel.cpuIdle = 0;
               }
           } else {
               marsmodel.cpuIdle = 0;
           }

           let resRam:any = await getPath(marsmodel.ip, res.headers["mars_g_session_id"] ,'/mars/analyzer/v1/timerangebar_all/ctrl/memory/' + gertCurrentTimestamp(-60) + '\/' + gertCurrentTimestamp(0) + '/30');
           let mem:any = JSON.parse(resRam.toString());
           if (mem.memory.length != 0) {
               //console.log(mem.memory[0].resources);
               if(mem.memory[0].resources.length != 0) {
                   //console.log("result: " + mem.memory[0].resources[0].used_percent);
                   marsmodel.ramUsage = mem.memory[0].resources[0].used_percent;
               } else {
                   marsmodel.ramUsage = 0;
               }
           } else {
               marsmodel.ramUsage = 0;
           }
        }
    } catch (err) {
        console.log("getCpuRam error name:" + marsmodel.name +", IP:" + marsmodel.ip + ", loginacc: " + marsmodel.loginacc + ", loginpwd: " +marsmodel.loginpwd + ", status:"+err);
    }
    return marsmodel;
}
function getPath(ip: String, token: String, path:String) {
       return new Promise ((resolve, reject) => {
           let req = http.request({'host': ip,
              'port': 8181,
              'path': path,
              'method': 'GET',
              'timeout': 3000,
              'headers': {'Cookie': 'marsGSessionId=' + token }
              }, (res:any) => {
                    if (res.statusCode >= 200 || res.statusCode < 300) {
                        res.on('data', (data:any) => {
                           //console.log(JSON.parse(data));
                           try {
                               resolve(data);
                           } catch(e) {
                               reject(e);
                           }
                        });
                    }
              });
           req.on('error', (err:any) => {
               reject(err);
           });
           req.on('timeout', () => {
               req.destroy();
           });
           req.end();
      });
}


export class SiteController {
  constructor(
    @repository(MarsmodelRepository)
    public marsmodelRepository : MarsmodelRepository,
  ) {}

  /*
  async addOtherControllersInSameSite (marsmodel: Marsmodel) {
    try {
        let res:any = await checkIPconnectivity(marsmodel);
        if (res.statusCode == 200) {
            let resCluster:any = await getPath(marsmodel.ip, res.headers["mars_g_session_id"], '/mars/v1/cluster');
            let cluster:any = JSON.parse(resCluster.toString());
               for (const i in cluster.nodes) {
                   if(cluster.nodes[i].ip == marsmodel.ip) {
                       continue;
                   }
                   let newCtrl = new Marsmodel(marsmodel);
                   newCtrl.name = marsmodel.name +"_" + cluster.nodes[i].ip
                   newCtrl.ip = cluster.nodes[i].ip;
                   this.marsmodelRepository.create(newCtrl);
               }
            }
        }
    } catch (err) {
        console.log("addOtherControllersInSameSite error name:" + marsmodel.name +", IP:" + marsmodel.ip + ", loginacc: " + marsmodel.loginacc + ", loginpwd: " +marsmodel.loginpwd + ", status:"+err);
    }
  }
  */

  @post('/marsmiddle')
  @response(200, {
    description: 'Marsmodel model instance',
    content: {'application/json': {schema: getModelSchemaRef(Marsmodel)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Marsmodel, {
            title: 'New Mars Controller',
          }),
        },
      },
    })
    marsmodel: Marsmodel,
  ): Promise<Marsmodel> {

    if (!isIp.v4(marsmodel.ip) && !isIp.v6(marsmodel.ip)) {
       throw new CustomHttpError(400, 'Invalid IP address.');
    }

    //this.addOtherControllersInSameSite(marsmodel); If this cluster's other controller using local IP, we may not connect to it. Let user add all site's controller will be better.

    marsmodel.loginpwd = encrypt(marsmodel.loginpwd);
    return this.marsmodelRepository.create(marsmodel);
  }

  @get('/marsmiddle/count')
  @response(200, {
    description: 'Marsmodel model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(Marsmodel) where?: Where<Marsmodel>,
  ): Promise<Count> {
    return this.marsmodelRepository.count(where);
  }

  @get('/marsmiddle')
  @response(200, {
    description: 'Array of Marsmodel model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Marsmodel, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Marsmodel) filter?: Filter<Marsmodel>,
  ): Promise<Marsmodel[]> {
    let marsmodel: Marsmodel[] = await this.marsmodelRepository.find(filter);

    for (const i in marsmodel) {
        marsmodel[i] = await getCpuRam(marsmodel[i]);
    }

    return marsmodel;
  }

  @get('/marsmiddle/{id}')
  @response(200, {
    description: 'Marsmodel model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Marsmodel, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Marsmodel, {exclude: 'where'}) filter?: FilterExcludingWhere<Marsmodel>
  ): Promise<Marsmodel> {
    let marsmodel: Marsmodel = await this.marsmodelRepository.findById(id, filter);
    return getCpuRam(marsmodel);
  }

  @patch('/marsmiddle')
  @response(200, {
    description: 'Marsmodel PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Marsmodel, {partial: true}),
        },
      },
    })
    marsmodel: Marsmodel,
    @param.where(Marsmodel) where?: Where<Marsmodel>,
  ): Promise<Count> {

    if (!isIp.v4(marsmodel.ip) && !isIp.v6(marsmodel.ip)) {
       throw new CustomHttpError(400, 'Invalid IP address.');
    }

    marsmodel.loginpwd = encrypt(marsmodel.loginpwd);
    return this.marsmodelRepository.updateAll(marsmodel, where);
  }

  @patch('/marsmiddle/{id}')
  @response(204, {
    description: 'Marsmodel PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Marsmodel, {partial: true}),
        },
      },
    })
    marsmodel: Marsmodel,
  ): Promise<void> {
    if (!isIp.v4(marsmodel.ip) && !isIp.v6(marsmodel.ip)) {
       throw new CustomHttpError(400, 'Invalid IP address.');
    }

    marsmodel.loginpwd = encrypt(marsmodel.loginpwd);
    await this.marsmodelRepository.updateById(id, marsmodel);
  }

  @put('/marsmiddle/{id}')
  @response(204, {
    description: 'Marsmodel PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() marsmodel: Marsmodel,
  ): Promise<void> {

    if (!isIp.v4(marsmodel.ip) && !isIp.v6(marsmodel.ip)) {
       throw new CustomHttpError(400, 'Invalid IP address.');
    }

    marsmodel.loginpwd = encrypt(marsmodel.loginpwd);
    await this.marsmodelRepository.replaceById(id, marsmodel);
  }

  @del('/marsmiddle/{id}')
  @response(204, {
    description: 'Marsmodel DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.marsmodelRepository.deleteById(id);
  }
}
