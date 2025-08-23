const fs = require('fs').promises;
const path = require('path');

async function cleanTrash({ trashDir, maxAgeDays = 30, dryRun = false } = {}) {
  if (!trashDir) throw new Error('trashDir required');

  const deletions = [];
  const errors = [];

  try {
    // ensure directory exists
    await fs.mkdir(trashDir, { recursive: true });
    const entries = await fs.readdir(trashDir);

    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;
    for (const name of entries) {
      const filePath = path.join(trashDir, name);
      try {
        const st = await fs.lstat(filePath);
        if (st.isDirectory()) continue; // skip directories
        const ageDays = (now - st.mtimeMs) / msPerDay;
        if (ageDays >= maxAgeDays) {
          if (!dryRun) {
            await fs.unlink(filePath);
          }
          deletions.push({ file: name, ageDays: Number(ageDays.toFixed(2)) });
        }
      } catch (err) {
        errors.push({ file: name, error: err.message });
      }
    }
  } catch (err) {
    errors.push({ error: err.message });
  }

  return { deleted: deletions, errors };
}

module.exports = { cleanTrash };