import executeTool from '../utils/executeTool';

describe('executeTool util', () => {
  afterEach(() => {
    if (global.window && global.window.electron) delete global.window.electron;
  });

  test('read_file returns file content', async () => {
    global.window = global.window || {};
    global.window.electron = { readFile: jest.fn().mockResolvedValue('file-contents') };

    const res = await executeTool('read_file', { path: './f.txt' }, { addLog: () => {} });
    expect(res.success).toBe(true);
    expect(res.output).toContain('file-contents');
  });

  test('write_file validates input and writes', async () => {
    global.window = global.window || {};
    const writeMock = jest.fn().mockResolvedValue(true);
    global.window.electron = { writeFile: writeMock };

    const res = await executeTool('write_file', { path: './o.txt', content: 'abc' }, { addLog: () => {} });
    expect(res.success).toBe(true);
    expect(writeMock).toHaveBeenCalledWith('./o.txt', 'abc');
  });

  test('write_file validation fails when content missing', async () => {
    global.window = global.window || {};
    global.window.electron = { writeFile: jest.fn().mockResolvedValue(true) };

    const res = await executeTool('write_file', { path: './o.txt' }, { addLog: () => {} });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Validation error/);
  });
});
