const { sanitizePathSegment } = require('../services/cameraIngest');

describe('Storage Folder Organization & Path Sanitization', () => {
  test('sanitizePathSegment cleans illegal path characters and spaces', () => {
    expect(sanitizePathSegment("Boobalan's Studio & Lab")).toBe('Boobalans-Studio-Lab');
    expect(sanitizePathSegment('Canon EOS R5 (Cam #1)')).toBe('Canon-EOS-R5-Cam-1');
    expect(sanitizePathSegment('Sarah & David / Wedding: Highlights*?')).toBe('Sarah-David-Wedding-Highlights');
    expect(sanitizePathSegment('')).toBe('general');
    expect(sanitizePathSegment(null, 'default-folder')).toBe('default-folder');
  });

  test('groups photos in meaningful album folders without hash subfolders', () => {
    const studioSlug = sanitizePathSegment('Lumina Studios');
    const albumTitle = sanitizePathSegment('2026 Smith Wedding');
    const filename = 'IMG_0001.JPG';

    const objectKey = `${studioSlug}/Albums/${albumTitle}/${filename}`;
    expect(objectKey).toBe('Lumina-Studios/Albums/2026-Smith-Wedding/IMG_0001.JPG');
    expect(objectKey).not.toMatch(/[a-f0-9]{32,64}\/IMG_0001\.JPG/); // No digest subfolder!
  });

  test('groups unassigned camera photos in camera name and date folders', () => {
    const studioSlug = sanitizePathSegment('Lumina Studios');
    const cameraName = sanitizePathSegment('Sony A7 IV');
    const dateStr = '2026-09-24';
    const filename = 'DSC_0042.ARW';

    const objectKey = `${studioSlug}/Cameras/${cameraName}/${dateStr}/${filename}`;
    expect(objectKey).toBe('Lumina-Studios/Cameras/Sony-A7-IV/2026-09-24/DSC_0042.ARW');
  });
});
