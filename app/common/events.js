'use strict';

const { EventEmitter } = require('emiketic-starter-lib/dist/common/events');

const EVENT = new EventEmitter();

EVENT.EventEmitter = EventEmitter;

module.exports = EVENT;
