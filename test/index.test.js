const feathers = require('@feathersjs/feathers');
const express = require('@feathersjs/express');
const assert = require('assert');
const request = require('request');
const _ = require('lodash');
const { Service } = require('feathers-commons/lib/test-fixture');

const primus = require('../lib');
const methodTests = require('./methods.js');
const eventTests = require('./events');

describe('@feathersjs/primus', () => {
  let options = {
    socketParams: {
      user: { name: 'David' },
      provider: 'primus'
    }
  };

  before(done => {
    const errorHook = function (hook) {
      if (hook.params.query.hookError) {
        throw new Error(`Error from ${hook.method}, ${hook.type} hook`);
      }
    };
    const app = options.app = feathers()
      .configure(primus({
        transformer: 'websockets'
      }, function (primus) {
        primus.authorize(function (req, done) {
          req.feathers.user = { name: 'David' };

          const { channel } = req.query;

          if (channel) {
            req.feathers.channel = channel;
          }

          done();
        });

        options.primus = primus;
        options.socket = new primus.Socket('http://localhost:7888');
      }))
      .use('todo', Service);

    app.service('todo').hooks({
      before: { get: errorHook }
    });

    options.server = app.listen(7888, function () {
      app.use('tasks', Service);
      app.service('tasks').hooks({
        before: { get: errorHook }
      });
      done();
    });
  });

  after(done => {
    options.socket.socket.close();
    options.server.close(done);
  });

  it('exports default and SOCKET_KEY', () => {
    assert.ok(primus.SOCKET_KEY);
    assert.equal(primus, primus.default);
  });

  it('is CommonJS compatible', () => {
    assert.equal(typeof require('../lib'), 'function');
  });

  it('throws an error when using an incompatible version of Feathers', () => {
    const oldFeathers = require('feathers');

    try {
      oldFeathers().configure(primus());
      assert.ok(false, 'Should never get here');
    } catch (e) {
      assert.equal(e.message, '@feathersjs/primus is not compatible with this version of Feathers. Use the latest at @feathersjs/feathers.');
    }
  });

  it('runs primus before setup (#131)', done => {
    let counter = 0;
    const app = feathers()
      .configure(primus({
        transformer: 'websockets'
      }, function () {
        assert.equal(counter, 0);
        counter++;
      }))
      .use('/todos', {
        find () {
          return Promise.resolve([]);
        },
        setup (app) {
          assert.ok(app.primus);
          assert.equal(counter, 1, 'Primus configuration ran first');
        }
      });

    const srv = app.listen(9119);
    srv.on('listening', () => srv.close(done));
  });

  it('expressified app works', done => {
    const data = { message: 'Hello world' };
    const app = express(feathers())
      .configure(primus({
        transformer: 'websockets'
      }))
      .use('/test', (req, res) => res.json(data));

    const srv = app.listen(8992).on('listening', () => {
      const url = 'http://localhost:8992/test';

      request({ url, json: true }, (err, res) => {
        assert.ok(!err);
        assert.deepEqual(res.body, data);
        srv.close(done);
      });
    });
  });

  it('Passes handshake as service parameters.', function (done) {
    const service = options.app.service('todo');
    const old = {
      find: service.find,
      create: service.create,
      update: service.update,
      remove: service.remove
    };

    service.find = function (params) {
      assert.deepEqual(_.omit(params, 'query', 'route', 'connection'), options.socketParams,
        'Handshake parameters passed on proper position');

      return old.find.apply(this, arguments);
    };

    service.create = function (data, params) {
      assert.deepEqual(_.omit(params, 'query', 'route', 'connection'), options.socketParams,
        'Passed handshake parameters');

      return old.create.apply(this, arguments);
    };

    service.update = function (id, data, params) {
      assert.deepEqual(params, _.extend({
        connection: options.socketParams,
        route: {},
        query: {
          test: 'param'
        }
      }, options.socketParams), 'Passed handshake parameters as query');

      return old.update.apply(this, arguments);
    };

    options.socket.send('create', 'todo', {}, {}, error => {
      assert.ok(!error);

      options.socket.send('update', 'todo', 1, {}, { test: 'param' }, () => {
        assert.ok(!error);
        _.extend(service, old);
        done();
      });
    });
  });

  it('Missing parameters in socket call works. (#88)', function (done) {
    const service = options.app.service('todo');
    const old = {
      find: service.find
    };

    service.find = function (params) {
      assert.deepEqual(_.omit(params, 'query', 'route', 'connection'), options.socketParams,
        'Handshake parameters passed on proper position');

      return old.find.apply(this, arguments);
    };

    options.socket.send('find', 'todo', function () {
      _.extend(service, old);
      done();
    });
  });

  describe('Service method calls', () => {
    describe('(\'method\', \'service\')  event format', () => {
      describe('Service', () => methodTests('todo', options));
      describe('Dynamic Service', () => methodTests('todo', options));
    });

    describe('(\'service::method\') legacy event format', () => {
      describe('Service', () => methodTests('tasks', options, true));
      describe('Dynamic Service', () => methodTests('tasks', options, true));
    });
  });

  describe('Service events', () => {
    describe('Service', () => eventTests('todo', options));
    describe('Dynamic Service', () => eventTests('tasks', options));
  });
});
