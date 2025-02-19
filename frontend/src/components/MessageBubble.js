import React from 'react';
import './MessageBubble.css';

const MessageBubble = ({ text, sender }) => {
  return (
    <div className={`message-bubble ${sender}`}>
      <p>{text}</p>
    </div>
  );
};

export default MessageBubble;
