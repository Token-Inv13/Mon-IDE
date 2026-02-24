import React from 'react';
jest.setTimeout(20000);
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock Anthropic SDK to simulate agent responses
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => {
    return {
      messages: {
        create: jest.fn().mockImplementation(() => {
          // First call: return a tool_use asking to list files
          if (!global.__anthropic_called) {
            global.__anthropic_called = 1;
            return Promise.resolve({
              content: [
                { type: 'tool_use', name: 'list_files', input: { path: '.' }, id: 't1' }
              ],
              stop_reason: 'tool_use'
            });
          }
          // Second call: end the task
          return Promise.resolve({ content: [{ type: 'text', text: 'Terminé' }], stop_reason: 'end_turn' });
        })
      }
    };
  });
});

// Require Agent after mocking Anthropic
const Agent = require('../components/Agent').default;

describe('Agent integration (mocked)', () => {
  beforeEach(() => {
    global.__anthropic_called = 0;
    // Mock window.electron
    global.window = global.window || {};
    global.window.electron = {
      readDirectory: jest.fn().mockResolvedValue([{ name: 'file1.txt', path: './file1.txt', isDirectory: false }]),
      readFile: jest.fn().mockResolvedValue('content'),
      writeFile: jest.fn().mockResolvedValue(true),
      terminalInput: jest.fn(),
    };
    // jsdom does not implement scrollIntoView — stub it to avoid errors
    if (typeof window.HTMLElement !== 'undefined' && !window.HTMLElement.prototype.scrollIntoView) {
      window.HTMLElement.prototype.scrollIntoView = () => {};
    }
  });

  test('Agent runs and executes list_files tool', async () => {
    render(<Agent projectPath="." apiKey="test-key" onFileUpdate={() => {}} activeFile={null} />);

    // Enter a short task into the textarea
    const textarea = screen.getByPlaceholderText(/Décris la tâche/);
    await userEvent.type(textarea, 'Liste les fichiers du projet');

    const button = screen.getByRole('button', { name: /Lancer l'agent|Agent en cours/i });
    await userEvent.click(button);

    // Wait for the success log to appear
    await waitFor(() => expect(screen.queryAllByText(/Tâche terminée|Terminé|Agent terminé/).length).toBeGreaterThan(0), { timeout: 5000 });
  });
});
