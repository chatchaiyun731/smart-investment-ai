import React, { useState, useEffect, useRef } from 'react';
import { Send, Cpu, User, Loader, AlertCircle, Trash2 } from 'lucide-react';
import { financeApi } from '../services/financeApi';
import { aiService } from '../services/aiService';
import type { ChatMessage } from '../services/aiService';
import type { PortfolioAnalysis, Holding } from '../services/aiService';

interface AiChatProps {
  analysis: PortfolioAnalysis;
  holdings: Holding[];
  setActiveTab: (tab: 'dashboard' | 'holdings' | 'ai' | 'settings') => void;
}

// Simple Parser for rendering Markdown formatting inside the chat bubble
const ChatMarkdown: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem', lineHeight: '1.5' }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('### ')) {
          return <h4 key={idx} style={{ fontSize: '0.95rem', fontWeight: 800, marginTop: '0.4rem', color: '#fff' }}>{trimmed.slice(4)}</h4>;
        }
        if (trimmed.startsWith('## ')) {
          return <h3 key={idx} style={{ fontSize: '1rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--accent-primary)' }}>{trimmed.slice(3)}</h3>;
        }
        if (trimmed.startsWith('- ')) {
          return (
            <li key={idx} style={{ marginLeft: '1rem', color: 'var(--text-secondary)' }}>
              {parseBoldText(trimmed.slice(2))}
            </li>
          );
        }
        if (trimmed.startsWith('> ')) {
          return (
            <blockquote key={idx} style={{ borderLeft: '3px solid var(--accent-primary)', paddingLeft: '0.5rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: '0.25rem 0' }}>
              {trimmed.slice(2)}
            </blockquote>
          );
        }
        if (!trimmed) return <div key={idx} style={{ height: '0.2rem' }} />;
        return <p key={idx} style={{ margin: 0 }}>{parseBoldText(trimmed)}</p>;
      })}
    </div>
  );
};

const parseBoldText = (text: string) => {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return <strong key={index} style={{ color: '#fff', fontWeight: 700 }}>{part}</strong>;
    }
    return part;
  });
};

