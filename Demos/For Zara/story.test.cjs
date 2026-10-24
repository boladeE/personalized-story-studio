const test = require('node:test');
const assert = require('node:assert/strict');
const story = require('./story.js');
test('the story starts with its invitation and a stable normalized timeline', () => {
  const frame = story.locate(0);
  assert.equal(frame.index, 0);
  assert.equal(frame.local, 0);
  assert.equal(frame.progress, 0);
  assert.equal(story.chapters[0].id, 'invitation');
});
