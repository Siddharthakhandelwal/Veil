import React, { useEffect, useRef, useState } from 'react';

function timeNow() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [input]);

  const handleCaptureScreen = async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    setError('');
    try {
      const dataUrl = await window.electronAPI?.captureScreen();
      if (!dataUrl) throw new Error('Screen capture returned no image.');
      setAttachedImage(dataUrl);
    } catch (err) {
      setError(err?.message || 'Screenshot capture failed.');
    } finally {
      setIsCapturing(false);
      textareaRef.current?.focus();
    }
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if ((!trimmed && !attachedImage) || isTyping) return;

    setError('');
    const currentImage = attachedImage;
    const userText = trimmed;

    const userMsg = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: userText,
      image: currentImage,
      time: timeNow(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachedImage(null);
    setIsTyping(true);

    try {
      // Send only the recent conversation needed by the model.
      const history = [...messages, userMsg]
        .slice(-12)
        .map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text || '',
        }))
        .filter(m => m.content);

      const result = await window.electronAPI.chat({
        text: userText,
        image: currentImage,
        history,
      });

      if (!result?.ok) throw new Error(result?.error || 'The AI request failed.');

      setMessages(prev => [...prev, {
        id: `b-${Date.now()}`,
        sender: 'assistant',
        text: result.text,
        time: timeNow(),
      }]);
    } catch (err) {
      setError(err?.message || 'Something went wrong.');
      setMessages(prev => [...prev, {
        id: `e-${Date.now()}`,
        sender: 'assistant',
        text: 'I could not complete that request. Check the configuration/error shown below.',
        time: timeNow(),
        error: true,
      }]);
    } finally {
      setIsTyping(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = async (text) => {
    try { await navigator.clipboard.writeText(text); } catch { }
  };

  return (
    <div className="minimal-app">
      <div className="titlebar-strip">
        <div className="titlebar-left">
          {messages.length > 0 && (
            <button className="clear-btn" onClick={() => setMessages([])}>Clear</button>
          )}
        </div>
        <div className="titlebar-controls">
          <button className="win-btn" title="Minimize" onClick={() => window.electronAPI?.minimize()}>−</button>
          <button className="win-btn close" title="Close" onClick={() => window.electronAPI?.close()}>×</button>
        </div>
      </div>

      <div className="chat-container">
        <div className="chat-inner">
          {messages.length === 0 ? (
            <div className="empty-state">
              <span className="empty-prompt">What's on your mind?</span>
            </div>
          ) : messages.map(m => (
            <div key={m.id} className={`msg-row ${m.sender}`}>
              <div className="msg-bubble">
                {m.image && <img src={m.image} alt="Captured screenshot" className="msg-screenshot" />}
                {m.text && <div className="message-text">{m.text}</div>}
              </div>
              <span className="msg-time">{m.time}</span>
            </div>
          ))}

          {isTyping && (
            <div className="msg-row assistant">
              <div className="typing-dots"><span className="dot" /><span className="dot" /><span className="dot" /></div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="composer-dock">
        {attachedImage && (
          <div className="attachment-preview-bar">
            <div className="attachment-badge">
              <img src={attachedImage} alt="Attachment" className="attachment-thumb" />
              <span className="attachment-label">Screen capture attached</span>
              <button type="button" className="remove-attachment-btn" onClick={() => setAttachedImage(null)}>✕</button>
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
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isTyping}
          />
          <div className="composer-actions">
            <button type="button" className={`capture-btn ${isCapturing ? 'capturing' : ''}`} onClick={handleCaptureScreen} disabled={isCapturing}>
              {isCapturing ? 'Capturing…' : 'Screenshot'}
            </button>
            <button type="button" className="send-btn" onClick={handleSend} disabled={isTyping || (!input.trim() && !attachedImage)}>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
