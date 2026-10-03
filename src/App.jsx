import React, { useState, useRef, useEffect } from 'react';

export function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const textareaRef = useRef(null);
  const bottomRef = useRef(null);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, attachedImage]);

  // Auto-resize composer input
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [input]);

  const handleCaptureScreen = async () => {
    if (isCapturing) return;
    setIsCapturing(true);

    try {
      if (window.electronAPI?.captureScreen) {
        const dataUrl = await window.electronAPI.captureScreen();
        if (dataUrl) {
          setAttachedImage(dataUrl);
        }
      } else {
        // Fallback for browser preview testing
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#141419';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Inter, sans-serif';
        ctx.fillText('Browser Simulated Screen Capture', 50, 180);
        setAttachedImage(canvas.toDataURL('image/png'));
      }
    } catch (err) {
      console.error('Screenshot capture failed:', err);
    } finally {
      setIsCapturing(false);
      textareaRef.current?.focus();
    }
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if ((!trimmed && !attachedImage) || isTyping) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const currentAttachment = attachedImage;

    const userMsg = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: trimmed,
      image: currentAttachment,
      time,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setAttachedImage(null);
    setIsTyping(true);

    // Realistic minimal mock response
    setTimeout(() => {
      let replyText = trimmed ? `I received: "${trimmed}".` : 'I have received your screenshot.';
      let codeSnippet = null;
      let language = null;

      if (currentAttachment) {
        replyText = trimmed
          ? `I have analyzed the screen capture along with your request: "${trimmed}". The full screen capture was successfully processed.`
          : 'I have received your full screen capture. Let me know if you would like me to inspect or extract any details.';
      } else {
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
      handleSend();
    }
  };

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
  };

  return (
    <div className="minimal-app">
      {/* Top drag strip with clear action and window controls */}
      <div className="titlebar-strip">
        <div className="titlebar-left">
          {messages.length > 0 && (
            <button className="clear-btn" onClick={() => setMessages([])}>
              Clear
            </button>
          )}
        </div>
        <div className="titlebar-controls">
          <button
            className="win-btn"
            title="Minimize"
            onClick={() => window.electronAPI?.minimize()}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            className="win-btn close"
            title="Close"
            onClick={() => window.electronAPI?.close()}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
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
                  {m.image && (
                    <div className="msg-img-container">
                      <img
                        src={m.image}
                        alt="Captured screenshot"
                        className="msg-screenshot"
                        onClick={() => window.open(m.image)}
                        title="Click to view full image"
                      />
                    </div>
                  )}
                  {m.text && <div>{m.text}</div>}
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
        {/* Attachment Pill preview before sending */}
        {attachedImage && (
          <div className="attachment-preview-bar">
            <div className="attachment-badge">
              <img src={attachedImage} alt="Attachment thumbnail" className="attachment-thumb" />
              <span className="attachment-label">Screen capture attached</span>
              <button
                type="button"
                className="remove-attachment-btn"
                title="Remove screenshot"
                onClick={() => setAttachedImage(null)}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <div className="composer-frame">
          <textarea
            ref={textareaRef}
            className="composer-input"
            rows={1}
            placeholder={attachedImage ? 'Ask about this screenshot...' : 'Type a message...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isTyping}
          />
          
          <div className="composer-actions">
            {/* Screenshot capture trigger */}
            <button
              type="button"
              className={`capture-btn ${isCapturing ? 'capturing' : ''}`}
              title="Take full screen screenshot"
              onClick={handleCaptureScreen}
              disabled={isCapturing || isTyping}
            >
              {isCapturing ? (
                <span className="capture-spinner" />
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              )}
            </button>

            {/* Send button */}
            <button
              type="button"
              className="send-trigger"
              disabled={(!input.trim() && !attachedImage) || isTyping}
              onClick={handleSend}
              title="Send"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="dock-hint">Return to send · Shift+Return for newline · Caps+A to show/hide</div>
      </div>
    </div>
  );
}

export default App;
