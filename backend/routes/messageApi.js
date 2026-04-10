const express = require('express');
const { getMessages, sendMessage } = require('../controllers/messageController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/api/messages/:chatId', requireAuth, getMessages);
router.post('/api/messages', requireAuth, sendMessage);

module.exports = router;
