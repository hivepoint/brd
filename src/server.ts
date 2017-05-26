import * as express from "express";
import * as compression from "compression";
import * as bodyParser from "body-parser";
import * as cookieParser from 'cookie-parser';
import * as path from "path";

class Server {
  private running = false;
  private app: express.Application;

  async start(port: number): Promise<void> {
    if (this.running) {
      return;
    }
    this.app = express();
    this.app.set("port", port);
    this.app.use(compression());
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: true }));
    this.app.use(cookieParser());

    this.app.use(express.static(path.join(__dirname, "../public"), { maxAge: 31557600000 }));

    this.app.listen(port, () => {
      this.running = true;
      console.log(("  App is running at http://localhost:%d in %s mode"), this.app.get("port"), this.app.get("env"));
    });
  }
}

const server = new Server();

export function startServer(port: number) {
  server.start(port).then(() => {
    console.log("Finished starting Braid server");
  }).catch((err) => {
    console.error("Failure starting server", err);
    process.exit();
  });
}
