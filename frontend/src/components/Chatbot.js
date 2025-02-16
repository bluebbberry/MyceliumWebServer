import React, { useState } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import axios from 'axios';
import './Chatbot.css';

const Chatbot = () => {
  const [messages, setMessages] = useState([]);

  const sendMessage = async (text) => {
    const userMessage = { text, sender: 'user' };
    setMessages((prevMessages) => [...prevMessages, userMessage]);

    try {
      const backendPort = process.env.REACT_APP_BACKEND_PORT;
      console.log("backendPort: " + backendPort);
      const response = await axios.post('http://127.0.0.1:' + backendPort + '/chat', { message: text });
      const botMessage = { text: response.data.reply, sender: 'bot' };
      setMessages((prevMessages) => [...prevMessages, botMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = { text: 'Something went wrong!', sender: 'bot' };
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    }
  };

  return (
    <div className="chatbot">
      <MessageList messages={messages} />
      <MessageInput onSend={sendMessage} />
    </div>
    <div>
        <a href="localhost:3000">Fungi 1</a>
        <a href="localhost:3001">Fungi 2</a>
    </div>
  );
};

export default Chatbot;
