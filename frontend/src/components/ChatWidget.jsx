import { useEffect, useMemo, useRef, useState } from 'react';
import { createSocket } from '../api/socket.js';
import { getChats, getMessages, sendMessage } from '../api/chat.js';

const fallbackChat = { id: null, isGroupChat: true, groupName: 'All Hands', users: [] };

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState({});
  const [text, setText] = useState('');
  const [typingUsers, setTypingUsers] = useState({});
  const socketRef = useRef(null);
  const userIdRef = useRef(null);
  const scrollRef = useRef(null);

  const activeMessages = messages[activeId] || [];
  const activeChat = chats.find((c) => c.id === activeId) || fallbackChat;

  useEffect(() => {
    loadChats();
    const socket = createSocket();
    socketRef.current = socket;

    socket.on('chat:message', (msg) => {
      setMessages((prev) => {
        const list = prev[msg.chatId] ? [...prev[msg.chatId]] : [];
        // Prevent duplicate messages if the sender receives their own message back from socket
        if (list.some(m => m._id === msg._id || (m.tempId && m.tempId === msg.tempId))) {
          return prev;
        }
        return { ...prev, [msg.chatId]: [...list, msg] };
      });
    });

    socket.on('chat:typing', ({ chatId, userId }) => {
      setTypingUsers((prev) => ({ ...prev, [chatId]: userId }));
    });
    socket.on('chat:stopTyping', ({ chatId }) => {
      setTypingUsers((prev) => ({ ...prev, [chatId]: null }));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open, activeId]);

  async function loadChats() {
    const { res, data } = await getChats();
    if (!res.ok) return;
    if (data?.me?.id) {
      userIdRef.current = data.me.id;
      socketRef.current?.emit('chat:register', data.me.id);
    }
    const list = Array.isArray(data?.chats) ? data.chats : [];
    setChats(list);
    const firstId = list[0]?.id || null;
    if (firstId) {
      setActiveId(firstId);
      await joinChat(firstId);
      await loadMessages(firstId);
    }
  }

  async function joinChat(chatId) {
    socketRef.current?.emit('chat:join', chatId);
  }

  async function loadMessages(chatId) {
    const { res, data } = await getMessages(chatId);
    if (!res.ok) return;
    setMessages((prev) => ({ ...prev, [chatId]: Array.isArray(data) ? data : [] }));
  }

  const handleSend = async (event) => {
    event?.preventDefault?.();
    if (!text.trim() || !activeId) return;

    const tempId = Date.now().toString();
    const payload = { chatId: activeId, content: text.trim(), tempId };
   
    // Optimistic Update
    const optimisticMsg = {
      ...payload,
      senderId: { _id: userIdRef.current, name: 'Me' },
      createdAt: new Date().toISOString(),
      isOptimistic: true
    };

    setText('');
    setMessages((prev) => ({
      ...prev,
      [activeId]: [...(prev[activeId] || []), optimisticMsg]
    }));

    // Send via API
    const { res, data } = await sendMessage(payload);
   
    if (res.ok) {
      // Replace optimistic message with real message from server
      setMessages((prev) => ({
        ...prev,
        [activeId]: prev[activeId].map(m => m.tempId === tempId ? data : m)
      }));
      socketRef.current?.emit('chat:send', data);
    }
  };

  const typingLabel = useMemo(() => {
    const userId = typingUsers[activeId];
    if (!userId || userId === userIdRef.current) return '';
    return 'Someone is typing...';
  }, [typingUsers, activeId]);

  const handleSelect = async (chatId) => {
    setActiveId(chatId);
    await joinChat(chatId);
    if (!messages[chatId]) await loadMessages(chatId);
  };

  return (
    <div className={`chat-widget ${open ? 'open' : ''}`}>
      <button type="button" className="chat-launcher" onClick={() => setOpen((p) => !p)}>
        💬 Chat
      </button>
      {open ? (
        <div className="chat-panel">
          <aside className="chat-list">
            {chats.length === 0 ? <div className="chat-sub">No chats yet</div> : null}
            {chats.map((chat) => (
              <button
                key={chat.id}
                type="button"
                className={`chat-list-item ${activeId === chat.id ? 'active' : ''}`}
                onClick={() => handleSelect(chat.id)}
              >
                <div className="chat-title">{chat.isGroupChat ? chat.groupName || 'Group' : 'Direct Chat'}</div>
                <div className="chat-sub">{chat.users?.map((u) => u.name).join(', ')}</div>
              </button>
            ))}
          </aside>
          <section className="chat-body">
            <header className="chat-header">
              <div>{activeChat.isGroupChat ? activeChat.groupName || 'Group' : 'Direct Chat'}</div>
            </header>
            <div className="chat-messages" ref={scrollRef}>
              {(activeMessages || []).map((msg) => {
                // Robust ID check: handles both populated object and flat ID string
                const senderId = msg.senderId?._id || msg.senderId?.id || msg.senderId;
                const isMine = senderId === userIdRef.current;

                return (
                  <div key={msg._id || msg.tempId || msg.createdAt} className={`bubble ${isMine ? 'mine' : ''}`}>
                    <div className="bubble-meta">
                      <span>{isMine ? 'Me' : (msg.senderId?.name || 'User')}</span>
                      <span>{new Date(msg.createdAt || Date.now()).toLocaleTimeString()}</span>
                    </div>
                    <div>{msg.content}</div>
                  </div>
                );
              })}
              {typingLabel ? <div className="typing">{typingLabel}</div> : null}
            </div>
            <form className="chat-input" onSubmit={handleSend}>
              <input
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  socketRef.current?.emit('chat:typing', activeId);
                }}
                onBlur={() => socketRef.current?.emit('chat:stopTyping', activeId)}
                placeholder="Message"
              />
              <button type="submit">Send</button>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
