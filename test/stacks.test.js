const test = require('node:test');
const assert = require('node:assert');
const { splitName } = require('../src/stacks');

test('splits known stack suffixes off the name', () => {
  assert.deepStrictEqual(splitName('caloraix-nextjs-expo-nestjs'), {
    name: 'caloraix',
    tokens: ['nextjs', 'expo', 'nestjs'],
  });
  assert.deepStrictEqual(splitName('reply_pilot-chrome-ext'), { name: 'reply_pilot', tokens: ['chrome-ext'] });
});

test('leaves names alone when a part is not a stack', () => {
  assert.deepStrictEqual(splitName('audio_cursor-browser-extention'), {
    name: 'audio_cursor-browser-extention',
    tokens: [],
  });
  assert.deepStrictEqual(splitName('cloud_track'), { name: 'cloud_track', tokens: [] });
});
