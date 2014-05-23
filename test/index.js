/**
 * Module dependencies.
 */

var Lock   = require('../')
  , redis  = require('redis')
  , redisClient = redis.createClient()
  , should = require('should')
  , assert = require('assert')
  , async  = require('async')
  ;

/**
 * Variables.
 */
var key1 = 'job1'
  , value1 = 'host1'
  , key2 = 'job2'
  , value2 = 'host2'
  , namespace = 'superworkers'
  ;

/**
 * Clear Redis.
 */
var clearRedis = function(callback) {
  async.parallel([
    function(cb) { // Remove everything under the namespace
      redisClient.keys(namespace + '*', function(e, keys) {
        if (e) return cb(e);
        async.each(keys, function(key, cbeach) {
          redisClient.del(key,cbeach);
        }, cb);
      });
    },
    function(cb) { // Remove key1
      redisClient.del(key1, cb);
    },
    function(cb) { // Remove key2
      redisClient.del(key2, cb);
    },
  ], callback);
  
};

/**
 * Tests
 */
describe('Lock', function() {

  describe('Connect to Redis', function() {

    var lock;

    afterEach(function() {
      lock.quit();
    });

    it('shoud connect to local Redis', function(done) {
      lock = new Lock();
      lock.should.have.property('client');
      lock.client.should.have.property('stream');
      done();
    });

    it('shoud connect to Redis defined by host/port', function(done) {
      lock = new Lock({
          port: 6379
        , host: 'localhost'
      });
      lock.should.have.property('client');
      lock.client.should.have.property('stream');
      done();
    });

    it('shoud connect to a passed Redis', function(done) {
      var client = new redis.createClient();
      lock = new Lock({}, client);
      lock.should.have.property('client');
      lock.client.should.have.property('stream');
      done();
    });

  });

  describe('#acquire()', function() {

    var lock;

    beforeEach(function(done) {
      clearRedis(done);
    });

    beforeEach(function() {
      lock = new Lock();
    });

    afterEach(function() {
      lock.quit();
    });

    it('successfully acquires a new lock', function(done) {
      lock.acquire(key1, 1, value1, function(e, res) {
        should.not.exist(e);
        res.should.be.true;

        // Check Redis.
        async.parallel({
          checkValue: function(cb) {
            redisClient.get(key1, function(e, res) {
              should.not.exist(e);
              res.should.equal(value1);
              cb(e);
            });
          },
          checkTtl: function(cb) {
            redisClient.ttl(key1, function(e, res) {
              should.not.exist(e);
              res.should.equal(1);
              cb(e);
            });
          }
        }, done);

      });
    });

    it('successfully acquires a new lock with namespace', function(done) {
      lock = new Lock({namespace: namespace});
      lock.acquire(key1, 1, value1, function(e, res) {
        should.not.exist(e);
        res.should.be.true;

        // Check Redis.
        async.parallel({
          checkValue: function(cb) {
            redisClient.get(namespace + ':' + key1, function(e, res) {
              should.not.exist(e);
              res.should.equal(value1);
              cb(e);
            });
          },
          checkTtl: function(cb) {
            redisClient.ttl(namespace + ':' + key1, function(e, res) {
              should.not.exist(e);
              res.should.equal(1);
              cb(e);
            });
          }
        }, done);

      });
    });

    it('successfully acquires 2 new locks', function(done) {
      lock.acquire(key1, 1, value1, function(e, res) {
        should.not.exist(e);
        res.should.be.true;

        lock.acquire(key2, 1, value2, function(e, res) {
          should.not.exist(e);
          res.should.be.true;

          done();
        });
      });
    });

    it('fails acquiring a lock key', function(done) {
      lock.acquire(key1, 1, value1, function(e, res) {
        should.not.exist(e);
        res.should.be.true;

        lock.acquire(key1, 1, value2, function(e, res) {
          should.exist(e);
          done();
        });

      });
    });

    it('successfully acquires a new lock and release it after ttl', function(done) {
      var ttl = 1;
      lock.acquire(1, ttl, value1, function(e, res) {
        should.not.exist(e);
        res.should.be.true;

        setTimeout(function() {
          redisClient.get(key1, function(e, res) {
            should.not.exist(e);
            should.not.exist(res);
            done();
          });
        }, 1500);
        
      });
    });

  });

  describe('#renew()', function() {

    var lock;

    beforeEach(function(done) {
      clearRedis(done);
    });

    beforeEach(function() {
      lock = new Lock();
    });

    afterEach(function() {
      lock.quit();
    });

    it('successfully renew a new lock', function(done) {
      lock.acquire(key1, 2, value1, function(e, res) {
        should.not.exist(e);
        res.should.be.true;

        lock.renew(key1, 10, value1, function(e, res) {
          should.not.exist(e);
          res.should.be.true;

          // Check Redis.
          async.parallel({
            checkValue: function(cb) {
              redisClient.get(key1, function(e, res) {
                should.not.exist(e);
                res.should.equal(value1);
                cb(e);
              });
            },
            checkTtl: function(cb) {
              redisClient.ttl(key1, function(e, res) {
                should.not.exist(e);
                res.should.equal(10);
                cb(e);
              });
            }
          }, done);

        });

      });
    });

    it('fails renewing a lock with a different value', function(done) {
      lock.acquire(key1, 2, value1, function(e, res) {
        should.not.exist(e);
        res.should.be.true;

        lock.renew(key1, 10, value2, function(e, res) {
          should.exist(e);
          
          done();
        });

      });
    });

  });

  describe('#release()', function() {

    var lock;

    beforeEach(function(done) {
      clearRedis(done);
    });

    beforeEach(function() {
      lock = new Lock();
    });

    afterEach(function() {
      lock.quit();
    });

    it('successfully release a lock', function(done) {
      lock.acquire(key1, 2, value1, function(e, res) {
        should.not.exist(e);
        res.should.be.true;

        lock.release(key1, function(e, res) {
          should.not.exist(e);

          // Check Redis.
          async.parallel({
            checkValue: function(cb) {
              redisClient.get(key1, function(e, res) {
                should.not.exist(e);
                should.not.exist(res);
                cb(e);
              });
            },
            checkTtl: function(cb) {
              redisClient.ttl(key1, function(e, res) {
                should.not.exist(e);
                res.should.equal(-1);
                cb(e);
              });
            }
          }, done);

        });

      });
    });


  });

});
