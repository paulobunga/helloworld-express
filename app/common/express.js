'use strict';

const Logger = require('@/common/logger').createLogger($filepath(__filename));

const express = require('express');
require('express-async-errors');

const glob = require('glob');
const path = require('path');

const CONFIG = require('@/common/config');

let app = null;
let http = null;

async function setup() {
  Logger.debug('initiating ...');

  app = express();

  // trust proxy
  app.enable('trust proxy');

  // Showing stack errors
  app.set('showStackError', true);

  // Enable logger (morgan)
  app.use(require('morgan')(process.env.LOGGER_FORMAT || 'dev'));

  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.header(
        'Access-Control-Allow-Headers',
        'DNT,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Authorization,X-Scope,X-Version,X-App-Id,X-App-Version,X-App-Platform',
      );

      if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
      }

      next();
    });
  }

  app.use(express.json({}));

  // Load routers

  glob.sync('app/**/router.js').forEach((filename) => {
    Logger.debug('loading', filename);
    const router = require(path.resolve(filename));
    app.use(router.prefix, router.router);
  });

  // Handle errors

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ message: err.message || 'Server error' });
  });

  app.use((req, res) => {
    res.status(404).send({
      message: 'Not found',
    });
  });

  http = app.listen(CONFIG.API_PORT);

  module.exports.app = app;

  module.exports.http = http;

  Logger.debug(`ready on port ${CONFIG.API_PORT}`);
}

async function teardown() {
  return new Promise((resolve, reject) => {
    Logger.debug('teardown ...');

    if (!http) {
      Logger.debug('teardown done.');
      resolve();
      return;
    }

    http.close((err) => {
      Logger.debug('teardown done.', err || '');

      app = null;
      http = null;

      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

module.exports = {
  setup,
  teardown,
  app,
  http,
};
