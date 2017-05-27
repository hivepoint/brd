import { server } from './server';
const cliArgs = require("command-line-args");
const path = require('path');
import { config } from './config';
import { ExecutionContext } from "./execution-context";

const VERSION = 1;

function start() {
  // http://stackoverflow.com/questions/9768444/possible-eventemitter-memory-leak-detected
  process.setMaxListeners(20);

  const cli = cliArgs([{
    name: "help",
    alias: "h",
    type: Boolean,
    description: "Print usage instructions"
  }, {
    name: "config",
    alias: "c",
    type: String,
    description: "Path to a configuration file (based on config.json)"
  }]);

  /* parse the supplied command-line values */
  const options = cli.parse();

  /* generate a usage guide */
  const usage = cli.getUsage({
    header: "Braid",
    footer: "For more information, visit https://braid.io"
  });

  if (options.help) {
    console.log(usage);
    process.exit();
  }

  if (!options.version) {
    options.version = VERSION;
  }

  let configPath = path.join(__dirname, '../config.json');
  if (options.config) {
    configPath = options.config;
  }
  const configDevPath = path.join(__dirname, '../config.dev.json');

  process.on('exit', (code: any) => {
    console.log(`About to exit with code: ${code}`);
  });

  const onExit = require('signal-exit');

  onExit((code: any, signal: any) => {
    console.log('process exiting!');
    console.log(code, signal);
  });

  void config.fetch(configPath, configDevPath, options).then(() => {
    console.log("Braid server initializing");
    const context = new ExecutionContext('startup', config.data);
    void server.start(context).then(() => {
      // noop
    });
  });
}

start();
