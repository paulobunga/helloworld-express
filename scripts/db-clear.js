'use strict';

if (process.env.NODE_ENV === 'production') {
  process.exit(0);
}

process.env.INSTANCE_ID = 'script';

require('@/common/init');

process.env.MIGRATE = 'drop';

const Logger = require('@/common/logger').createLogger($filepath(__filename));

const EVENT = require('@/common/events');

const Data = require('@/common/data');

(async () => {
  try {
    Logger.info('initiating ...');

    await Data.setup();

    Logger.info('processing ...');

    // do nothing since handled by MIGRATE

    Logger.info('done');
    process.exit(0);
  } catch (error) {
    Logger.error(error.message, JSON.stringify(error, null, 2), error.stack);
    process.exit(1);
  }
})();

EVENT.once('shutdown', async () => {
  await Data.teardown();
});
