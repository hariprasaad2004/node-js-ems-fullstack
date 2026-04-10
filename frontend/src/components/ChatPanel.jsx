import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchMessages, fetchThreads, sendChatMessage } from '../api/chat.js';
import { createSocket } from '../api/socket.js';

const defaultThread = { threadKey: 'group:general', type: 'group', label: 'All Hands' };

const makeDirectKey = (a, b) => `direct:${[a, b].map((id) => id?.toString?.() || '').sort().join(':')}`;
const getOtherFromKey = (threadKey, selfId) => {
  if (!threadKey?.startsWith('direct:')) return null;
  const parts = threadKey.replace('direct:', '').split(':');
  const self = selfId?.toString?.() || '';
  return parts.find((part) => part && part !== self) || null;
};

const formatClock = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const initials = (name = '') => {
  const cleaned = name.trim();
  if (!cleaned) return '?';
  const parts = cleaned.split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return cleaned.slice(0, 2).toUpperCase();
};

const normalizeThreads = (threads = []) => {
  const cleaned = threads.map((thread) => ({
    ...thread,
    label:
      thread.label ||
      thread.name ||
      (thread.type === 'group'
        ? 'All Hands'
        : thread.user?.name || thread.user?.email || 'Direct chat')
  }));
  const hasGroup = cleaned.some((t) => t.threadKey === defaultThread.threadKey);
  const groupThread = hasGroup
    ? cleaned.find((t) => t.threadKey === defaultThread.threadKey)
    : { ...defaultThread };
  const rest = cleaned.filter((t) => t.threadKey !== defaultThread.threadKey);
  return [groupThread, ...rest];
};

