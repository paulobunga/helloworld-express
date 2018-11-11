'use strict';

process.env.INSTANCE_ID = 'core';

require('@/common/init');

const Logger = require('@/common/logger').createLogger($filepath(__filename));

const glob = require('glob');
const path = require('path');

const EVENT = require('@/common/events');

const Data = require('@/common/data');
const Job = require('@/common/job');

(async () => {
  try {
    Logger.debug('initiating ...');

    await Data.setup();
    await Job.setup();

    glob.sync('app/**/*.core.js').forEach((filename) => {
      Logger.debug('loading', filename);
      require(path.resolve(filename));
    });

    Logger.debug('ready');
    process.nextTick(() => EVENT.emit('core-ready'));
  } catch (error) {
    Logger.error(error.message, JSON.stringify(error, null, 2), error.stack);
    process.exit(1);
  }
})();

EVENT.once('shutdown', async () => {
  await Job.teardown();
  await Data.teardown();
});
