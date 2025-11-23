const multer = require('multer');

// Used to upload the excel sheet files
module.exports = multer({
  dest: 'uploads/',                       
  limits: { fileSize: 5 * 1024 * 1024 },  
  fileFilter: (req, file, cb) => {
   
    const ok = file.mimetype.startsWith("image/") || file.mimetype === "application/pdf";
    cb(null, ok);
  },
});
