import { describe, it, expect } from 'vitest';
import { safeFilename } from '../../src/main/core/file-operations';

describe('safeFilename', () => {
  it('should replace invalid characters', () => {
    expect(safeFilename('test:file*name?.txt')).toBe('test_file_name_.txt');
  });

  it('should collapse whitespace', () => {
    expect(safeFilename('test   file   name')).toBe('test file name');
  });

  it('should truncate long names', () => {
    const longName = 'a'.repeat(200);
    expect(safeFilename(longName).length).toBeLessThanOrEqual(140);
  });

  it('should handle empty string', () => {
    expect(safeFilename('')).toBe('');
  });

  it('should preserve normal filenames', () => {
    expect(safeFilename('normal_file-name.txt')).toBe('normal_file-name.txt');
  });
});
