# node-redis-lock

  Node.js redis locking system.

## Installation

      $ npm install node-redis-lock

## Use

```js
var Lock = require('node-redis-lock');
var redis = require('redis');
var client = redis.createClient();

// Instantiate a lock.
var lock = new Lock({namespace: 'locking'}, client);

// Acquire a lock.
var key = 'job1';
var value = 'host1';
var ttl = 1; // seconds
lock.acquire(key, ttl, value, function(e, r) {
  // r === true;
});

// Renew a lock.
// It fails if the value is different.
lock.renew(key, ttl, value, function(e, r) {
  // r === true;
});

// Release a lock.
lock.release(key, function(e, r) {
  // 
});
```

## Tests

      $ npm test

## Author

Philmod &lt;philippe.modard@gmail.com&gt;
