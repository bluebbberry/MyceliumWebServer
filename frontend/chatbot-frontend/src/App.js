import React, { useState } from 'react';
import './App.css';

function App() {
  // State to keep track of the messages and the input field
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  // Function to handle sending a message
  const handleSendMessage = () => {
    if (newMessage.trim()) {
      setMessages([...messages, newMessage]);
      setNewMessage(''); // Clear the input field after sending
    }
  };

  // Handle Enter key press to send message
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-box">
        {/* Title section */}
        <div className="chat-title">
          <h1>iFungus</h1>
        </div>

        {/* Display the chat messages */}
        <div className="messages">
          {messages.map((message, index) => (
            <div key={index} className="message">
              {message}
            </div>
          ))}
        </div>

        {/* Input field and Send button */}
        <div className="input-container">
          <input
            type="text"
            className="message-input"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
          />
          <button className="send-button" onClick={handleSendMessage}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
