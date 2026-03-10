import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
console.log('🚀 App using Backend URL:', BACKEND_URL);

const UserChat = () => {
    const [conversation, setConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputMsg, setInputMsg] = useState('');
    const [socket, setSocket] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        const newSocket = io(BACKEND_URL);
        setSocket(newSocket);

        // Check local storage for existing session
        const savedConvId = localStorage.getItem('nexus_chat_id');
        if (savedConvId) {
            axios.get(`${BACKEND_URL}/chat/${savedConvId}`).then(res => {
                setConversation(res.data.conversation);
                setMessages(res.data.messages);
                newSocket.emit('join_conversation', savedConvId);
            }).catch(err => {
                localStorage.removeItem('nexus_chat_id');
            });
        }

        return () => newSocket.close();
    }, []);

    useEffect(() => {
        if (!socket || !conversation) return;

        const handleNewMessage = (msg) => {
            setMessages(prev => [...prev, msg]);
        };
        const handleStatus = (status) => {
            setConversation(prev => ({ ...prev, status }));
        };

        socket.on('new_message', handleNewMessage);
        socket.on('status_change', handleStatus);

        return () => {
            socket.off('new_message', handleNewMessage);
            socket.off('status_change', handleStatus);
        };
    }, [socket, conversation?._id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const clearChat = () => {
        localStorage.removeItem('nexus_chat_id');
        setConversation(null);
        setMessages([]);
    };

    const startChat = async () => {
        try {
            setIsLoading(true);
            const res = await axios.post(`${BACKEND_URL}/chat/start`);
            const newConv = res.data;
            setConversation(newConv);
            localStorage.setItem('nexus_chat_id', newConv._id);
            if (socket) {
                socket.emit('join_conversation', newConv._id);
            }

        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!inputMsg.trim() || !conversation) return;

        try {
            const payload = {
                conversationId: conversation._id,
                sender: 'user',
                message: inputMsg
            };

            setInputMsg(''); // optimistic clear
            await axios.post(`${BACKEND_URL}/chat/message`, payload);
            // Backend automatically broadcasts this message, so we will receive it via socket
        } catch (err) {
            console.error('Failed to send msg', err);
        }
    };

    if (!conversation) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="glass glass-panel p-8 text-center" style={{ padding: '3rem', maxWidth: '400px' }}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Need Assistance?</h2>
                    <p className="text-muted" style={{ marginBottom: '2rem' }}>Our AI is here to help you immediately. If things get complicated, a human will take over.</p>
                    <button onClick={startChat} className="btn btn-primary w-full" disabled={isLoading} style={{ fontSize: '1.1rem', padding: '12px' }}>
                        {isLoading ? 'Connecting...' : 'Start Chat Session'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="chat-container glass-panel bg-opacity-50">
            <div style={{ padding: '15px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)' }}>
                <div>
                    <h3 style={{ fontSize: '1.1rem' }}>Support Chat</h3>
                    <span className="text-muted" style={{ fontSize: '0.8rem' }}>ID: {conversation._id}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`status-badge status-${conversation.status}`}>
                        {conversation.status}
                    </span>
                    <button onClick={clearChat} className="btn" style={{ padding: '4px 10px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)', color: 'white' }}>
                        New Chat
                    </button>
                </div>
            </div>

            <div className="chat-messages">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`animate-fade-in flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`message-bubble message-${msg.sender === 'agent' ? 'ai' : msg.sender === 'system' ? 'system' : msg.sender}`}>
                            {msg.sender !== 'user' && msg.sender !== 'system' && (
                                <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '4px', textTransform: 'capitalize' }}>
                                    {msg.sender === 'ai' ? 'Nexus AI' : 'Human Agent'}
                                </div>
                            )}
                            {msg.sender === 'user' ? (
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

            <form onSubmit={sendMessage} className="chat-input-area" style={{ background: 'var(--surface)' }}>
                <input
                    type="text"
                    value={inputMsg}
                    onChange={(e) => setInputMsg(e.target.value)}
                    className="input-glass"
                    placeholder={conversation.status === 'resolved' ? "Chat is resolved" : "Type your message..."}
                    disabled={conversation.status === 'resolved'}
                />
                <button type="submit" className="btn btn-primary" disabled={conversation.status === 'resolved' || !inputMsg.trim()}>
                    Send
                </button>
            </form>
        </div>
    );
};

export default UserChat;
