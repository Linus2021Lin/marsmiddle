import express from 'express';
import {Request, Response, NextFunction} from 'express';
import path from 'path';
import {ApplicationConfig, MarsmiddleApplication} from './application';
import {once} from 'events';
import * as http from 'http';

export {ApplicationConfig, MarsmiddleApplication};

export class ExpressServer {
  public readonly expressApp: express.Application;
  public readonly lbApp: MarsmiddleApplication;
  private server: http.Server;

  constructor(options: ApplicationConfig = {}) {
    this.expressApp = express();
    this.lbApp = new MarsmiddleApplication(options);

    // Add the basepath for marsmiddle APIs
    this.expressApp.use('/marsmiddle/api/v1', this.lbApp.requestHandler);

    // Serve static files in the public folder
    let staticOptions = {
      // redirect: true
    }
    this.expressApp.use('/', express.static('./public', staticOptions));

    // Set all paths to redirect to index.html
    this.expressApp.get('/*', function (req: Request, res: Response) {
      // console.log(_req.url, 'URL');
      res.sendFile(path.resolve('public/index.html'));
    });

    // this.expressApp.get('/sites', function (_req: Request, res: Response) {
    //   res.sendFile(path.resolve('public/index.html'));
    // });

    // this.expressApp.all('/*', function(req: Request, res: Response, next: NextFunction) {
    //   //Redirecting to index only the requests that do not start with ignored paths
    //   console.log(req.url);
    //   if(!req.url.startsWith('/api')) {
    //     // res.sendFile('index.html', { root: path.resolve(__dirname, '../public') });
    //     res.sendFile(path.resolve('public/index.html'));
    //   } else {
    //     next();
    //   }
    // });

  }

  async boot() {
    await this.lbApp.boot();
  }

  public async start() {
    await this.lbApp.start();
    const port = this.lbApp.restServer.config.port ?? 3000;
    const host = this.lbApp.restServer.config.host || '127.0.0.1';
    this.server = this.expressApp.listen(port, host);
    await once(this.server, 'listening');
    const url = host + ':' + port;
    console.log(`Server is running at ${url}`);
  }

}