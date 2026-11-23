const assert = require('node:assert/strict');
const test = require('node:test');
const { DatabaseService } = require('../dist/database/database.service');
const { createApp } = require('../dist/main');

test('public leaderboard supports unauthenticated pagination and rank shape', async (t) => {
  const app = await createApp({ logger: false });
  t.after(() => app.close());
  const database = app.get(DatabaseService);
  database.query = async (query) => ({
    rows: query.includes('count(*)::text AS total') ? [{ total: '0' }] : [],
  });
  await app.listen(0, '127.0.0.1');

  const response = await fetch(
    `${await app.getUrl()}/api/v1/public/leaderboard?page=2&pageSize=10`,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    items: [],
    page: 2,
    pageSize: 10,
    total: 0,
    previousPage: 1,
    nextPage: null,
    myRank: null,
  });
});
