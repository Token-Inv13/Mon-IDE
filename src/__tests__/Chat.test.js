// Mock MessageRenderer (which imports ESM-only syntax highlighter)
jest.mock('../components/MessageRenderer', () => () => null);
const Chat = require('../components/Chat').default;

test('Chat module exports a component', () => {
  expect(Chat).toBeDefined();
});