export default function ChatPanel({ title = 'Team Chat' }) {
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState([defaultThread]);
  const [peers, setPeers] = useState([]);
  const [activeKey, setActiveKey] = useState(defaultThread.threadKey);
  const [messages, setMessages] = useState({});
  const [input, setInput] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [unread, setUnread] = useState({});
  const socketRef = useRef(null);
  const scrollRef = useRef(null);
  const openRef = useRef(false);
  const activeRef = useRef(defaultThread.threadKey);

  const totalUnread = useMemo(
    () => Object.values(unread).reduce((sum, value) => sum + (value || 0), 0),
    [unread]
  );

  useEffect(() => {
    loadInitial();
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    activeRef.current = activeKey;
  }, [activeKey]);

  useEffect(() => {
    if (!open || !activeKey) return;
    setUnread((prev) => ({ ...prev, [activeKey]: 0 }));
  }, [open, activeKey]);

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, open, activeKey]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  async function loadInitial() {
    const { res, data } = await fetchThreads();
    if (!res.ok) {
      setError(data?.message || 'Chat service unavailable.');
      return;
    }
    const list = normalizeThreads(data?.threads || []);
    setThreads(list);
    setPeers(data?.peers || []);
    setMe(data?.me || null);

    const initialKey = list[0]?.threadKey || defaultThread.threadKey;
    setActiveKey(initialKey);
    ensureSocket(data?.me?.id, list.map((t) => t.threadKey));
    await loadMessages(initialKey);
    socketRef.current?.emit('chat:join', list.map((t) => t.threadKey));
  }

  function ensureSocket(userId, threadKeys = []) {
    if (socketRef.current || !userId) return;
    const socket = createSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('chat:register', userId);
      socket.emit('chat:join', threadKeys);
    });

    socket.on('chat:message', (payload) => {
      if (!payload?.threadKey) return;
      setThreads((prev) => {
        const exists = prev.some((t) => t.threadKey === payload.threadKey);
        if (exists) {
          return prev.map((t) =>
            t.threadKey === payload.threadKey ? { ...t, lastMessage: payload } : t
          );
        }
        const otherId = getOtherFromKey(payload.threadKey, userId);
        const peer = peers.find((p) => p.id === otherId);
        const freshThread = {
          threadKey: payload.threadKey,
          type: payload.type || 'direct',
          user: peer || payload.participants?.find((p) => p.id === otherId)
        };
        return [...prev, freshThread];
      });

      appendMessage(payload.threadKey, payload);

      if (!(openRef.current && activeRef.current === payload.threadKey)) {
        setUnread((prev) => ({
          ...prev,
          [payload.threadKey]: (prev[payload.threadKey] || 0) + 1
        }));
        setToast(`New message from ${payload.sender?.name || 'colleague'}`);
      }
    });
  }

  async function loadMessages(threadKey) {
    if (!threadKey) return;
    setLoading(true);
    const { res, data } = await fetchMessages(threadKey);
    setLoading(false);
    if (!res.ok) {
      setError(data?.message || 'Failed to load messages.');
      return;
    }
    setMessages((prev) => ({ ...prev, [threadKey]: Array.isArray(data) ? data : [] }));
  }

  const appendMessage = (threadKey, message) => {
    setMessages((prev) => {
      const list = prev[threadKey] ? [...prev[threadKey]] : [];
      if (!list.find((item) => item.id === message.id)) {
        list.push(message);
      }
      return { ...prev, [threadKey]: list };
    });
  };

  const handleThreadSelect = async (threadKey) => {
    setActiveKey(threadKey);
    setUnread((prev) => ({ ...prev, [threadKey]: 0 }));
    if (!messages[threadKey]) {
      await loadMessages(threadKey);
    }
    socketRef.current?.emit('chat:join', [threadKey]);
  };

  const handleStartDirect = async () => {
    if (!targetUserId || !me?.id) return;
    const newKey = makeDirectKey(me.id, targetUserId);
    const peer = peers.find((p) => p.id === targetUserId);
    setThreads((prev) => {
      if (prev.some((t) => t.threadKey === newKey)) return prev;
      return [...prev, { threadKey: newKey, type: 'direct', user: peer }];
    });
    setActiveKey(newKey);
    socketRef.current?.emit('chat:join', [newKey]);
    await loadMessages(newKey);
  };

  const handleSend = async (event) => {
    event?.preventDefault?.();
    if (!input.trim()) return;
    const currentThread =
      threads.find((thread) => thread.threadKey === activeKey) || defaultThread;

    const payload = { text: input.trim(), threadKey: currentThread.threadKey };
    if (currentThread.type === 'direct') {
      const otherId =
        currentThread.user?.id || getOtherFromKey(currentThread.threadKey, me?.id) || targetUserId;
      if (otherId) payload.toUserId = otherId;
    }

    setSending(true);
    const { res, data } = await sendChatMessage(payload);
    setSending(false);
    if (!res.ok) {
      setError(data?.message || 'Failed to send message.');
      return;
    }
    setInput('');
    setError('');
    appendMessage(data.threadKey, data);
    setThreads((prev) =>
      prev.map((thread) =>
        thread.threadKey === data.threadKey ? { ...thread, lastMessage: data } : thread
      )
    );
  };

  const activeMessages = messages[activeKey] || [];
  const activeThread = threads.find((thread) => thread.threadKey === activeKey) || defaultThread;
  const activeTitle =
    activeThread.label || activeThread.name ||
    (activeThread.type === 'group' ? 'All Hands' : activeThread.user?.name || 'Direct chat');

  return (
    <>
      <button
        type="button"
        className={`chat-launcher ${open ? 'open' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Open chat"
      >
        <span className="chat-icon">Chat</span>
        {totalUnread ? <span className="chat-badge">{totalUnread}</span> : null}
      </button>

      <div className={`chat-panel ${open ? 'open' : ''}`}>
        <header className="chat-header">
          <div>
            <p className="chat-kicker">{title}</p>
            <h3 className="chat-title">{activeTitle}</h3>
          </div>
          <button type="button" className="chat-close" onClick={() => setOpen(false)}>
            x
          </button>
        </header>

        <div className="chat-body">
          <aside className="chat-sidebar">
            <div className="chat-start">
              <label htmlFor="chat-peer">Start personal chat</label>
              <div className="chat-start-row">
                <select
                  id="chat-peer"
                  value={targetUserId}
                  onChange={(event) => setTargetUserId(event.target.value)}
                >
                  <option value="">Select colleague</option>
                  {peers.map((peer) => (
                    <option key={peer.id} value={peer.id}>
                      {peer.name} - {peer.role}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn-ghost" onClick={handleStartDirect}>
                  Message
                </button>
              </div>
            </div>

            <div className="chat-thread-list">
              {threads.map((thread) => {
                const unreadCount = unread[thread.threadKey] || 0;
                const snippet = thread.lastMessage?.text || '';
                const time = thread.lastMessage?.createdAt;
                return (
                  <button
                    key={thread.threadKey}
                    type="button"
                    className={`chat-thread ${
                      activeKey === thread.threadKey ? 'active' : ''
                    }`}
                    onClick={() => handleThreadSelect(thread.threadKey)}
                  >
                    <div className="chat-thread-avatar">
                      <span>{initials(thread.type === 'group' ? 'All Hands' : thread.user?.name)}</span>
                    </div>
                    <div className="chat-thread-meta">
                      <div className="chat-thread-row">
                        <strong>{
                          thread.type === 'group'
                            ? 'All Hands'
                            : thread.user?.name || 'Direct chat'
                        }</strong>
                        <span className="chat-thread-time">{formatClock(time)}</span>
                      </div>
                      <div className="chat-thread-row">
                        <p className="chat-thread-snippet">{snippet || 'No messages yet'}</p>
                        {unreadCount ? <span className="chat-pill">{unreadCount}</span> : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="chat-main">
            {error ? <div className="chat-error">{error}</div> : null}
            <div className="chat-messages" ref={scrollRef}>
              {loading ? <div className="chat-muted">Loading messages...</div> : null}
              {!loading && activeMessages.length === 0 ? (
                <div className="chat-muted">Say hello to kick off this chat.</div>
              ) : null}
              {activeMessages.map((message) => {
                const mine = me && message.sender?.id === me.id;
                return (
                  <div
                    key={message.id}
                    className={`chat-bubble ${mine ? 'mine' : ''}`}
                    aria-label={`Message from ${message.sender?.name || 'user'}`}
                  >
                    <div className="chat-bubble-head">
                      <span className="chat-bubble-name">
                        {message.sender?.name || 'User'}{' '}
                        <small>{message.sender?.role}</small>
                      </span>
                      <span className="chat-bubble-time">{formatClock(message.createdAt)}</span>
                    </div>
                    <p className="chat-bubble-text">{message.text}</p>
                  </div>
                );
              })}
            </div>

            <form className="chat-input" onSubmit={handleSend}>
              <input
                type="text"
                placeholder="Write a message"
                value={input}
                onChange={(event) => setInput(event.target.value)}
              />
              <button type="submit" className="btn-primary" disabled={sending}>
                {sending ? 'Sending...' : 'Send'}
              </button>
            </form>
            <p className="chat-footnote">
              Group chat lives in All Hands. Personal chats stay between you and your teammate.
            </p>
          </section>
        </div>

        {toast ? <div className="chat-toast">{toast}</div> : null}
      </div>
    </>
  );
}
