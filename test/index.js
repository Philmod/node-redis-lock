"use strict";

/**
 * Module dependencies.
 */
const Lock = require('../');
const redis = require('redis');
const redisClient = redis.createClient();
const should = require('should');
const assert = require('assert');
const async = require('async');

/**
 * Variables.
 */
const key1 = 'job1';
const value1 = 'host1';
const key2 = 'job2';
const value2 = 'host2';
const namespace = 'superworkers';

/**
 * Clear Redis.
 */
const clearRedis = (callback) => {
  async.parallel([
    (cb) => { // Remove everything under the namespace
      redisClient.keys(namespace + '*', (e, keys) => {
        if (e) return cb(e);
        async.each(keys, (key, cbeach) => {
          redisClient.del(key,cbeach);
        }, cb);
      });
    },
    (cb) => { // Remove key1
      redisClient.del(key1, cb);
    },
    (cb) => { // Remove key2
      redisClient.del(key2, cb);
    },
  ], callback);

};

/**
 * Tests
 */
describe('Lock', () => {

  describe('Connect to Redis', () => {

    let lock;

    afterEach(() => {
      lock.quit();
    });

    it('shoud connect to local Redis', (done) => {
      lock = new Lock();
      lock.should.have.property('client');
      lock.client.should.have.property('stream');
      done();
    });

    it('shoud connect to Redis defined by host/port', (done) => {
      lock = new Lock({
          port: 6379
        , host: 'localhost'
      });
      lock.should.have.property('client');
      lock.client.should.have.property('stream');
      done();
    });

    it('shoud connect to a passed Redis', (done) => {
      const client = new redis.createClient();
      lock = new Lock({}, client);
      lock.should.have.property('client');
      lock.client.should.have.property('stream');
      done();
    });

  });

  describe('#acquire()', () => {

    let lock;

    beforeEach((done) => {
      clearRedis(done);
    });

    beforeEach(() => {
      lock = new Lock();
    });

    afterEach(() => {
      lock.quit();
    });

    it('successfully acquires a new lock', (done) => {
      lock.acquire(key1, 1, value1, (e, res) => {
        should.not.exist(e);
        res.should.be.true;

        // Check Redis.
        async.parallel({
          checkValue: (cb) => {
            redisClient.get(key1, (e, res) => {
              should.not.exist(e);
              res.should.equal(value1);
              cb(e);
            });
          },
          checkTtl: (cb) => {
            redisClient.ttl(key1, (e, res) => {
              should.not.exist(e);
              res.should.equal(1);
              cb(e);
            });
          }
        }, done);

      });
    });

    it('successfully acquires a new lock without passing a value', (done) => {
      lock.acquire(key1, 1, (e, res) => {
        should.not.exist(e);
        res.should.be.true;

        // Check Redis.
        async.parallel({
          checkValue: (cb) => {
            redisClient.get(key1, (e, res) => {
              should.not.exist(e);
              res.should.equal(lock.value);
              cb(e);
            });
          },
          checkTtl: (cb) => {
            redisClient.ttl(key1, (e, res) => {
              should.not.exist(e);
              res.should.equal(1);
              cb(e);
            });
          }
        }, done);

      });
    });

    it('successfully acquires a new lock with namespace', (done) => {
      lock = new Lock({namespace: namespace});
      lock.acquire(key1, 1, value1, (e, res) => {
        should.not.exist(e);
        res.should.be.true;

        // Check Redis.
        async.parallel({
          checkValue: (cb) => {
            redisClient.get(namespace + ':' + key1, (e, res) => {
              should.not.exist(e);
              res.should.equal(value1);
              cb(e);
            });
          },
          checkTtl: (cb) => {
            redisClient.ttl(namespace + ':' + key1, (e, res) => {
              should.not.exist(e);
              res.should.equal(1);
              cb(e);
            });
          }
        }, done);

      });
    });

    it('successfully acquires 2 new locks', (done) => {
      lock.acquire(key1, 1, value1, (e, res) => {
        should.not.exist(e);
        res.should.be.true;

        lock.acquire(key2, 1, value2, (e, res) => {
          should.not.exist(e);
          res.should.be.true;

          done();
        });
      });
    });

    it('fails acquiring a lock key', (done) => {
      lock.acquire(key1, 1, value1, (e, res) => {
        should.not.exist(e);
        res.should.be.true;

        lock.acquire(key1, 1, value2, (e, res) => {
          should.exist(e);
          done();
        });

      });
    });

    it('successfully acquires a new lock and release it after ttl', (done) => {
      const ttl = 1;
      lock.acquire(1, ttl, value1, (e, res) => {
        should.not.exist(e);
        res.should.be.true;

        setTimeout(() => {
          redisClient.get(key1, (e, res) => {
            should.not.exist(e);
            should.not.exist(res);
            done();
          });
        }, 1500);

      });
    });

    it('fails acquiring a locked key without a value', (done) => {
      const lock2 = new Lock();

      lock.acquire(key1, 1, (e, res) => {
        should.not.exist(e);
        res.should.be.true;

        lock2.acquire(key1, 1, (e, res) => {
          should.exist(e);
          lock2.quit();
          done();
        });

      });
    });

  });

  describe('#renew()', () => {

    let lock;

    beforeEach((done) => {
      clearRedis(done);
    });

    beforeEach(() => {
      lock = new Lock();
    });

    afterEach(() => {
      lock.quit();
    });

    it('successfully renew a new lock', (done) => {
      lock.acquire(key1, 2, value1, (e, res) => {
        should.not.exist(e);
        res.should.be.true;

        lock.renew(key1, 10, value1, (e, res) => {
          should.not.exist(e);
          res.should.be.true;

          // Check Redis.
          async.parallel({
            checkValue: (cb) => {
              redisClient.get(key1, (e, res) => {
                should.not.exist(e);
                res.should.equal(value1);
                cb(e);
              });
            },
            checkTtl: (cb) => {
              redisClient.ttl(key1, (e, res) => {
                should.not.exist(e);
                res.should.equal(10);
                cb(e);
              });
            }
          }, done);

        });

      });
    });

    it('successfully renew a new lock without a value', (done) => {
      lock.acquire(key1, 2, (e, res) => {
        should.not.exist(e);
        res.should.be.true;

        lock.renew(key1, 10, (e, res) => {
          should.not.exist(e);
          res.should.be.true;

          // Check Redis.
          async.parallel({
            checkValue: (cb) => {
              redisClient.get(key1, (e, res) => {
                should.not.exist(e);
                res.should.equal(lock.value);
                cb(e);
              });
            },
            checkTtl: (cb) => {
              redisClient.ttl(key1, (e, res) => {
                should.not.exist(e);
                res.should.equal(10);
                cb(e);
              });
            }
          }, done);

        });

      });
    });

    it('fails renewing a lock with a different value', (done) => {
      lock.acquire(key1, 2, value1, (e, res) => {
        should.not.exist(e);
        res.should.be.true;

        lock.renew(key1, 10, value2, (e, res) => {
          should.exist(e);

          done();
        });

      });
    });

  });

  describe('#release()', () => {

    let lock;

    beforeEach((done) => {
      clearRedis(done);
    });

    beforeEach(() => {
      lock = new Lock();
    });

    afterEach(() => {
      lock.quit();
    });

    it('fails releasing a lock without the good value', (done) => {
      lock.acquire(key1, 2, value1, (e, res) => {
        should.not.exist(e);
        res.should.be.true;

        lock.release(key1, 'whatever', (e, res) => {
          should.exist(e);
          done();
        });

      });
    });

    it('successfully release a lock', (done) => {
      lock.acquire(key1, 2, value1, (e, res) => {
        should.not.exist(e);
        res.should.be.true;

        lock.release(key1, value1, (e, res) => {
          should.not.exist(e);

          // Check Redis.
          async.parallel({
            checkValue: (cb) => {
              redisClient.get(key1, (e, res) => {
                should.not.exist(e);
                should.not.exist(res);
                cb(e);
              });
            },
            checkTtl: (cb) => {
              redisClient.ttl(key1, (e, res) => {
                should.not.exist(e);
                res.should.below(0);
                cb(e);
              });
            }
          }, done);

        });

      });
    });

    it('successfully release a lock without a value', (done) => {
      lock.acquire(key1, 2, (e, res) => {
        should.not.exist(e);
        res.should.be.true;

        lock.release(key1, (e, res) => {
          should.not.exist(e);
          done();
        });

      });
    });


  });

describe('#isLocked()', () => {

    let lock;

    beforeEach((done) => {
      clearRedis(done);
    });

    beforeEach(() => {
      lock = new Lock();
    });

    afterEach(() => {
      lock.quit();
    });

    it('successfully check that a lock doesn\'t exist', (done) => {
      lock.isLocked(key1, (e, res) => {
        should.not.exist(e);
        should.not.exist(res);
        done();

      });
    });

    it('successfully check that a lock exists', (done) => {
      lock.acquire(key1, 2, value1, (e, res) => {
        lock.isLocked(key1, (e, res) => {
          should.not.exist(e);
          res.should.equal(value1);
          done();
        });
      });
    });


  });

});
