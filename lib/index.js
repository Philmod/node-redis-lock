"use strict";

/**
 * Dependencies.
 */
const redis = require('redis');
const uuid = require('uuid');
const Scripto = require('redis-scripto');

/**
 * Lua scripts.
 */
const scriptAcquire = '\
local key = KEYS[1] \
local value = KEYS[2] \
local ttl = KEYS[3] \
local lockSet = redis.call("setnx", key, value) \
if lockSet == 1 then \
  redis.call("expire", key, ttl) \
end \
return lockSet \
';
const scriptRelease = '\
local key = KEYS[1] \
local value = KEYS[2] \
if redis.call("get",key) == value then \
  return redis.call("del",key) \
else \
  return 0 \
end \
';
const scriptRenew = '\
local key = KEYS[1] \
local value = KEYS[2] \
local ttl = KEYS[3] \
if redis.call("get",key) == value then \
  return redis.call("expire",key,ttl) \
else \
  return 0 \
end \
'
const scripts = {
    'script-acquire': scriptAcquire
  , 'script-release': scriptRelease
  , 'script-renew': scriptRenew
};


/**
 * Lock class.
 */
class Lock {
  constructor(options, client) {
    if (!options) {
      options = {};
    }

    this.namespace = options.namespace;
    this.value = uuid.v4();

    /**
     * Redis client.
     */
    if (client)
      this.client = client;
    else {
      this.port = options.port || 6379;
      this.host = options.host || '127.0.0.1';
      this.client = redis.createClient(this.port, this.host);
    }
    this.scriptManager = new Scripto(this.client);
    this.scriptManager.load(scripts);
    //* *//
  }

  /**
   * Create key with namespace.
   */
  _createKey(key) {
    if (this.namespace)
      return this.namespace + ':' + key;
    else
      return key;
  }

  /**
   * Expire a key.
   */
  _expire(key, timeout, callback) {
    let res = this.client.expire(key, timeout);
    if (res === true)
      callback(null, true);
    else // Transform a false into an error.
      callback(new Error('Error while expiring the key : ', key));
  }

  acquire(key, timeout, value, callback) {
    let self = this;
    if (typeof value === 'function') {
      callback = value;
      value = self.value;
    }
    key = self._createKey(key);

    // Save the value in the module.
    self.value = value;

    self.scriptManager.run('script-acquire', [key, value, timeout], [], (e, res) => {
      if (e)
        return callback(e);
      if (res === 0)
        return callback(new Error('Locked.'));
      else
        callback(e, true);
    });
  }

  renew(key, timeout, value, callback) {
    let self = this;
    if (typeof value === 'function') {
      callback = value;
      value = self.value;
    }
    key = self._createKey(key);

    self.scriptManager.run('script-renew', [key, value, timeout], [], (e, res) => {
      if (e)
        return callback(e);
      if (res === 0)
        return callback(new Error('This key is locked with another value.'));
      else
        callback(e, true);
    });

  }

  release(key, value, callback) {
    let self = this;
    if (typeof value === 'function') {
      callback = value;
      value = self.value;
    }
    key = this._createKey(key);

    self.scriptManager.run('script-release', [key, value], [], (e, res) => {
      if (e)
        return callback(e);
      if (res === 0)
        return callback(new Error('This key is locked with another value.'));
      else
        callback(e, true);
    });
  }

  isLocked(key, callback) {
    key = this._createKey(key);
    this.client.get(key, callback);
  }

  /**
   * Quit redis client.
   */
  quit() {
    this.client.quit();
  }
}

module.exports = Lock;
