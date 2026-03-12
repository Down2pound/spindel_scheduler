import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X, Send, RefreshCw, AlertCircle, Bot, User } from 'lucide-react';
import { analyzeSchedule, chatWithGemini } from '../services/geminiService';
import { SheetDaySchedule } from '../services/sheetService';
import ReactMarkdown from 'react-markdown';

interface GeminiPanelProps {
  scheduleData: SheetDaySchedule[];
  onClose: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const GeminiPanel: React.FC<GeminiPanelProps> = ({ scheduleData, onClose }) => {
  const [analysis, setAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    handleAnalyze();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    const result = await analyzeSchedule(scheduleData);
    setAnalysis(result);
    setIsAnalyzing(false);
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsTyping(true);

    const response = await chatWithGemini(userMessage, scheduleData);
    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    setIsTyping(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 400 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 400 }}
      className="fixed right-0 top-0 bottom-0 w-[450px] bg-[#05070a]/95 backdrop-blur-3xl border-l border-white/10 z-[100] flex flex-col shadow-2xl"
    >
      {/* Header */}
      <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30">
            <Sparkles className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-white">GEMINI_AI_INSIGHTS</h2>
            <p className="text-[0.6rem] font-mono text-white/40 uppercase tracking-widest">Clinic Operations Assistant</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-xl transition-all text-white/40 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Analysis Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[0.65rem] font-black uppercase tracking-[0.3em] text-white/30">Weekly_Analysis</h3>
            <button 
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="text-[0.5rem] font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 uppercase tracking-widest disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isAnalyzing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="p-5 bg-white/5 border border-white/10 rounded-2xl relative overflow-hidden">
            {isAnalyzing ? (
              <div className="py-12 flex flex-col items-center justify-center gap-4">
                <RefreshCw className="w-8 h-8 text-emerald-500/20 animate-spin" />
                <p className="text-[0.6rem] font-mono text-white/20 uppercase tracking-widest animate-pulse">Analyzing Schedule Data...</p>
              </div>
            ) : (
              <div className="prose prose-invert prose-xs max-w-none text-white/70 font-mono leading-relaxed">
                <ReactMarkdown>{analysis}</ReactMarkdown>
              </div>
            )}
            <div className="absolute top-0 right-0 p-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            </div>
          </div>
        </section>

        {/* Chat Section */}
        <section className="space-y-4 flex flex-col h-[400px]">
          <h3 className="text-[0.65rem] font-black uppercase tracking-[0.3em] text-white/30">Interactive_Assistant</h3>
          
          <div className="flex-1 bg-black/40 rounded-2xl border border-white/5 p-4 overflow-y-auto space-y-4 flex flex-col">
            {messages.length === 0 && !isTyping && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3">
                <Bot className="w-8 h-8 text-white/10" />
                <p className="text-[0.65rem] text-white/20 font-mono">Ask me anything about the current schedule, staffing levels, or doctor assignments.</p>
              </div>
            )}
            
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-white/10' : 'bg-emerald-500/20 border border-emerald-500/20'}`}>
                  {msg.role === 'user' ? <User className="w-4 h-4 text-white/40" /> : <Sparkles className="w-4 h-4 text-emerald-400" />}
                </div>
                <div className={`p-3 rounded-2xl text-[0.7rem] font-mono leading-relaxed ${msg.role === 'user' ? 'bg-white/5 text-white/80' : 'bg-emerald-500/5 text-emerald-100/80 border border-emerald-500/10'}`}>
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                </div>
                <div className="p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex gap-1 items-center">
                  <div className="w-1 h-1 bg-emerald-400/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1 h-1 bg-emerald-400/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1 h-1 bg-emerald-400/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="relative">
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type your question..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-[0.7rem] font-mono focus:outline-none focus:border-emerald-500/30 transition-all"
            />
            <button 
              onClick={handleSend}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/5 bg-black/20">
        <div className="flex items-center gap-2 opacity-20">
          <AlertCircle className="w-3 h-3" />
          <span className="text-[0.5rem] font-mono uppercase tracking-widest">AI-generated insights may require verification</span>
        </div>
      </div>
    </motion.div>
  );
};
