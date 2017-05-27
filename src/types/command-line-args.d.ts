declare namespace cliargs {
  interface OptionDefinition {
    name: string;
    alias?: string;
    type: any;
    multiple?: boolean;
    defaultOption?: boolean;
    description?: string;
  }

  function commmandLineArgs(optionDefinitions: OptionDefinition[]): any;
}

export = cliargs.commmandLineArgs;
