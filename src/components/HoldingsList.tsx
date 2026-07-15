import React, { useState, useEffect } from 'react';
import { Edit3, Trash2, TrendingUp, TrendingDown, Layers, Landmark, Download, Bot, Loader } from 'lucide-react';
import { financeApi, type Asset } from '../services/financeApi';
import { aiService, type Holding, type ScanResult } from '../services/aiService';

interface HoldingsListProps {
  holdings: Holding[];
  currentPrices: Record<string, Asset>;
  updatedSymbol: string | null;
  onEdit: (holding: Holding) => void;
  onDelete: (id: string) => void;
}

export const HoldingsList: React.FC<HoldingsListProps> = ({
  holdings,
  currentPrices,
  updatedSymbol,
  onEdit,
  onDelete
}) => {
  const [flashStates, setFlashStates] = useState<Record<string, 'up' | 'down' | null>>({});
  const [filterType, setFilterType] = useState<'all' | 'real' | 'reference'>('all');
  const [scanResults, setScanResults] = useState<Record<string, ScanResult> | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState('');

  const filteredHoldings = holdings.filter(h => {
    if (filterType === 'all') return true;
    const type = h.holdingType || 'real';
    return type === filterType;
  });

  useEffect(() => {
    if (updatedSymbol) {
      const asset = currentPrices[updatedSymbol];
      if (asset) {
        const direction = asset.changePercent >= 0 ? 'up' : 'down';
        setFlashStates(prev => ({ ...prev, [updatedSymbol]: direction }));
        
        // Remove flash class after animation completes
        const timer = setTimeout(() => {
          setFlashStates(prev => ({ ...prev, [updatedSymbol]: null }));
        }, 1200);

        return () => clearTimeout(timer);
      }
    }
  }, [updatedSymbol, currentPrices]);

  const handleExportCSV = () => {
    const headers = ['ชื่อสินทรัพย์', 'จำนวนหน่วยที่ถือ', 'ต้นทุนเฉลี่ย (บาท)', 'ราคาปัจจุบัน (บาท)', 'กำไร/ขาดทุน (บาท)', 'กำไร/ขาดทุน (%)'];
    
    const rows = filteredHoldings.map(holding => {
      const symbol = holding.symbol.toUpperCase();
      const asset = currentPrices[symbol];
      const currentPrice = asset ? asset.price : holding.avgCost;
      const costValue = holding.quantity * holding.avgCost;
      const marketValue = holding.quantity * currentPrice;
      const gainLoss = marketValue - costValue;
      const gainLossPercent = costValue > 0 ? (gainLoss / costValue) * 100 : 0;
      
      return [
        symbol,
        holding.quantity,
        holding.avgCost.toFixed(4),
        currentPrice.toFixed(4),
        gainLoss.toFixed(2),
        `${gainLossPercent.toFixed(2)}%`
      ].join(',');
    });
    
    // Add BOM for Excel UTF-8 support
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `portfolio_summary_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleScan = async () => {
    setIsScanning(true);
    setScanError('');
    try {
      const config = financeApi.getConfig();
      const results = await aiService.scanHoldings(filteredHoldings, currentPrices, config.geminiApiKey);
      
      // Normalize results keys to uppercase to prevent case mismatches
      const normalizedResults: Record<string, ScanResult> = {};
      if (results) {
        Object.keys(results).forEach(key => {
          normalizedResults[key.toUpperCase()] = results[key];
        });
      }
      setScanResults(normalizedResults);
    } catch (err: any) {
      setScanError(err.message);
    } finally {
      setIsScanning(false);
    }
  };

  if (holdings.length === 0) {
    return (
      <div className="glass" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>ยังไม่มีรายการลงทุนในพอร์ตของคุณ</p>
        <p style={{ fontSize: '0.825rem' }}>กดปุ่ม "เพิ่มรายการซื้อขาย" ด้านบน เพื่อจำลองพอร์ตโฟลิโอของคุณและเริ่มวิเคราะห์ความเสี่ยง</p>
      </div>
    );
  }

  return (
    <div className="holdings-card glass">
      <div className="holdings-header">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>รายการสินทรัพย์ทั้งหมดในพอร์ต</h3>
        
        <div className="holdings-actions">
          <div className="holdings-filters">
            <button 
              className={`btn`} 
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.725rem', borderRadius: '4px', border: 'none', background: filterType === 'all' ? 'var(--accent-primary)' : 'transparent', color: filterType === 'all' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}
              onClick={() => setFilterType('all')}
            >
              แสดงทั้งหมด ({holdings.length})
            </button>
            <button 
              className={`btn`} 
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.725rem', borderRadius: '4px', border: 'none', background: filterType === 'real' ? 'var(--accent-primary)' : 'transparent', color: filterType === 'real' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}
              onClick={() => setFilterType('real')}
            >
              💼 ลงทุนจริง ({holdings.filter(h => (h.holdingType || 'real') === 'real').length})
            </button>
            <button 
              className={`btn`} 
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.725rem', borderRadius: '4px', border: 'none', background: filterType === 'reference' ? 'var(--accent-blue)' : 'transparent', color: filterType === 'reference' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}
              onClick={() => setFilterType('reference')}
            >
              🔍 จำลอง/อ้างอิง ({holdings.filter(h => h.holdingType === 'reference').length})
            </button>
          </div>
          <button 
            className="btn btn-secondary action-btn" 
            style={{ padding: '0.3rem 0.6rem', fontSize: '0.725rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={handleExportCSV}
            title="ดาวน์โหลดตารางสรุปพอร์ตเป็นไฟล์ Excel"
          >
            <Download size={14} /> ส่งออก Excel (CSV)
          </button>
          <button 
            className="btn btn-primary action-btn" 
            style={{ padding: '0.3rem 0.6rem', fontSize: '0.725rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)', border: 'none', color: '#1a1a2e', fontWeight: 600 }}
            onClick={handleScan}
            disabled={isScanning || filteredHoldings.length === 0}
            title="สแกนหาจุดซื้อ/ขายด้วย AI"
          >
            {isScanning ? <Loader size={14} className="spin" /> : <Bot size={14} />}
            สแกนหาจุดซื้อ/ขาย
          </button>
        </div>
      </div>
      
      {scanError && (
        <div style={{ fontSize: '0.8rem', color: 'var(--accent-red)', padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px' }}>
          {scanError}
        </div>
      )}
      {scanResults && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <span>🤖</span> สัญลักษณ์เหล่านี้เป็นการประเมินจากโมเดล AI เบื้องต้น โปรดพิจารณาควบคู่กับแผนการลงทุนของคุณ (ชี้เมาส์ที่สัญลักษณ์เพื่อดูเหตุผล)
        </div>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>สินทรัพย์</th>
              <th>ชื่อเต็ม / กลุ่มธุรกิจ</th>
              <th>ประเภทพอร์ต</th>
              <th>จำนวนหน่วย</th>
              <th>ราคาเฉลี่ย</th>
              <th>ราคาปัจจุบัน</th>
              <th>มูลค่ารวม</th>
              <th>กำไร / ขาดทุน</th>
              <th style={{ textAlign: 'right' }}>เครื่องมือ</th>
            </tr>
          </thead>
          <tbody>
            {filteredHoldings.map(holding => {
              const symbol = holding.symbol.toUpperCase();
              const asset = currentPrices[symbol];
              
              const currentPrice = asset ? asset.price : holding.avgCost;
              const marketValue = holding.quantity * currentPrice;
              const costValue = holding.quantity * holding.avgCost;
              const gainLoss = marketValue - costValue;
              const gainLossPercent = costValue > 0 ? (gainLoss / costValue) * 100 : 0;
              const isProfit = gainLoss >= 0;
              
              const flash = flashStates[symbol];
              const flashClass = flash === 'up' 
                ? 'price-flash-up' 
                : flash === 'down' 
                ? 'price-flash-down' 
                : '';

              return (
                <tr key={holding.id}>
                  {/* Symbol with Badge */}
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.95rem', letterSpacing: '-0.02em' }}>{symbol}</span>
                      <span className={`badge ${asset?.type === 'stock' ? 'badge-stock' : 'badge-fund'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        {asset?.type === 'stock' ? (
                          <Layers size={10} style={{ display: 'inline' }} />
                        ) : (
                          <Landmark size={10} style={{ display: 'inline' }} />
                        )}
                        {asset?.type === 'stock' ? 'หุ้น' : 'กองทุน'}
                      </span>
                      {scanResults && scanResults[symbol] && (
                        <span 
                          title={scanResults[symbol].reason} 
                          style={{ cursor: 'help', fontSize: '0.75rem', marginTop: '0.1rem', background: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.3rem', borderRadius: '4px', display: 'inline-block', border: '1px solid var(--border-color)' }}
                        >
                          {scanResults[symbol].status?.toLowerCase() === 'overheating' ? '🔥 Overheating' : 
                           scanResults[symbol].status?.toLowerCase() === 'underperforming' ? '🧊 Underperforming' : 
                           scanResults[symbol].status?.toLowerCase() === 'accumulate' ? '🚀 Accumulate' : '🛡️ Hold'}
                        </span>
                      )}
                    </div>
                  </td>
                  
                  {/* Name and Sector */}
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                        {asset ? asset.name : 'Unknown Asset'}
                      </span>
                      <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                        {asset ? asset.sector : 'Other'}
                      </span>
                    </div>
                  </td>
                  
                  {/* Holding Type Badge */}
                  <td>
                    {holding.holdingType === 'reference' ? (
                      <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.25)', fontSize: '0.725rem', fontWeight: 600 }}>
                        🔍 อ้างอิง/จำลอง
                      </span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.25)', fontSize: '0.725rem', fontWeight: 600 }}>
                        💼 ลงทุนจริง
                      </span>
                    )}
                  </td>

                  {/* Quantity */}
                  <td style={{ fontWeight: 500 }}>
                    {holding.quantity.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                  </td>

                  {/* Avg Cost */}
                  <td style={{ color: 'var(--text-secondary)' }}>
                    ฿{holding.avgCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  </td>

                  {/* Current Price (with flash animation) */}
                  <td className={flashClass} style={{ fontWeight: 700, transition: 'background-color 0.5s ease' }}>
                    ฿{currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  </td>

                  {/* Market Value */}
                  <td style={{ fontWeight: 700 }}>
                    ฿{marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>

                  {/* Gain/Loss */}
                  <td>
                    <div className={isProfit ? 'change-up' : 'change-down'} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 700 }}>
                      {isProfit ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span>{isProfit ? '+' : ''}{gainLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        <span style={{ fontSize: '0.7rem' }}>{isProfit ? '+' : ''}{gainLossPercent.toFixed(2)}%</span>
                      </div>
                    </div>
                  </td>

                  {/* Actions */}
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.4rem', borderRadius: '8px' }}
                        onClick={() => onEdit(holding)}
                        title="แก้ไขรายการ"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button 
                        className="btn btn-danger" 
                        style={{ padding: '0.4rem', borderRadius: '8px' }}
                        onClick={() => onDelete(holding.id)}
                        title="ลบรายการ"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
