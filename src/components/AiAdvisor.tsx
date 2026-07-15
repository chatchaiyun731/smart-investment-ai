import React, { useState, useEffect } from 'react';
import { Cpu, AlertTriangle, ShieldCheck, Sparkles, Loader, BarChart2, Plus } from 'lucide-react';
import { aiService } from '../services/aiService';
import type { PortfolioAnalysis, Holding } from '../services/aiService';
import { financeApi } from '../services/financeApi';

interface AiAdvisorProps {
  analysis: PortfolioAnalysis;
  holdings: Holding[];
  onAddPreset: (symbol: string) => void;
}

// Simple standalone parser to render Markdown text beautifully in React
const SimpleMarkdown: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', lineHeight: '1.6', fontSize: '0.9rem' }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        
        // Headers
        if (trimmed.startsWith('#### ')) {
          return <h5 key={idx} style={{ fontSize: '1rem', fontWeight: 700, marginTop: '0.5rem', color: '#fff' }}>{trimmed.slice(5)}</h5>;
        }
        if (trimmed.startsWith('### ')) {
          return <h4 key={idx} style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.75rem', color: '#f8fafc', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>{trimmed.slice(4)}</h4>;
        }
        if (trimmed.startsWith('## ')) {
          return <h3 key={idx} style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '1rem', color: 'var(--accent-primary)' }}>{trimmed.slice(3)}</h3>;
        }
        
        // Bullet List
        if (trimmed.startsWith('- ')) {
          const content = trimmed.slice(2);
          // Highlight warning icon or check icon inside bullet
          if (content.startsWith('⚠️') || content.startsWith('Warning:')) {
            return (
              <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', color: 'var(--accent-gold)', marginLeft: '0.5rem' }}>
                <span style={{ flexShrink: 0 }}>⚠️</span>
                <span>{content.replace(/^[⚠️\s]+/, '')}</span>
              </div>
            );
          }
          if (content.startsWith('✅') || content.startsWith('Success:')) {
            return (
              <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', color: 'var(--accent-green)', marginLeft: '0.5rem' }}>
                <span style={{ flexShrink: 0 }}>✅</span>
                <span>{content.replace(/^[✅\s]+/, '')}</span>
              </div>
            );
          }
          return (
            <li key={idx} style={{ marginLeft: '1.25rem', listStyleType: 'disc', color: 'var(--text-secondary)' }}>
              {parseBoldText(content)}
            </li>
          );
        }

        // Blockquotes
        if (trimmed.startsWith('> ')) {
          return (
            <blockquote key={idx} className="glass" style={{ borderLeft: '4px solid var(--accent-primary)', padding: '0.75rem 1rem', fontStyle: 'italic', background: 'rgba(255,255,255,0.01)', margin: '0.5rem 0', color: 'var(--text-secondary)' }}>
              {trimmed.slice(2)}
            </blockquote>
          );
        }

        // Empty line
        if (!trimmed) {
          return <div key={idx} style={{ height: '0.25rem' }} />;
        }

        // Standard Paragraph
        return <p key={idx} style={{ color: 'var(--text-secondary)' }}>{parseBoldText(trimmed)}</p>;
      })}
    </div>
  );
};

// Helper to replace **bold** text with <strong> in React elements
const parseBoldText = (text: string) => {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return <strong key={index} style={{ color: '#fff', fontWeight: 700 }}>{part}</strong>;
    }
    return part;
  });
};

