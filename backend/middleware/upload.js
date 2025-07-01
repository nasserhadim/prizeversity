const multer = require('multer');

module.exports = multer({
  dest: 'uploads/',                       
  limits: { fileSize: 5 * 1024 * 1024 },  
  fileFilter: (req, file, cb) => {
   
    const ok = /^(image\/|application\/pdf)/.test(file.mimetype);
    cb(null, ok);
  },
});
