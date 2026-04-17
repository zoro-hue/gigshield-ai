import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Sparkles, X, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';

type Message = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  'How do I get covered?',
  'How do claims work?',
  'Check my payment',
];

const ShieldSparkIcon = () => (
  <div className="relative" style={{ width: 22, height: 22 }}>
    <Shield className="text-white" size={22} />
    <Sparkles
      className="absolute"
      size={11}
      style={{ top: -2, right: -2, color: '#FFFFFF', opacity: 0.9 }}
    />
  </div>
);

const FloatingAssistant: React.FC = () => {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [displayedContent, setDisplayedContent] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, displayedContent, scrollToBottom]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const simulateTyping = useCallback((fullText: string) => {
    if (fullText.length <= 150) {
      setMessages(prev => [...prev, { role: 'assistant', content: fullText }]);
      setDisplayedContent(null);
      return;
    }
    let i = 0;
    const chunkSize = 3;
    setDisplayedContent('');
    const tick = () => {
      i += chunkSize;
      if (i >= fullText.length) {
        setDisplayedContent(null);
        setMessages(prev => [...prev, { role: 'assistant', content: fullText }]);
        return;
      }
      setDisplayedContent(fullText.slice(0, i));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, []);

  const fetchUserContext = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { authenticated: false };

      const uid = user.id;
      const userName = user.user_metadata?.full_name || '';

      const [policiesRes, claimsRes, txRes] = await Promise.all([
        supabase.from('policies').select('status, weekly_premium, expires_at').eq('user_id', uid).eq('status', 'active').limit(1),
        supabase.from('claims').select('status, amount').eq('user_id', uid).order('created_at', { ascending: false }).limit(3),
        supabase.from('transactions').select('status, amount, type').eq('user_id', uid).order('created_at', { ascending: false }).limit(3),
      ]);

      const activePolicy = policiesRes.data?.[0];
      const recentClaims = claimsRes.data || [];
      const recentTx = txRes.data || [];

      const latestClaim = recentClaims[0];
      const pendingPayment = recentTx.find(t => t.type === 'payout' && t.status !== 'credited');

      return {
        authenticated: true,
        userName: userName || undefined,
        covered: !!activePolicy,
        weeklyPremium: activePolicy?.weekly_premium,
        claimStatus: latestClaim?.status || 'none',
        claimCount: recentClaims.length,
        paymentStatus: pendingPayment ? pendingPayment.status : (recentTx.length > 0 ? 'none_pending' : 'none'),
      };
    } catch {
      return { authenticated: false };
    }
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Message = { role: 'user', content: text.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setIsLoading(true);

    try {
      const userContext = await fetchUserContext();
      const historyForApi = updated.slice(-15).map(m => ({ role: m.role, content: m.content }));

      const { data, error } = await supabase.functions.invoke('chat-assistant', {
        body: { messages: historyForApi, userContext },
      });

      if (error) throw error;

      if (data?.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.error }]);
      } else {
        simulateTyping(data?.reply || 'Something went wrong. Please try again.');
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, simulateTyping, fetchUserContext]);

  const btnSize = isMobile ? 48 : 56;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        drag={!isMobile}
        dragConstraints={{ top: 0, left: 0, right: typeof window !== 'undefined' ? window.innerWidth - btnSize - 24 : 500, bottom: typeof window !== 'undefined' ? window.innerHeight - btnSize - 24 : 500 }}
        dragElastic={0.1}
        dragMomentum={false}
        whileHover={{ scale: 1.05 }}
        onClick={() => setIsOpen(o => !o)}
        className="fixed z-[9990] cursor-pointer"
        style={{
          bottom: 24, right: 24, width: btnSize, height: btnSize,
          borderRadius: '50%', background: '#111111',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {isOpen ? <X className="text-white" size={20} /> : <ShieldSparkIcon />}
      </motion.div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={`fixed z-[9989] flex flex-col ${isMobile ? 'bottom-0 left-0 right-0 rounded-t-2xl' : 'rounded-2xl'}`}
            style={
              isMobile
                ? { height: '60vh', background: '#0A0A0A', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }
                : { bottom: 24 + btnSize + 12, right: 24, width: 320, height: 420, background: '#0A0A0A', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }
            }
          >
            <div className="px-4 py-3 border-b border-white/5 shrink-0">
              <p className="text-white text-sm font-medium">GigShield AI</p>
              <p className="text-white/40 text-xs">How can I help you?</p>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5" style={{ scrollBehavior: 'smooth' }}>
              {messages.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center h-full gap-4 px-2">
                  <p className="text-white/50 text-xs text-center leading-relaxed">
                    Hi, I'm GigShield AI.<br />Ask me about coverage, claims, or payments.
                  </p>
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {SUGGESTIONS.map(s => (
                      <button key={s} onClick={() => sendMessage(s)} className="text-[11px] px-2.5 py-1.5 rounded-full border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-colors">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${msg.role === 'user' ? 'bg-white text-black' : 'bg-[#111] text-white/90'}`}>
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown
                        disallowedElements={['script', 'iframe', 'img']}
                        unwrapDisallowed
                        components={{
                          p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-3 mb-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-3 mb-1">{children}</ol>,
                          li: ({ children }) => <li className="mb-0.5">{children}</li>,
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        }}
                      >{msg.content}</ReactMarkdown>
                    ) : msg.content}
                  </div>
                </div>
              ))}

              {displayedContent !== null && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed bg-[#111] text-white/90">
                    <ReactMarkdown disallowedElements={['script', 'iframe', 'img']} unwrapDisallowed>{displayedContent}</ReactMarkdown>
                  </div>
                </div>
              )}

              {isLoading && displayedContent === null && (
                <div className="flex justify-start">
                  <div className="px-3 py-2 rounded-xl text-xs text-white/40 bg-[#111]">GigShield AI is typing…</div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="px-3 pb-3 pt-1 shrink-0">
              <div className="flex items-center gap-2 bg-[#111] rounded-xl px-3 py-2 border border-white/5">
                <input
                  ref={inputRef} value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
                  placeholder="Ask about claims, coverage, payments..."
                  className="flex-1 bg-transparent text-white text-xs placeholder:text-white/25 outline-none"
                  disabled={isLoading}
                />
                <button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading} className="text-white/40 hover:text-white disabled:opacity-20 transition-colors">
                  <Send size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FloatingAssistant;
