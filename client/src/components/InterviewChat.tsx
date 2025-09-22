import { FormEvent, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../types';

interface InterviewChatProps {
  messages: ChatMessage[];
  onSend: (message: string) => Promise<void> | void;
  disabled?: boolean;
  busy?: boolean;
}

const InterviewChat = ({ messages, onSend, disabled = false, busy = false }: InterviewChatProps) => {
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = listRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || disabled || busy || isSending) {
      return;
    }

    setIsSending(true);
    try {
      await onSend(trimmed);
      setDraft('');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="interview-chat">
      <div className="chat-history" ref={listRef}>
        {messages.length === 0 ? (
          <div className="chat-empty">The interviewer is preparing your first question.</div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`chat-message chat-message--${message.author}`}>
              <div className="chat-message__meta">
                <span className="chat-message__author">
                  {message.author === 'ai' ? 'Talience' : message.author === 'candidate' ? 'You' : 'System'}
                </span>
                <span className="chat-message__timestamp">
                  {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="chat-message__body">{message.content}</div>
            </div>
          ))
        )}
      </div>
      <form className="chat-input" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="candidate-response">
          Your response
        </label>
        <textarea
          id="candidate-response"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={disabled ? 'Join the interview to respond' : 'Share your response to the current question...'}
          disabled={disabled || busy || isSending}
          rows={4}
        />
        <button type="submit" disabled={disabled || busy || isSending || draft.trim().length === 0}>
          {busy || isSending ? 'Sending…' : 'Send response'}
        </button>
      </form>
    </div>
  );
};

export default InterviewChat;
