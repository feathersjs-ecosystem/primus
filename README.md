# @feathersjs/primus

> __Important:__ The code for this module has been moved into the main Feathers repository at [feathersjs/feathers](https://github.com/feathersjs/feathers) ([package direct link](https://github.com/feathersjs/feathers/tree/master/packages/socketio)). Please open issues and pull requests there.

[![Build Status](https://travis-ci.org/feathersjs/primus.png?branch=master)](https://travis-ci.org/feathersjs/primus)

The Feathers Primus real-time API provider

## Installation

```
npm install @feathersjs/primus --save
```

## Quick example

```js
const feathers = require('@feathersjs/feathers');
const primus = require('@feathersjs/primus');

const app = feathers();

// Set up Primus with SockJS
app.configure(primus({ transformer: 'ws' }));

app.listen(3030);
```

## Documentation

Please refer to the [@feathersjs/primus documentation](https://docs.feathersjs.com/api/primus.html) for more details.

## License

Copyright (c) 2018

Licensed under the [MIT license](LICENSE).
