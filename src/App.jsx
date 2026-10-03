import React, { useState, useRef, useEffect } from 'react';

export function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const textareaRef = useRef(null);
  const bottomRef = useRef(null);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Auto-resize composer input
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [input]);

  const handleSend = (text) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsg = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: trimmed,
      time,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Realistic minimal mock response
    setTimeout(() => {
      let replyText = `I received: "${trimmed}".`;
      let codeSnippet = null;
      let language = null;

      const lower = trimmed.toLowerCase();
      if (lower.includes('code') || lower.includes('react') || lower.includes('function')) {
        replyText = 'Here is a clean implementation:';
        codeSnippet = `function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}`;
        language = 'javascript';
      } else if (lower.includes('hello') || lower.includes('hi')) {
        replyText = 'Hello. Ready when you are.';
      }

      const botMsg = {
        id: `b-${Date.now()}`,
        sender: 'assistant',
        text: replyText,
        code: codeSnippet,
        language,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, 600);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
  };

  return (
    <div className="minimal-app">
      {/* Top drag strip & optional clear action */}
      <div className="titlebar-strip">
        {messages.length > 0 && (
          <button className="clear-btn" onClick={() => setMessages([])}>
            Clear
          </button>
        )}
      </div>

      {/* Main Chat Scroll View */}
      <div className="chat-container">
        <div className="chat-inner">
          {messages.length === 0 ? (
            <div className="empty-state">
              <span className="empty-prompt">What's on your mind?</span>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`msg-row ${m.sender}`}>
                <div className="msg-bubble">
                  <div>{m.text}</div>
                  {m.code && (
                    <div className="code-container">
                      <div className="code-top">
                        <span>{m.language || 'code'}</span>
                        <button
                          className="copy-button"
                          onClick={() => handleCopy(m.code)}
                        >
                          Copy
                        </button>
                      </div>
                      <pre className="code-body">
                        <code>{m.code}</code>
                      </pre>
                    </div>
                  )}
                </div>
                <span className="msg-time">{m.time}</span>
              </div>
            ))
          )}

          {isTyping && (
            <div className="msg-row assistant">
              <div className="typing-dots">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Bottom Floating Composer */}
      <div className="composer-dock">
        <div className="composer-frame">
          <textarea
            ref={textareaRef}
            className="composer-input"
            rows={1}
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isTyping}
          />
          <button
            className="send-trigger"
            disabled={!input.trim() || isTyping}
            onClick={() => handleSend(input)}
            title="Send"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
        <div className="dock-hint">Return to send · Shift+Return for newline</div>
      </div>
    </div>
  );
}

export default App;
