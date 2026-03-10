import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const BACKEND_URL = 'http://localhost:5000';

const AdminPanel = () => {
    const [conversations, setConversations] = useState([]);
    const [activeChat, setActiveChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputMsg, setInputMsg] = useState('');
    const [socket, setSocket] = useState(null);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        const fetchConversations = async () => {
            try {
                const res = await axios.get(`${BACKEND_URL}/chat/admin/conversations`);
                setConversations(res.data);
            } catch (err) {
                console.error(err);
            }
        };

        fetchConversations();

        const newSocket = io(BACKEND_URL);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            newSocket.emit('join_admin');
        });

        newSocket.on('chat_escalated', (data) => {
            // Re-fetch or update conversations list
            fetchConversations();
        });

        newSocket.on('chat_update', (data) => {
            fetchConversations();
        });

        newSocket.on('chat_resolved', (id) => {
            fetchConversations();
        });

        return () => newSocket.close();
    }, []);

    useEffect(() => {
        if (activeChat && socket) {
            socket.emit('join_conversation', activeChat._id);

            const fetchMessages = async () => {
                try {
                    const res = await axios.get(`${BACKEND_URL}/chat/${activeChat._id}`);
                    setMessages(res.data.messages);
                    // Wait, the status might have changed
                    setActiveChat(res.data.conversation);
                } catch (err) {
                    console.error(err);
                }
            };
            fetchMessages();

            const handleNewMessage = (msg) => {
                if (msg.conversationId === activeChat._id) {
                    setMessages(prev => [...prev, msg]);
                }
            };

            const handleStatusChange = (status) => {
                setActiveChat(prev => ({ ...prev, status }));
            };

            socket.on('new_message', handleNewMessage);
            socket.on('status_change', handleStatusChange);

            return () => {
                socket.off('new_message', handleNewMessage);
                socket.off('status_change', handleStatusChange);
            };
        }
    }, [activeChat, socket]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const selectChat = (conv) => {
        setActiveChat(conv);
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!inputMsg.trim() || !activeChat) return;

        try {
            const payload = {
                conversationId: activeChat._id,
                sender: 'agent',
                message: inputMsg
            };

            setInputMsg('');
            await axios.post(`${BACKEND_URL}/chat/message`, payload);
        } catch (err) {
            console.error(err);
        }
    };

    const resolveChat = async () => {
        if (!activeChat) return;
        try {
            await axios.put(`${BACKEND_URL}/chat/${activeChat._id}/resolve`);
        } catch (err) {
            console.error(err);
        }
    }

    return (
        <div className="admin-grid container h-full items-center">
            <div className="conversation-list glass glass-panel h-full" style={{ padding: '0', display: 'flex' }}>
                <h2 style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>Conversations</h2>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {conversations.length === 0 ? (
                        <p className="text-muted p-4 text-center">No active conversations</p>
                    ) : (
                        conversations.map(conv => (
                            <div
                                key={conv._id}
                                className={`conversation-item ${activeChat?._id === conv._id ? 'active' : ''}`}
                                onClick={() => selectChat(conv)}
                            >
                                <div className="flex justify-between items-center" style={{ marginBottom: '8px' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{conv._id.slice(-6).toUpperCase()}</span>
                                    <span className={`status-badge status-${conv.status}`}>{conv.status}</span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }} className="truncate">
                                    {conv.lastMessage || 'New Chat'}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="chat-container glass-panel h-full" style={{ background: 'var(--surface)', margin: 0, maxWidth: '100%' }}>
                {activeChat ? (
                    <>
                        <div style={{ padding: '15px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ fontSize: '1.2rem' }}>Chat: {activeChat._id}</h3>
                                <span className="text-muted" style={{ fontSize: '0.8rem' }}>Started: {new Date(activeChat.createdAt).toLocaleString()}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className={`status-badge status-${activeChat.status}`}>{activeChat.status}</span>
                                {activeChat.status !== 'resolved' && (
                                    <button onClick={resolveChat} className="btn btn-success" style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
                                        Mark Resolved
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="chat-messages">
                            {messages.map((msg, idx) => (
                                <div key={idx} className={`animate-fade-in flex flex-col ${msg.sender === 'user' ? 'items-start' : 'items-end'}`}>
                                    <div className={`message-bubble message-${msg.sender === 'user' ? 'user' : msg.sender === 'system' ? 'system' : 'ai'}`}>
                                        {msg.sender !== 'agent' && msg.sender !== 'system' && (
                                            <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '4px', textTransform: 'capitalize' }}>
                                                {msg.sender === 'ai' ? 'AI Auto-reply' : 'User'}
                                            </div>
                                        )}
                                        {msg.sender === 'user' || msg.sender === 'system' ? (
                                            <div className="message-content" style={{ whiteSpace: 'pre-wrap' }}>{msg.message}</div>
                                        ) : (
                                            <div className="message-content markdown-body">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {msg.message}
                                                </ReactMarkdown>
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', margin: msg.sender === 'system' ? '0 auto' : '0' }}>
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        <form onSubmit={sendMessage} className="chat-input-area border-t" style={{ background: 'rgba(0,0,0,0.2)' }}>
                            <input
                                type="text"
                                value={inputMsg}
                                onChange={(e) => setInputMsg(e.target.value)}
                                className="input-glass"
                                placeholder={activeChat.status === 'resolved' ? "This chat is resolved." : "Reply to user as Admin..."}
                                disabled={activeChat.status === 'resolved'}
                            />
                            <button type="submit" className="btn btn-primary" disabled={activeChat.status === 'resolved' || !inputMsg.trim()}>
                                Reply
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="flex h-full items-center justify-center text-muted flex-col gap-4">
                        <svg style={{ width: '64px', height: '64px', opacity: 0.3, color: 'var(--primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <p style={{ fontWeight: 500 }}>Select a conversation to view and reply</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPanel;
