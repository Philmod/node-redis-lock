/**
 * Dependencies.
 */
var redis = require('redis')
  , uuid = require('node-uuid')
  , Scripto = require('redis-scripto')
  ;


/**
 * Lua scripts.
 */
var scriptRelease = '\
local key = KEYS[1] \
local value = KEYS[2] \
if redis.call("get",key) == value then \
  return redis.call("del",key) \
else \
  return 0 \
end \
';
var scriptRenew = '\
local key = KEYS[1] \
local value = KEYS[2] \
local ttl = KEYS[3] \
if redis.call("get",key) == value then \
  return redis.call("expire",key,ttl) \
else \
  return 0 \
end \
'
var scripts = {
    'script-release': scriptRelease
  , 'script-renew': scriptRenew
};


/**
 * Lock class.
 */
var Lock = function(options, client) {
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
    this.scriptManager = new Scripto(this.client);
    this.scriptManager.load(scripts);
  }
  //* *//

};

/**
 * Create key with namespace.
 */
Lock.prototype._createKey = function(key) {
  if (this.namespace)
    return this.namespace + ':' + key;
  else
    return key;
}

/**
 * Expire a key.
 */
Lock.prototype._expire = function(key, timeout, callback) {
  var res = this.client.expire(key, timeout);
  if (res === true)
    callback(null, true);
  else // Transform a false into an error.
    callback(new Error('Error while expiring the key : ', key));
}

/**
 * Lock.
 */
Lock.prototype.acquire = function(key, timeout, value, callback) {
  var self = this;
  if (typeof value === 'function') {
    callback = value;
    value = self.value;
  }
  key = self._createKey(key);

  // Save the value in the module.
  self.value = value;
  
  self.client.setnx(key, value, function(e, r) {
    if (e) return callback(e);
    if (r===0) return callback(new Error('Locked.'));
    self._expire(key, timeout, callback);
  });
};

/**
 * Renew.
 */
Lock.prototype.renew = function(key, timeout, value, callback) {
  var self = this;
  if (typeof value === 'function') {
    callback = value;
    value = self.value;
  }
  key = self._createKey(key);

  self.scriptManager.run('script-renew', [key, value, timeout], [], function(e, res) {
    if (e)
      return callback(e);
    if (res === 0)
      return callback(new Error('This key is locked with another value.'));
    else 
      callback(e, true);
  });

};

/**
 * Release.
 */
Lock.prototype.release = function(key, value, callback) {
  var self = this;
  if (typeof value === 'function') {
    callback = value;
    value = self.value;
  }
  key = this._createKey(key);
  
  self.scriptManager.run('script-release', [key, value], [], function(e, res) {
    if (e)
      return callback(e);
    if (res === 0)
      return callback(new Error('This key is locked with another value.'));
    else 
      callback(e, true);
  });
};

/**
 * Is lock?
 */
Lock.prototype.isLocked = function(key, callback) {
  key = this._createKey(key);
  this.client.get(key, callback);
};

/**
 * Quit redis client.
 */
Lock.prototype.quit = function() {
  this.client.quit();
};

/**
 * Export.
 */
module.exports = Lock;
