/**
 * Dependencies.
 */
var redis = require('redis');


/**
 * Lock class.
 */
var Lock = function(options, client) {
  if (!options) {
    options = {};
  }

  this.namespace = options.namespace;

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
 * Lock.
 */
Lock.prototype.acquire = function(key, timeout, value, callback) {
  var self = this;
  if (typeof value === 'function') {
    callback = value;
    value = null;
  }
  key = self._createKey(key);

  self.client.setnx(key, value, function(e, r) {
    if (e) return callback(e);
    if (r===0) return callback(new Error('Locked.'));
    var res = self.client.expire(key, timeout);
    if (res === true)
      callback(null, true);
    else // Transform a false into an error.
      callback(new Error('Error while expiring the key : ', key));
  });
};

/**
 * Renew.
 */
Lock.prototype.renew = function(key, timeout, value, callback) {
  var self = this;
  if (typeof value === 'function') {
    callback = value;
    value = null;
  }
  key = self._createKey(key);

  // First check if it's locked with the same value (can be a host/ip).
  self.client.get(key, function(e, val) {
    if (e) return callback(e);
    if (val && val !== value)
      return callback(new Error('This key is locked with the value ', val));
    // The only issue would be here if it's locked by someone else.
    else {
      var multi = self.client.multi();
      multi.del(key);
      multi.setex(key, timeout, value);
      multi.exec(function(e, res) {
        if (e) callback(e);
        else callback(null, true);
      });
    }
  });

};

/**
 * Release.
 */
Lock.prototype.release = function(key, callback) {
  key = this._createKey(key);
  this.client.del(key, callback);
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
