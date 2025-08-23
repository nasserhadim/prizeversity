export function formatExportFilename(displayName = 'user', label = 'export') {
  const name = (displayName || 'user')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-]/g, '');
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `${name}_${label}_${ts}`;
}

export default formatExportFilename;