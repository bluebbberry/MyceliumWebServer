import React from 'react';
import MessageBubble from './MessageBubble';
import './MessageList.css';

const MessageList = ({ messages }) => {
  return (
    <div className="message-list">
      {messages.map((msg, index) => (
        <MessageBubble key={index} text={msg.text} sender={msg.sender} />
      ))}
    </div>
  );
};

export default MessageList;
