import React, { useState } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import axios from 'axios';
import './Chatbot.css';

const FUNGUS_BACKEND_PORT = process.env.REACT_APP_FUNGUS_BACKEND_PORT;

const Chatbot = () => {
  const [messages, setMessages] = useState([]);

  const sendMessage = async (text) => {
    const userMessage = { text, sender: 'user' };
    setMessages((prevMessages) => [...prevMessages, userMessage]);

    try {
      console.log("fungusBackendPort: " + FUNGUS_BACKEND_PORT);
      const response = await axios.post('http://127.0.0.1:' + FUNGUS_BACKEND_PORT + '/chat', { message: text });
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
  );
};

export default Chatbot;
