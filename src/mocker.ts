#! usr/bin/env node
import * as minimist from 'minimist';

import { MockGenerator } from './mock-generator';

const args = minimist(process.argv.slice(2), {
  string: ['appDir', 'srcDir', 'exclude'],
  boolean: ['force', 'verbose', 'skipBarrel', 'refreshBarrel'],
  alias: { f: 'force', 'app-dir': 'appDir', 'src-dir': 'srcDir', 'skip-barrel': 'skipBarrel', 'refresh-barrel': 'refreshBarrel' }
});

const fileNames = args._;
new MockGenerator(fileNames, args).run();

