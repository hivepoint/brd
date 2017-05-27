import fs = require('fs');

export class Config {
  data: any;

  async fetch(configPath: string, configDevPath: string, options: any): Promise<void> {
    console.log("Reading configuration from " + configPath);
    const data = fs.readFileSync(configPath, 'utf8');
    this.data = JSON.parse(data);
    if (options.version) {
      this.data.version = options.version;
    }
    if (options.domain) {
      this.data.domain = options.domain;
    }
    if (this.data.mongo && this.data.mongo.mongoUrl) {
      this.data.mongo.mongoUrl = this.data.mongo.mongoUrl.split("{domain}").join(this.data.domain.split(".").join("_"));
    }
    if (configDevPath) {
      const devStat = fs.statSync(configDevPath);
      if (devStat.isFile) {
        const ddata = fs.readFileSync(configDevPath, 'utf8');
        this.data.dev = JSON.parse(ddata);
        if (this.data.dev.ngrokUrl) {
          this.data.baseClientUri = this.data.dev.ngrokUrl;
        }
      }
    }
  }
}

const config = new Config();

export { config };
