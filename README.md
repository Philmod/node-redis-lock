# node-redis-lock

  Node.js redis locking system.

## Installation

      $ npm install node-redis-lock

## Use

```js
const Lock = require('node-redis-lock');
const redis = require('redis');
const client = redis.createClient();

// Instantiate a lock.
let lock = new Lock({namespace: 'locking'}, client);

// Acquire a lock.
const key = 'job1';
const value = ['owned-by-',require('os').hostname()].join('');
const ttl = 1; // seconds
lock.acquire(key, ttl, value, (e, r) => {
  // r === true;
});

// Renew a lock.
// It fails if the value is different.
lock.renew(key, ttl, value, (e, r) => {
  // r === true;
});

// Release a lock.
//  The value has to be passed to ensure another host doesn't release it.
lock.release(key, value, (e, r) => {
  //
});

// Does a lock exist?
lock.isLocked(key, (e, r) => {
  // Lock if r exists (this is the value of the lock)
});
```

## Tests

      $ npm test

## Author

Philmod &lt;philippe.modard@gmail.com&gt;
