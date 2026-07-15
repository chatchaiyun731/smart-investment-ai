import React, { useState, useEffect, useRef } from 'react';
import { Settings, Key, HelpCircle, Save, CheckCircle, AlertTriangle, Download, Upload, Database, Activity } from 'lucide-react';
import { financeApi } from '../services/financeApi';
import type { ApiConfig } from '../services/financeApi';

interface ApiSettingsProps {
  onConfigChange?: () => void;
}

export const ApiSettings: React.FC<ApiSettingsProps> = ({ onConfigChange }) => {
  const [config, setConfig] = useState<ApiConfig>({
    useMock: true,
    secApiKey: '',
    yahooApiKey: '',
    geminiApiKey: '',
    selectedModel: 'flash',
    billingTier: 'free',
    useFreePriceMode: true
  });
  const [quota, setQuota] = useState(financeApi.getApiUsage());
  const [isSaved, setIsSaved] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [customModelInput, setCustomModelInput] = useState('');
  const [fetchError, setFetchError] = useState<string | null>(null);

  const handleExportBackup = () => {
    const holdings = localStorage.getItem('portfolio_tracker_holdings') || '[]';
    const apiConfig = localStorage.getItem('portfolio_tracker_api_config') || '{}';
    const chatHistory = localStorage.getItem('portfolio_tracker_chat_history') || '[]';
    const customAssets = localStorage.getItem('portfolio_tracker_custom_assets') || '{}';

    const backupData = {
      holdings: JSON.parse(holdings),
      apiConfig: JSON.parse(apiConfig),
      chatHistory: JSON.parse(chatHistory),
      customAssets: JSON.parse(customAssets),
      exportedAt: new Date().toISOString(),
      version: '1.0.1'
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `smartinvest_portfolio_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const file = e.target.files?.[0];
    if (!file) return;

    fileReader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        
        if (!parsed.holdings || !Array.isArray(parsed.holdings)) {
          alert('รูปแบบไฟล์สำรองข้อมูลไม่ถูกต้อง กรุณาเลือกไฟล์ .json ของ SmartInvest ที่ถูกต้อง');
          return;
        }

        if (window.confirm('คำเตือน: การนำเข้าข้อมูลสำรองนี้จะไปแทนที่ข้อมูลพอร์ตปัจจุบันของคุณทั้งหมดในเครื่องนี้ คุณต้องการดำเนินการต่อหรือไม่?')) {
          localStorage.setItem('portfolio_tracker_holdings', JSON.stringify(parsed.holdings));
          
          if (parsed.apiConfig) {
            // ดึงค่าการตั้งค่าปัจจุบันในเครื่องนี้
            const currentConfigStr = localStorage.getItem('portfolio_tracker_api_config');
            let current = { geminiApiKey: '', useMock: false, selectedModel: 'gemini-3.1-flash-lite', billingTier: 'free' };
            if (currentConfigStr) {
              try {
                current = { ...current, ...JSON.parse(currentConfigStr) };
              } catch (e) {
                // Ignore
              }
            }
            
            // ล็อกคีย์ API และโหมดจำลองราคาของเครื่องนี้ไว้เสมอ ห้ามนำข้อมูลคีย์เก่าในไฟล์ backup มาทับเด็ดขาด
            const mergedConfig = {
              ...parsed.apiConfig,
              geminiApiKey: current.geminiApiKey,
              useMock: current.useMock,
              selectedModel: current.selectedModel,
              billingTier: current.billingTier
            };
            localStorage.setItem('portfolio_tracker_api_config', JSON.stringify(mergedConfig));
          }
          if (parsed.chatHistory) {
            localStorage.setItem('portfolio_tracker_chat_history', JSON.stringify(parsed.chatHistory));
          }
          if (parsed.customAssets) {
            localStorage.setItem('portfolio_tracker_custom_assets', JSON.stringify(parsed.customAssets));
          }
          
          alert('นำเข้าและกู้คืนข้อมูลพอร์ตสำเร็จแล้ว! กำลังโหลดหน้าเว็บใหม่...');
          window.location.reload();
        }
      } catch (err) {
        console.error(err);
        alert('ไม่สามารถอ่านไฟล์สำรองได้ กรุณาตรวจสอบว่าไฟล์ไม่ใช่ไฟล์ที่ชำรุดเสียหาย');
      }
    };
    fileReader.readAsText(file);
  };

  useEffect(() => {
    const loadedConfig = financeApi.getConfig();
    setConfig(loadedConfig);

    const presets = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-3.5-flash', 'gemini-3.1-pro', 'gemini-3.1-flash-lite'];
    if (presets.includes(loadedConfig.selectedModel)) {
      setIsCustomModel(false);
    } else {
      setIsCustomModel(true);
      setCustomModelInput(loadedConfig.selectedModel);
    }

    const unsubscribeQuota = financeApi.subscribeQuota(() => {
      setQuota(financeApi.getApiUsage());
    });

    // ตรวจหาข้อผิดพลาดจากการดึงราคาจริงในเบื้องหลัง
    const checkFetchError = () => {
      setFetchError(localStorage.getItem('portfolio_tracker_price_fetch_error'));
    };
    checkFetchError();

    const interval = setInterval(() => {
      setQuota(financeApi.getApiUsage());
      checkFetchError();
    }, 5000);

    return () => {
      unsubscribeQuota();
      clearInterval(interval);
    };
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const finalConfig = {
      ...config,
      selectedModel: isCustomModel ? customModelInput.trim() : config.selectedModel
    };
    financeApi.saveConfig(finalConfig);
    setIsSaved(true);
    if (onConfigChange) onConfigChange();
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="glass" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Settings size={22} color="var(--accent-primary)" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>การตั้งค่าเชื่อมต่อ API & AI</h2>
        </div>
        <button 
          className="btn btn-secondary" 
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
          onClick={() => setShowHelp(!showHelp)}
          type="button"
        >
          <HelpCircle size={14} /> {showHelp ? 'ซ่อนคู่มือ' : 'วิธีขอ API Key'}
        </button>
      </div>

      {showHelp && (
        <div className="glass" style={{ background: 'rgba(139, 92, 246, 0.05)', padding: '1rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.825rem', lineHeight: '1.5' }}>
          <h4 style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>💡 แหล่งข้อมูลขอ API Key:</h4>
          <p>
            1. **Gemini AI API Key**: ใช้ประมวลผลคำแนะนำการเงินเชิงลึกและสรุปข้อมูลพอร์ตของคุณเป็นภาษาไทยที่เป็นธรรมชาติ ขอรับคีย์ฟรีได้ที่ 
            <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', marginLeft: '4px', textDecoration: 'underline' }}>Google AI Studio</a>
          </p>
          <p>
            2. **SEC Open API (กองทุนรวม)**: เพื่อดึงราคา NAV กองทุนไทยจากสำนักงาน ก.ล.ต. ลงทะเบียนที่ 
            <a href="https://api.sec.or.th/" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', marginLeft: '4px', textDecoration: 'underline' }}>SEC Open API Portal</a>
          </p>
          <p>
            3. **Yahoo Finance API (หุ้นต่างประเทศ)**: เพื่อเชื่อมโยงดึงข้อมูลราคาหุ้นเรียลไทม์ต่างประเทศ สามารถสมัครและขอ API Key ได้จากผู้ให้บริการ API ต่างๆ เช่น RapidAPI (Yahoo Finance API) หรือ Alpha Vantage
          </p>
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Gemini Price Fetching Error Notice */}
        {fetchError && (
          <div className="glass" style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: 'var(--accent-red)', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
              <AlertTriangle size={16} />
              <span>แจ้งเตือนระบบดึงราคาตลาดจริงขัดข้อง:</span>
            </div>
            <p style={{ wordBreak: 'break-all', opacity: 0.9 }}>{fetchError}</p>
            <p style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '0.2rem' }}>* ระบบแอปจะสลับไปแสดงราคาทุนเฉลี่ยชั่วคราวเพื่อป้องกันไม่ให้มูลค่าพอร์ตเป็น 0 หากข้อผิดพลาดนี้ยังไม่ได้รับการแก้ไข</p>
          </div>
        )}

        {/* API Quota Usage Tracker Panel */}
        {config.geminiApiKey && (
          <div className="glass" style={{ padding: '1.25rem', background: 'rgba(139, 92, 246, 0.02)', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid rgba(139, 92, 246, 0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={16} color="var(--accent-primary)" />
                <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>อัตราการเรียกใช้โควต้า AI (Gemini API Quota Tracker)</span>
              </div>
              <span className="badge badge-stock" style={{ background: 'var(--accent-primary-glow)', color: 'var(--accent-primary)' }}>{quota.modelName}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '0.25rem' }}>
              {/* RPM meter */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>ความถี่การเรียกใช้ต่อนาที (RPM)</span>
                  <span style={{ fontWeight: 700, color: quota.rpm >= quota.maxRpm ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                    {quota.rpm} / {quota.maxRpm === Infinity ? '∞' : quota.maxRpm} RPM
                  </span>
                </div>
                <div style={{ height: '6px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${quota.maxRpm === Infinity ? 0 : Math.min(100, (quota.rpm / quota.maxRpm) * 100)}%`, 
                    height: '100%', 
                    background: quota.rpm >= quota.maxRpm ? 'var(--accent-red)' : 'var(--accent-primary)', 
                    borderRadius: '3px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>

              {/* RPD meter */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>โควต้าการใช้งานวันนี้ (RPD)</span>
                  <span style={{ fontWeight: 700 }}>
                    {quota.rpd} / {quota.maxRpd === Infinity ? '∞' : quota.maxRpd} RPD
                  </span>
                </div>
                <div style={{ height: '6px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${quota.maxRpd === Infinity ? 0 : Math.min(100, (quota.rpd / quota.maxRpd) * 100)}%`, 
                    height: '100%', 
                    background: 'var(--accent-blue)', 
                    borderRadius: '3px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            </div>
            
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>
              * สถานะบัญชี: **{quota.tierName}** {!quota.isPaid ? '(แนะนำใช้รุ่น Gemini 2.5 Flash เพื่อความเสถียรและจำกัดความเร็ว 15 RPM)' : '(โหมดชำระเงิน - ปลดล็อคโควต้าความถี่)'}
            </p>
          </div>
        )}

        {/* Model Selection and Billing Tier */}
        <div className="form-row">
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              เลือกรุ่นโมเดล AI (Gemini Model)
            </label>
            <select 
              className="form-control" 
              value={isCustomModel ? 'CUSTOM' : config.selectedModel}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'CUSTOM') {
                  setIsCustomModel(true);
                  if (!customModelInput) setCustomModelInput(config.selectedModel);
                } else {
                  setIsCustomModel(false);
                  setConfig({ ...config, selectedModel: val });
                }
              }}
            >
              <option value="gemini-2.5-flash">Gemini 2.5 Flash (แนะนำ - เร็ว เสถียร ประหยัด)</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro (ฉลาด ละเอียดรอบคอบ)</option>
              <option value="gemini-1.5-flash">Gemini 1.5 Flash (มาตรฐานทั่วไป)</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro (รุ่นดั้งเดิมความสามารถสูง)</option>
              <option value="gemini-3.5-flash">Gemini 3.5 Flash (หรือเวอร์ชันล่าสุด)</option>
              <option value="gemini-3.1-pro">Gemini 3.1 Pro (เวอร์ชันล่าสุดพรีเมียม)</option>
              <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite (รุ่นฟรีสูงสุด)</option>
              <option value="CUSTOM">➕ ระบุชื่อรุ่นโมเดลเอง (Custom Model Name)</option>
            </select>
            
            {isCustomModel && (
              <input 
                type="text" 
                className="form-control" 
                style={{ marginTop: '0.5rem' }}
                placeholder="ป้อนชื่อรุ่น เช่น gemini-3.5-flash"
                value={customModelInput}
                onChange={(e) => setCustomModelInput(e.target.value)}
              />
            )}
          </div>
          
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ระดับการชำระเงิน API (Billing Tier)
            </label>
            <select 
              className="form-control" 
              value={config.billingTier}
              onChange={(e) => setConfig({ ...config, billingTier: e.target.value as 'free' | 'paid' })}
            >
              <option value="free">Free Tier (โหมดใช้งานฟรีตามลิมิต Google)</option>
              <option value="paid">Pay-as-you-go (โหมดเสียเงินตามจริง - ปลดล็อคลิมิต)</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <input 
              type="checkbox" 
              checked={config.useMock}
              onChange={(e) => setConfig({ ...config, useMock: e.target.checked })}
              style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
            />
            เปิดใช้งานโหมดจำลองราคาเรียลไทม์ (Simulated Real-time Price Engine)
          </label>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '1.5rem' }}>
            * แนะนำให้เปิดใช้งานโหมดจำลองนี้ไว้เพื่อให้ระบบทำงานได้อย่างไหลลื่นแบบเรียลไทม์ โดยจะจำลองการผันผวนของราคาหุ้นและกองทุนทุกๆ 4 วินาที
          </p>
        </div>

        <div className="form-group" style={{ marginTop: '0.75rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <input 
              type="checkbox" 
              checked={config.useFreePriceMode ?? true}
              onChange={(e) => setConfig({ ...config, useFreePriceMode: e.target.checked })}
              style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
            />
            เปิดใช้งานโหมดดึงราคาตลาดจริงแบบฟรี (Free Price Fetching - ไม่หักเงินในบัญชี)
          </label>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '1.5rem' }}>
            * แนะนำให้เปิดไว้! ระบบจะดึงราคาหุ้นและกองทุนจาก Yahoo Finance และ NAV Finnomena โดยตรง ซึ่งฟรี 100% (เก็บยอดเงินเติม 400 บาทของคุณไว้เฉพาะตอนแชทคุยและให้ AI ตรวจพอร์ตเท่านั้น)
          </p>
        </div>

        {!config.useMock && (
          <div className="glass" style={{ padding: '1rem', border: '1px solid rgba(245, 158, 11, 0.2)', background: 'rgba(245, 158, 11, 0.03)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <AlertTriangle color="var(--accent-gold)" size={20} style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
              <p style={{ fontWeight: 700, color: 'var(--accent-gold)' }}>ข้อควรระวังเกี่ยวกับการเชื่อมต่อ API จริง:</p>
              <p style={{ color: 'var(--text-secondary)' }}>
                การเชื่อมต่อ API ราคาหุ้นและกองทุนจริงบนเบราว์เซอร์ฝั่งไคลเอนต์โดยตรง (Client-side) อาจติดเงื่อนไขความปลอดภัย CORS ของผู้ให้บริการ การเรียกใช้ในขั้นโปรดักชันควรเรียกผ่าน Backend Proxy Server
              </p>
            </div>
          </div>
        )}

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Key size={14} /> Gemini AI API Key (ประมวลรายงานวิเคราะห์พอร์ต)
          </label>
          <input 
            type="password" 
            className="form-control" 
            placeholder="ป้อน API Key ของคุณที่นี่ (AI Studio key)..."
            value={config.geminiApiKey}
            onChange={(e) => setConfig({ ...config, geminiApiKey: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Key size={14} /> SEC Thailand API Key (ข้อมูล NAV กองทุนรวม)
          </label>
          <input 
            type="password" 
            className="form-control" 
            placeholder="ป้อน API Subscription Key ของ ก.ล.ต. ..."
            value={config.secApiKey}
            disabled={config.useMock}
            onChange={(e) => setConfig({ ...config, secApiKey: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Key size={14} /> Yahoo Finance API Key (หุ้นทั่วโลก)
          </label>
          <input 
            type="password" 
            className="form-control" 
            placeholder="ป้อน API Key สำหรับข้อมูลหุ้น..."
            value={config.yahooApiKey}
            disabled={config.useMock}
            onChange={(e) => setConfig({ ...config, yahooApiKey: e.target.value })}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button type="submit" className="btn btn-primary" style={{ minWidth: '150px' }}>
            {isSaved ? (
              <>
                <CheckCircle size={18} /> บันทึกการตั้งค่าแล้ว
              </>
            ) : (
              <>
                <Save size={18} /> บันทึกการตั้งค่า
              </>
            )}
          </button>
        </div>
      </form>

      {/* Backup & Restore Section */}
      <hr style={{ margin: '2rem 0', border: 'none', borderTop: '1px solid var(--border-color)' }} />
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Database size={20} color="var(--accent-primary)" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>สำรองและกู้คืนข้อมูลพอร์ต (Backup & Restore)</h3>
        </div>
        
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
          ข้อมูลพอร์ตการลงทุนและการตั้งค่าของคุณทั้งหมดจะถูกบันทึกไว้ในเบราว์เซอร์เครื่องนี้เท่านั้น คุณสามารถดาวน์โหลดไฟล์สำรองข้อมูล (ไฟล์ JSON) เก็บไว้ในคอมพิวเตอร์ หรือนำไปเก็บต่อใน **Google Drive** ของคุณ เพื่อนำกลับมากู้คืนข้อมูลได้ทุกเมื่อ (เช่น กรณีเปลี่ยนเครื่อง หรืออัปเดตเวอร์ชันแอปแล้วข้อมูลหาย)
        </p>
        
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={handleExportBackup} type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <Download size={16} /> ดาวน์โหลดไฟล์สำรองข้อมูล (.json)
          </button>
          
          <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <Upload size={16} /> นำเข้าไฟล์สำรองเพื่อกู้คืนข้อมูล
          </button>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            accept=".json" 
            onChange={handleImportBackup} 
          />
        </div>
      </div>
    </div>
  );
};