export const AiChat: React.FC<AiChatProps> = ({ analysis, holdings, setActiveTab }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [quota, setQuota] = useState(financeApi.getApiUsage());
  const [errorMsg, setErrorMsg] = useState('');
  const [useSearch, setUseSearch] = useState<boolean>(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize chat history and check API key
  useEffect(() => {
    const config = financeApi.getConfig();
    setApiKey(config.geminiApiKey);

    const savedChat = localStorage.getItem('portfolio_tracker_chat_history');
    if (savedChat) {
      try {
        setMessages(JSON.parse(savedChat));
      } catch (e) {
        console.error('Failed to load chat history', e);
        loadDefaultWelcomeMessage();
      }
    } else {
      loadDefaultWelcomeMessage();
    }

    const unsubscribeQuota = financeApi.subscribeQuota(() => {
      setQuota(financeApi.getApiUsage());
    });

    return () => {
      unsubscribeQuota();
    };
  }, []);

  const loadDefaultWelcomeMessage = () => {
    const welcomeMsg: ChatMessage = {
      role: 'model',
      text: `สวัสดีครับ! ผมคือ **SmartInvest AI Chatbot** ผู้ช่วยส่วนตัวด้านการวิเคราะห์การลงทุนของคุณ 📈 

ผมมีความรู้เกี่ยวกับการจัดสรรพอร์ต และเชื่อมต่อกับ **Google Search** เรียลไทม์ ทำให้สามารถช่วยคุณ:
- **วิเคราะห์โครงสร้างพอร์ตลงทุนปัจจุบัน** และประเมินความสมดุล
- **สืบค้นข้อมูลข่าวเศรษฐกิจ ข่าวหุ้น หรือราคาหน่วยลงทุน NAV** ล่าสุดในไทยและต่างประเทศ
- **ให้แนวทางกลยุทธ์การปรับสมดุลพอร์ต** ตามความต้องการของคุณ

วันนี้คุณต้องการให้ผมแนะนำข้อมูลข่าวสารหรือวิเคราะห์พอร์ตโฟลิโอของคุณตรงส่วนไหนไหมครับ?`
    };
    setMessages([welcomeMsg]);
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const saveChatHistory = (history: ChatMessage[]) => {
    setMessages(history);
    localStorage.setItem('portfolio_tracker_chat_history', JSON.stringify(history));
  };

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;
    setErrorMsg('');

    const config = financeApi.getConfig();
    if (!config.geminiApiKey) {
      setErrorMsg('กรุณากรอก Gemini API Key ในแท็บการตั้งค่าการเชื่อมต่อก่อนเริ่มพิมพ์แชท');
      return;
    }

    const newUserMsg: ChatMessage = { role: 'user', text: textToSend.trim() };
    const updatedMessages = [...messages, newUserMsg];
    
    // Add user message to display
    setMessages(updatedMessages);
    setInputText('');
    setLoading(true);

    try {
      const answer = await aiService.chatWithGemini(
        updatedMessages,
        analysis,
        holdings,
        config.geminiApiKey,
        useSearch
      );
      
      const newAiMsg: ChatMessage = { role: 'model', text: answer };
      saveChatHistory([...updatedMessages, newAiMsg]);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลจาก AI กรุณาลองอีกครั้ง');
      // Revert to history without the last message if failed or just keep it
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    if (window.confirm('คุณแน่ใจหรือไม่ที่จะล้างประวัติการคุยกับ AI ทั้งหมด?')) {
      localStorage.removeItem('portfolio_tracker_chat_history');
      loadDefaultWelcomeMessage();
      setErrorMsg('');
    }
  };

  const handleQuickQuestion = (question: string) => {
    handleSend(question);
  };

  if (!apiKey) {
    return (
      <div className="glass" style={{ padding: '3rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
        <div style={{ background: 'var(--accent-red-glow)', padding: '1rem', borderRadius: '50%', color: 'var(--accent-red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AlertCircle size={32} />
        </div>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>ยังไม่ได้เปิดใช้งานกล่องแชท AI</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', maxWidth: '500px', lineHeight: '1.5', margin: '0 auto' }}>
            ฟีเจอร์กล่องแชทโต้ตอบเรียลไทม์จำเป็นต้องใช้ **Gemini AI API Key** เพื่อประมวลคำตอบ กรุณาไปเปิดใช้งานฟรีได้ที่หน้าตั้งค่าระบบ
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setActiveTab('settings')}>
          ไปตั้งค่าเชื่อมต่อ API
        </button>
      </div>
    );
  }

  return (
    <div className="glass" style={{ height: '600px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
      {/* Chat Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: 'var(--accent-primary-glow)', padding: '0.4rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Cpu size={16} color="var(--accent-primary)" />
          </div>
          <div>
            <h4 style={{ fontWeight: 800, fontSize: '0.9rem' }}>SmartInvest AI Chatbot</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.675rem', color: 'var(--text-secondary)' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-green)', display: 'inline-block' }} />
              <span>โควต้าวันนี้: {quota.rpd} / {quota.maxRpd === Infinity ? '∞' : quota.maxRpd} RPD ({quota.rpm} RPM)</span>
            </div>
          </div>
        </div>

        <button 
          className="btn btn-secondary" 
          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderRadius: '6px', gap: '0.25rem', borderColor: 'transparent' }}
          onClick={handleClearChat}
          title="ล้างแชททั้งหมด"
        >
          <Trash2 size={12} /> ล้างประวัติแชท
        </button>
      </div>

      {/* Messages Window */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {messages.map((msg, i) => {
          const isAi = msg.role === 'model';
          return (
            <div 
              key={i} 
              style={{ 
                display: 'flex', 
                gap: '0.75rem', 
                alignSelf: isAi ? 'flex-start' : 'flex-end',
                maxWidth: '80%',
                flexDirection: isAi ? 'row' : 'row-reverse'
              }}
            >
              {/* Profile Icon */}
              <div 
                style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '50%', 
                  background: isAi ? 'var(--accent-primary-glow)' : 'var(--accent-blue-glow)',
                  border: `1px solid ${isAi ? 'rgba(139,92,246,0.15)' : 'rgba(2,132,199,0.15)'}`,
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                {isAi ? <Cpu size={14} color="var(--accent-primary)" /> : <User size={14} color="var(--accent-blue)" />}
              </div>

              {/* Chat Bubble */}
              <div 
                className="glass"
                style={{ 
                  padding: '0.75rem 1rem', 
                  borderRadius: '12px',
                  borderTopLeftRadius: isAi ? '4px' : '12px',
                  borderTopRightRadius: isAi ? '12px' : '4px',
                  background: isAi ? 'rgba(15, 23, 42, 0.4)' : 'rgba(139, 92, 246, 0.1)',
                  borderColor: isAi ? 'var(--border-color)' : 'rgba(139, 92, 246, 0.2)',
                  color: isAi ? 'var(--text-primary)' : '#fff'
                }}
              >
                <ChatMarkdown text={msg.text} />
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {loading && (
          <div style={{ display: 'flex', gap: '0.75rem', alignSelf: 'flex-start', maxWidth: '80%' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Cpu size={14} color="var(--accent-primary)" />
            </div>
            <div className="glass" style={{ padding: '0.75rem 1rem', borderRadius: '12px', borderTopLeftRadius: '4px', background: 'rgba(15,23,42,0.2)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <Loader className="spin" size={14} />
              <span>AI กำลังประมวลผลคำตอบและสืบค้นข้อมูลข่าวเรียลไทม์...</span>
            </div>
          </div>
        )}

        {errorMsg && (
          <div style={{ alignSelf: 'center', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--accent-red)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <AlertCircle size={14} />
            <span>{errorMsg}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Questions Helper */}
      {messages.length === 1 && !loading && (
        <div style={{ padding: '0.5rem 1.5rem', display: 'flex', gap: '0.5rem', overflowX: 'auto', borderTop: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.05)' }}>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', whiteSpace: 'nowrap', borderRadius: '6px' }}
            onClick={() => handleQuickQuestion('ช่วยประเมินสุขภาพพอร์ตของฉันตอนนี้หน่อย')}
          >
            📊 วิเคราะห์พอร์ตของฉัน
          </button>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', whiteSpace: 'nowrap', borderRadius: '6px' }}
            onClick={() => handleQuickQuestion('ข่าวเศรษฐกิจและการเงินโลกที่น่าสนใจวันนี้มีอะไรบ้าง?')}
          >
            📰 ข่าวการเงินเรียลไทม์วันนี้
          </button>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', whiteSpace: 'nowrap', borderRadius: '6px' }}
            onClick={() => handleQuickQuestion('แนะนำกองทุนกลุ่มเทคโนโลยีหรือกองทุนต่างประเทศที่น่าสนใจช่วงนี้หน่อย')}
          >
            💡 แนะนำกองทุนกลุ่ม Tech/ต่างประเทศ
          </button>
        </div>
      )}

      {/* Search Grounding Toggle */}
      <div style={{ padding: '0.4rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderTop: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.02)' }}>
        <input 
          type="checkbox" 
          id="use-search-grounding" 
          checked={useSearch}
          onChange={(e) => setUseSearch(e.target.checked)}
          style={{ cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
        />
        <label htmlFor="use-search-grounding" style={{ fontSize: '0.725rem', color: useSearch ? 'var(--accent-primary)' : 'var(--text-muted)', cursor: 'pointer', userSelect: 'none', fontWeight: 600 }}>
          🌐 เปิดใช้งาน Google Search Grounding (ค้นหาข้อมูลสดในอินเทอร์เน็ต - จำกัดโควต้า 1 ครั้งต่อนาที) <span style={{ color: '#f59e0b', marginLeft: '6px', fontWeight: 500 }}>(มีค่าบริการสืบค้นเพิ่มเติมประมาณ ~0.50 บาทต่อข้อความ)</span>
        </label>
      </div>

      {/* Input Bar */}
      <form 
        onSubmit={(e) => { e.preventDefault(); handleSend(inputText); }}
        style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '0.75rem', background: 'rgba(255,255,255,0.01)' }}
      >
        <input 
          type="text" 
          className="form-control"
          placeholder={loading ? 'กรุณารอ AI ประมวลผลคำตอบ...' : 'พิมพ์คำถามของคุณที่นี่... (เช่น ถามข่าว PTT ล่าสุด หรือราคากองทุน)'}
          style={{ flex: 1, borderRadius: '10px' }}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={loading}
        />
        <button 
          type="submit" 
          className="btn btn-primary" 
          style={{ borderRadius: '10px', width: '45px', padding: 0 }}
          disabled={loading || !inputText.trim()}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};
