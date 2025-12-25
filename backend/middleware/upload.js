const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const generateFilename = (originalname) => {
  const ext = path.extname(originalname);
  const randomId = crypto.randomBytes(16).toString('hex');
  return `${randomId}${ext}`;
};

const defaultStorage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, generateFilename(file.originalname));
  }
});

const challengeAttachmentStorage = multer.diskStorage({
  destination: 'uploads/challenges/',
  filename: (req, file, cb) => {
    cb(null, generateFilename(file.originalname));
  }
});

const defaultUpload = multer({
  storage: defaultStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^(image\/|application\/pdf)/.test(file.mimetype);
    cb(null, ok);
  }
});

const challengeAttachmentUpload = multer({
  storage: challengeAttachmentStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/zip',
      'application/x-zip-compressed',
      'text/plain',
      'text/csv',
      'application/json',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    const ok = allowedMimes.includes(file.mimetype);
    cb(null, ok);
  }
});

module.exports = defaultUpload;
module.exports.challengeAttachment = challengeAttachmentUpload;