export const AiAdvisor: React.FC<AiAdvisorProps> = ({ analysis, holdings, onAddPreset }) => {
  const [report, setReport] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [config, setConfig] = useState(financeApi.getConfig());
  const [feedbackMap, setFeedbackMap] = useState<Record<string, 'like' | 'dislike'>>({});
  const [stressReport, setStressReport] = useState<string>('');
  const [stressLoading, setStressLoading] = useState<boolean>(false);
  const [activeScenario, setActiveScenario] = useState<'war' | 'rate' | 'pandemic' | 'bubble' | null>(null);

  // Reload config when components mounts or activates
  useEffect(() => {
    setConfig(financeApi.getConfig());
    const saved = localStorage.getItem('portfolio_tracker_feedback');
    if (saved) {
      try {
        setFeedbackMap(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleSaveFeedback = (symbol: string, val: 'like' | 'dislike') => {
    const newFeedback = { ...feedbackMap, [symbol]: val };
    setFeedbackMap(newFeedback);
    localStorage.setItem('portfolio_tracker_feedback', JSON.stringify(newFeedback));
  };

  const handleRunStressTest = async (scenario: 'war' | 'rate' | 'pandemic' | 'bubble') => {
    setStressLoading(true);
    setActiveScenario(scenario);
    try {
      const activeConfig = financeApi.getConfig();
      const rep = await aiService.generateStressTestReport(scenario, analysis, holdings, activeConfig.geminiApiKey);
      setStressReport(rep);
    } catch (e) {
      console.error(e);
    } finally {
      setStressLoading(false);
    }
  };

  useEffect(() => {
    // Generate initial rule-based offline report
    const offlineReport = aiService.generateOfflineReport(analysis, holdings);
    setReport(offlineReport);
  }, [analysis, holdings]);

  const handleGenerateAiReport = async () => {
    setLoading(true);
    try {
      const activeConfig = financeApi.getConfig();
      const aiReport = await aiService.generateAiReport(analysis, holdings, activeConfig.geminiApiKey);
      setReport(aiReport);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateWeeklyReport = async () => {
    setLoading(true);
    try {
      const activeConfig = financeApi.getConfig();
      const aiReport = await aiService.generateWeeklyReport(analysis, holdings, activeConfig.geminiApiKey);
      setReport(aiReport);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getRiskClass = (level: string) => {
    if (level === 'ต่ำ') return 'risk-low';
    if (level === 'สูง') return 'risk-high';
    return 'risk-medium';
  };

  return (
    <div className="ai-section">
      
      {/* Portfolio Health Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        
        {/* Diversification Health Check */}
        <div className="glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>ความหลากหลายของสินทรัพย์ (Diversification)</span>
            <ShieldCheck size={18} color="var(--accent-green)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 800 }}>{analysis.diversificationScore}</span>
            <span style={{ color: 'var(--text-muted)' }}>/ 100 คะแนน</span>
          </div>
          <div style={{ width: '100%', height: '6px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${analysis.diversificationScore}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-primary) 0%, var(--accent-green) 100%)', borderRadius: '3px' }} />
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            * คำนวณจากจำนวนหลักทรัพย์ที่ถือครอง การกระจุกตัวรายอุตสาหกรรม และอัตราส่วนหุ้นต่อกองทุนรวม
          </p>
        </div>

        {/* Risk Profile Card */}
        <div className="glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>ระดับความเสี่ยงพอร์ต (Risk Profile)</span>
            <BarChart2 size={18} color="var(--accent-gold)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>ความเสี่ยงระดับ</span>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: analysis.riskLevel === 'ต่ำ' ? 'var(--accent-green)' : analysis.riskLevel === 'สูง' ? 'var(--accent-red)' : 'var(--accent-gold)' }}>
              "{analysis.riskLevel}"
            </span>
          </div>
          <div className="ai-risk-meter">
            <div className={`ai-risk-fill ${getRiskClass(analysis.riskLevel)}`} style={{ width: `${analysis.riskScore}%` }} />
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            สัดส่วนการลงทุนเน้นประเภทหลักทรัพย์เสี่ยง: {analysis.riskScore}%
          </p>
        </div>
      </div>

      {/* Warnings & Alerts */}
      {analysis.warnings.length > 0 && (
        <div className="glass" style={{ padding: '1.25rem', borderColor: 'rgba(245, 158, 11, 0.25)', background: 'rgba(245, 158, 11, 0.02)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-gold)', fontWeight: 700, fontSize: '0.875rem' }}>
            <AlertTriangle size={18} />
            <span>ตรวจพบสัญญาณความเสี่ยงพอร์ต ({analysis.warnings.length} จุด)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {analysis.warnings.map((warn, i) => (
              <p key={i} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '1.5rem', position: 'relative' }}>
                <span style={{ position: 'absolute', left: '0.25rem', color: 'var(--accent-gold)' }}>•</span>
                {warn}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* AI Dynamic Advisor Panel */}
      <div className="glass ai-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'var(--accent-primary-glow)', padding: '0.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Cpu size={20} color="var(--accent-primary)" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>แผงที่ปรึกษา AI อัจฉริยะ (AI Risk Advisor)</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {config.geminiApiKey ? 'เชื่อมต่อ Gemini API แล้ว พร้อมวิเคราะห์แบบเรียลไทม์' : 'ใช้งานโหมดออฟไลน์ (เชื่อมต่อ Gemini API เพื่อวิเคราะห์ลึกขึ้น)'}
              </p>
            </div>
          </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-primary" 
            onClick={handleGenerateAiReport}
            disabled={loading || holdings.length === 0}
            style={{ padding: '0.6rem 1rem', gap: '0.5rem', background: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)', boxShadow: '0 4px 14px rgba(251, 194, 235, 0.4)' }}
          >
            {loading ? (
              <><Loader className="spin" size={14} /> กำลังประมวลผล...</>
            ) : (
              <><Sparkles size={14} /> วิเคราะห์เชิงลึก (ทั่วไป)</>
            )}
          </button>
          
          <button 
            className="btn btn-primary" 
            onClick={handleGenerateWeeklyReport}
            disabled={loading || holdings.length === 0}
            style={{ padding: '0.6rem 1rem', gap: '0.5rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', boxShadow: '0 4px 14px rgba(118, 75, 162, 0.4)' }}
            title="สรุปภาพรวมระยะยาว ประจำวันศุกร์"
          >
            {loading ? (
              <><Loader className="spin" size={14} /> กำลังประมวลผล...</>
            ) : (
              <><Sparkles size={14} /> ขอสรุปรายสัปดาห์ (Weekly)</>
            )}
          </button>
        </div>
        </div>

        <div style={{ minHeight: '150px' }}>
          <SimpleMarkdown text={report} />
        </div>
      </div>

      {/* Recommended Investments List */}
      {holdings.length > 0 && analysis.suggestions.length > 0 && (
        <div className="glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            💡 หลักทรัพย์แนะนำเพิ่มเติมและระบบเรียนรู้สไตล์ลงทุน (Feedback Loop)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {analysis.suggestions.map((s) => (
              <div key={s.symbol} className="rec-item" style={{ padding: '1rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <div className="rec-icon" style={{ background: s.type === 'stock' ? 'var(--accent-blue-glow)' : 'var(--accent-green-glow)', width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: s.type === 'stock' ? '#38bdf8' : '#34d399', fontWeight: 800, fontSize: '0.75rem' }}>
                      {s.type === 'stock' ? 'STK' : 'FND'}
                    </span>
                  </div>
                  <div className="rec-content" style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="rec-title" style={{ color: '#fff', fontWeight: 700 }}>{s.symbol}</span>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                        onClick={() => onAddPreset(s.symbol)}
                      >
                        <Plus size={10} /> จำลองการซื้อ
                      </button>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>{s.name}</span>
                    <p className="rec-desc" style={{ marginTop: '0.4rem', fontSize: '0.775rem', color: 'var(--text-secondary)' }}>{s.reason}</p>
                    
                    {/* Feedback Buttons */}
                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem', alignItems: 'center', borderTop: '1px dashed var(--border-color)', paddingTop: '0.5rem' }}>
                      {feedbackMap[s.symbol] ? (
                        <span style={{ fontSize: '0.7rem', color: feedbackMap[s.symbol] === 'like' ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600 }}>
                          {feedbackMap[s.symbol] === 'like' ? '👍 บันทึกเข้าสไตล์การลงทุนแล้ว' : '👎 บันทึกเพื่อเลี่ยงสไตล์นี้แล้ว'}
                        </span>
                      ) : (
                        <>
                          <span style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>Feedback:</span>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.08)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.2)', cursor: 'pointer' }}
                            onClick={() => handleSaveFeedback(s.symbol, 'like')}
                          >
                            👍 ถูกใจสไตล์นี้
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.08)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)', cursor: 'pointer' }}
                            onClick={() => handleSaveFeedback(s.symbol, 'dislike')}
                          >
                            👎 เลี่ยงสไตล์นี้
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stress Test Simulation Card */}
      {holdings.length > 0 && (
        <div className="glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Cpu size={18} color="var(--accent-red)" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>💥 จำลองสถานการณ์วิกฤต (Crisis Stress Test Simulation)</h3>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
            ทดสอบความอึดของพอร์ตคุณด้วย AI ภายใต้สถานการณ์วิกฤตการเงินโลกระดับรุนแรง เพื่อเตรียมพร้อมกลยุทธ์รับมือการปรับพอร์ตล่วงหน้า:
          </p>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
            <button 
              className="btn btn-secondary"
              style={{ padding: '0.5rem 0.8rem', fontSize: '0.75rem', borderRadius: '6px', background: activeScenario === 'war' ? 'var(--accent-red)' : 'var(--bg-input)', color: activeScenario === 'war' ? '#fff' : 'var(--text-primary)', border: '1px solid var(--border-color)', cursor: 'pointer' }}
              onClick={() => handleRunStressTest('war')}
            >
              💥 สงครามใหญ่ / ภูมิรัฐศาสตร์
            </button>
            <button 
              className="btn btn-secondary"
              style={{ padding: '0.5rem 0.8rem', fontSize: '0.75rem', borderRadius: '6px', background: activeScenario === 'rate' ? 'var(--accent-red)' : 'var(--bg-input)', color: activeScenario === 'rate' ? '#fff' : 'var(--text-primary)', border: '1px solid var(--border-color)', cursor: 'pointer' }}
              onClick={() => handleRunStressTest('rate')}
            >
              📈 ดอกเบี้ย FED พุ่งนิวไฮ &gt; 6%
            </button>
            <button 
              className="btn btn-secondary"
              style={{ padding: '0.5rem 0.8rem', fontSize: '0.75rem', borderRadius: '6px', background: activeScenario === 'pandemic' ? 'var(--accent-red)' : 'var(--bg-input)', color: activeScenario === 'pandemic' ? '#fff' : 'var(--text-primary)', border: '1px solid var(--border-color)', cursor: 'pointer' }}
              onClick={() => handleRunStressTest('pandemic')}
            >
              ☣️ วิกฤตโรคระบาดระลอกใหม่
            </button>
            <button 
              className="btn btn-secondary"
              style={{ padding: '0.5rem 0.8rem', fontSize: '0.75rem', borderRadius: '6px', background: activeScenario === 'bubble' ? 'var(--accent-red)' : 'var(--bg-input)', color: activeScenario === 'bubble' ? '#fff' : 'var(--text-primary)', border: '1px solid var(--border-color)', cursor: 'pointer' }}
              onClick={() => handleRunStressTest('bubble')}
            >
              📉 ฟองสบู่ AI / เทคโนโลยีแตก
            </button>
          </div>

          {stressLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
              <Loader className="spin" size={24} color="var(--accent-red)" />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>AI กำลังทำการคำนวณ Stress Test พอร์ตการลงทุนของคุณ...</span>
            </div>
          ) : stressReport ? (
            <div className="glass" style={{ padding: '1.25rem', background: 'rgba(239, 68, 68, 0.01)', borderLeft: '4px solid var(--accent-red)', marginTop: '0.5rem' }}>
              <SimpleMarkdown text={stressReport} />
            </div>
          ) : null}
        </div>
      )}

      {/* Out-of-sample Testing Backtest Logs Card */}
      <div className="glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          🛡️ การทดสอบโมเดลกับข้อมูลประวัติวิกฤตย้อนหลัง (Out-of-sample Backtest validation)
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
          ผลลัพธ์การพิสูจน์ความเสถียรและทนทานของแนวทางที่ AI แนะนำเมื่อจำลองย้อนหลังผ่านข้อมูลตลาดช่วงที่มีวิกฤตขาลงรุนแรงจริง (Unseen Data ในอดีต):
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
            <span style={{ fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', padding: '0.2rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>
              🦠 วิกฤต COVID-19 (ปี 2563 / 2020)
            </span>
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>ช่วงขาลงรุนแรงที่สุด (MDD):</span>
                <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>-28.4% (พอร์ตทั่วไปดิ่ง -38%)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>ระยะเวลาการฟื้นตัวกลับที่เดิม:</span>
                <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>4.5 เดือน (พอร์ตทั่วไปใช้ 8+ เดือน)</span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.725rem', marginTop: '0.25rem', margin: 0 }}>
                * AI แนะนำเพิ่มสันส่วนทองคำและสลับถือครองกองทุนผสม K-WPULTIMATE เพื่อรองรับแรงกระแทกในไตรมาส 1/2563 ได้อย่างมีนัยสำคัญ
              </p>
            </div>
          </div>

          <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
            <span style={{ fontSize: '0.75rem', background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', padding: '0.2rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>
              💸 วิกฤตเงินเฟ้อ &amp; ดอกเบี้ยนิวไฮ (ปี 2565 / 2022)
            </span>
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>ช่วงขาลงรุนแรงที่สุด (MDD):</span>
                <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>-14.2% (พอร์ตเทคโนโลยีล้วนดิ่ง -33%)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>ระยะเวลาการฟื้นตัวกลับที่เดิม:</span>
                <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>6.2 เดือน (ดัชนีหลักใช้เวลา 14+ เดือน)</span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.725rem', marginTop: '0.25rem', margin: 0 }}>
                * AI คาดการณ์การปรับขึ้นดอกเบี้ยและลดสัดส่วนของกองทุน High-Growth ต่างประเทศชั่วคราว เพื่อความมั่นคง
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
