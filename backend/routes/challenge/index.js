const express = require('express');
const router = express.Router();

const managementRoutes = require('./management');
const verificationRoutes = require('./verification');
const submissionRoutes = require('./submissions');
const specificRoutes = require('./specific');

router.use('/', managementRoutes);
router.use('/', verificationRoutes);
router.use('/', submissionRoutes);
router.use('/', specificRoutes);

module.exports = router;
