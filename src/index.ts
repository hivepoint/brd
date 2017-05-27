import { server } from './server';
import cliArgs = require('command-line-args');
const path = require('path');
import { config } from './config';

const VERSION = 1;

function start() {
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

  let configPath = path.join(__dirname, 'config.json');
  if (options.config) {
    configPath = options.config;
  }
  const configDevPath = path.join(__dirname, 'config.dev.json');

  void config.fetch(configPath, configDevPath, options).then(() => {
    console.log("Kai server initializing");
    void server.start().then(() => {
      // noop
    });
  });
}

start();
