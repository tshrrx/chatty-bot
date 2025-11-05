'use client';

import { useState, FormEvent, ChangeEvent, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

// Define the structure of a message part
interface MessagePart {
  text: string;
}

// Define the structure of a message (from user or model)
interface Message {
  role: 'user' | 'model';
  parts: MessagePart[];
}

export default function Home() {
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [chatId, setChatId] = useState<number>(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to the bottom of the chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      // Limit height to 200px
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [currentMessage]);

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentMessage(e.target.value);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentMessage.trim() || isLoading) return;

    const messageToSend = currentMessage;
    
    const userMessage: Message = {
      role: 'user',
      parts: [{ text: messageToSend }],
    };

    // 1. Add user message to history immediately
    setChatHistory((prevHistory) => [...prevHistory, userMessage]);
    setCurrentMessage('');
    setIsLoading(true);

    // 2. Prepare an empty model message placeholder
    const modelMessageIndex = chatHistory.length + 1;
    setChatHistory((prevHistory) => [
      ...prevHistory,
      { role: 'model', parts: [{ text: '' }] },
    ]);
    
    let fullResponseText = '';

    try {
      // 3. Auto-detect API URL based on environment
      const apiUrl = process.env.NODE_ENV === 'production'
          ? process.env.NEXT_PUBLIC_API_URL || 'https://chatty-bot-55z4.onrender.com/'  // Use deployed backend URL or proxy
          : 'http://localhost:8000/api/chat';  // Local FastAPI backend
        
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
          newMessage: messageToSend,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error('Failed to fetch streaming response from FastAPI');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      
      // 4. Read the stream chunk by chunk
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;

        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          
          // Server-Sent Events (SSE) often contain multiple 'data:' lines
          const sseMessages = chunk.split('\n\n').filter(msg => msg.startsWith('data: '));

          for (const sseMessage of sseMessages) {
            try {
              const jsonString = sseMessage.replace('data: ', '').trim();
              if (jsonString) {
                const data = JSON.parse(jsonString);

                // Handle streamed text chunks
                if (data.text) {
                    fullResponseText += data.text;
                    // Update the model message placeholder with the cumulative text
                    setChatHistory((prevHistory) => {
                        const newHistory = [...prevHistory];
                        const latestModelMsg = newHistory[modelMessageIndex];
                        if (latestModelMsg && latestModelMsg.role === 'model') {
                            latestModelMsg.parts[0].text = fullResponseText;
                        }
                        return newHistory;
                    });
                }
              }
            } catch (e) {
                console.error("Failed to parse SSE chunk:", e, "Chunk:", sseMessage);
            }
          }
        }
      }

    } catch (error) {
      console.error('Chat submission error:', error);
      const errorMessage: Message = {
        role: 'model',
        parts: [{ text: 'Sorry, the chat service encountered an error. Please check the backend (port 8000) and try again.' }],
      };
      setChatHistory((prevHistory) => [...prevHistory, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Cast e to any to match expected FormEvent type for handleSubmit
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handleSubmit(e as any);
    }
  };

  const handleNewChat = () => {
    // Clears chat context/memory on the frontend
    setChatHistory([]);
    setCurrentMessage('');
    setChatId(prevId => prevId + 1);
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col">
        {/* HEADER*/}
        <header className="border-b border-gray-200 bg-white shadow-sm px-4 py-3 sticky top-0 z-10">
          <div className="max-w-3xl mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">cHatty</h1>
            <button
              onClick={handleNewChat}
              className="bg-transparent border border-gray-300 hover:bg-gray-100 text-gray-700 font-medium py-2 px-4 rounded-full transition-colors flex items-center gap-2 text-sm shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New chat
            </button>
          </div>
        </header>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto" key={chatId}>
          {chatHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-xl">
                  {/* Gemini/Bot Icon */}
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h1 className="text-3xl font-semibold text-gray-900 mb-2">
                  Hello! How can I help you today?
                </h1>
                <p className="text-gray-500">Ask cHatty anything!</p>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-8">
              {chatHistory.map((msg, index) => (
                <div
                  key={index}
                  className={`mb-6 flex gap-3 ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {/* Avatar (Hidden on User message for cleaner right-align) */}
                  <div className={`flex-shrink-0 ${msg.role === 'user' ? 'hidden' : 'block'}`}>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-md">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* Message Content */}
                  <div className="max-w-[75%]">
                    <div className={`p-4 rounded-xl shadow-md ${
                      msg.role === 'user'
                          ? 'bg-blue-600 text-white rounded-tr-none'
                          : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                      }`}>
                      <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert' : ''}`}>
                        <ReactMarkdown
                          components={{
                            // Customize rendering of specific elements
                            p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                            strong: ({children}) => <strong className="font-bold">{children}</strong>,
                            em: ({children}) => <em className="italic">{children}</em>,
                            code: ({children}) => <code className="bg-gray-100 text-red-600 px-1 py-0.5 rounded text-sm">{children}</code>,
                            pre: ({children}) => <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto my-2">{children}</pre>,
                            ul: ({children}) => <ul className="list-disc list-inside my-2">{children}</ul>,
                            ol: ({children}) => <ol className="list-decimal list-inside my-2">{children}</ol>,
                            li: ({children}) => <li className="mb-1">{children}</li>,
                            h1: ({children}) => <h1 className="text-2xl font-bold mb-2">{children}</h1>,
                            h2: ({children}) => <h2 className="text-xl font-bold mb-2">{children}</h2>,
                            h3: ({children}) => <h3 className="text-lg font-bold mb-2">{children}</h3>,
                          }}
                        >
                          {msg.parts[0].text}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>

                  {/* User Avatar (on right side) */}
                  <div className={`flex-shrink-0 ${msg.role === 'model' ? 'hidden' : 'block'}`}>
                    <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center shadow-md">
                      <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Loading Indicator */}
              {isLoading && (
                <div className="mb-6 flex gap-3 justify-start">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-md">
                      <svg className="w-5 h-5 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.01M20 20h-5m5 0v-5" />
                      </svg>
                    </div>
                  </div>
                  <div className="max-w-[75%]">
                    <div className="p-4 rounded-xl shadow-md bg-white border border-gray-100 rounded-tl-none">
                      <div className="flex gap-1 items-center">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 bg-white sticky bottom-0 z-10">
          <div className="max-w-3xl mx-auto px-4 py-6">
            <form onSubmit={handleSubmit} className="relative">
              <textarea
                ref={textareaRef}
                rows={1}
                value={currentMessage}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Write your question here..."
                disabled={isLoading}
                className="w-full resize-none rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 pr-16 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed shadow-inner transition-all duration-150 scrollbar-hide"
                style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none'
                }}
              />
              <button
                type="submit"
                disabled={isLoading || !currentMessage.trim()}
                className="absolute right-3 bottom-3 p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              </button>
            </form>
            <p className="text-xs text-gray-500 text-center mt-3">
              This application uses the Gemini API via a Python/FastAPI backend.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}