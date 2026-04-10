const express = require('express');
const { createChat, getChats } = require('../controllers/chatController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/api/chat', requireAuth, createChat);
router.get('/api/chat', requireAuth, getChats);

module.exports = router;
