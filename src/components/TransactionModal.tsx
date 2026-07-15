import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { financeApi } from '../services/financeApi';
import type { Holding } from '../services/aiService';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (holding: Holding) => void;
  editingHolding?: Holding | null;
}

const PRESET_STOCKS = [
  { symbol: 'PTT', name: 'PTT Public Company Limited (Energy)' },
  { symbol: 'CPALL', name: 'CP ALL Public Company Limited (Commerce)' },
  { symbol: 'AOT', name: 'Airports of Thailand (Transportation)' },
  { symbol: 'KBANK', name: 'Kasikornbank (Banking)' },
  { symbol: 'ADVANC', name: 'Advanced Info Service (ICT)' },
  { symbol: 'AAPL', name: 'Apple Inc. (Technology)' },
  { symbol: 'TSLA', name: 'Tesla, Inc. (Automotive)' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation (Technology)' }
];

const PRESET_FUNDS = [
  { symbol: 'ONE-UGG-RA', name: 'One Ultimate Global Growth Fund (Global Growth)' },
  { symbol: 'K-CHANGE-A(A)', name: 'K Positive Change Fund (Global ESG)' },
  { symbol: 'SCBGP', name: 'SCB Global Population Fund (Global Equity)' },
  { symbol: 'B-INNOTECH', name: 'Bualuang Global Innovation Tech (Global Tech)' },
  { symbol: 'TMBCOF', name: 'TMB China Opportunity Fund (China Equity)' }
];

const detectAssetType = (symbol: string): 'stock' | 'fund' => {
  const sym = symbol.toUpperCase().trim();
  if (!sym) return 'stock';

  if (PRESET_STOCKS.some(item => item.symbol === sym)) return 'stock';
  if (PRESET_FUNDS.some(item => item.symbol === sym)) return 'fund';

  const fundPrefixes = ['K-', 'SCB', 'TMB', 'ONE-', 'KF', 'B-', 'UOB', 'LH', 'ASP', 'TISCO', 'LH-', 'PRINCIPAL'];
  const hasFundPrefix = fundPrefixes.some(pref => sym.startsWith(pref));

  const fundSuffixes = ['-A', '-D', '-R', '-SSF', '-RMF', '-LTF', 'RMF', 'SSF', 'LTF', '(A)', '(D)', '(R)'];
  const hasFundSuffix = fundSuffixes.some(suff => sym.endsWith(suff));

  const hasHyphen = sym.includes('-');

  if (hasFundPrefix || hasFundSuffix || hasHyphen) {
    return 'fund';
  }
  return 'stock';
};

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingHolding
}) => {
  const [assetType, setAssetType] = useState<'stock' | 'fund'>('stock');
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');
  const [avgCost, setAvgCost] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [holdingType, setHoldingType] = useState<'real' | 'reference'>('real');
  
  // Custom Asset states
  const [isCustom, setIsCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customSector, setCustomSector] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);

  useEffect(() => {
    if (editingHolding) {
      const isPreset = PRESET_STOCKS.some(item => item.symbol === editingHolding.symbol) || 
                       PRESET_FUNDS.some(item => item.symbol === editingHolding.symbol);
      const asset = financeApi.getAsset(editingHolding.symbol);
      const type = asset?.type || detectAssetType(editingHolding.symbol);
      
      setAssetType(type);
      setSymbol(editingHolding.symbol);
      setQuantity(editingHolding.quantity.toString());
      setAvgCost(editingHolding.avgCost.toString());
      setPurchaseDate(editingHolding.purchaseDate);
      setHoldingType(editingHolding.holdingType || 'real');
      
      if (!isPreset) {
        setIsCustom(true);
        setCustomName(asset?.name || 'Unknown Asset');
        setCustomSector(asset?.sector || 'Other');
        setCustomPrice(asset?.price.toString() || editingHolding.avgCost.toString());
      } else {
        setIsCustom(false);
        setCustomName('');
        setCustomSector('');
        setCustomPrice('');
      }
      setErrorMsg('');
    } else {
      const today = new Date().toISOString().split('T')[0];
      setAssetType('stock');
      setSymbol(PRESET_STOCKS[0].symbol);
      setQuantity('');
      setAvgCost('');
      setPurchaseDate(today);
      setHoldingType('real');
      setIsCustom(false);
      setCustomName('');
      setCustomSector('');
      setCustomPrice('');
      setErrorMsg('');
    }
  }, [editingHolding, isOpen]);

  if (!isOpen) return null;

  const handleAssetTypeChange = (type: 'stock' | 'fund') => {
    setAssetType(type);
    if (!isCustom) {
      setSymbol(type === 'stock' ? PRESET_STOCKS[0].symbol : PRESET_FUNDS[0].symbol);
    }
  };

  const handleSymbolChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'CUSTOM') {
      setIsCustom(true);
      setSymbol('');
    } else {
      setIsCustom(false);
      setSymbol(val);
      const asset = financeApi.getAsset(val);
      if (asset) {
        setAvgCost(asset.price.toString());
        setCustomPrice(asset.price.toString());
        setAssetType(asset.type);
      }
      // Auto-fetch live price
      void handleAutoFetchPrice(val);
    }
  };

  const handleCustomSymbolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setSymbol(val);
    const detected = detectAssetType(val);
    setAssetType(detected);

    const isPreset = PRESET_STOCKS.some(item => item.symbol === val) || 
                     PRESET_FUNDS.some(item => item.symbol === val);
    setIsCustom(!isPreset);

    // Auto-fill from market database if symbol matches a known asset
    const asset = financeApi.getAsset(val);
    if (asset) {
      setCustomName(asset.name);
      setCustomSector(asset.sector);
      setCustomPrice(asset.price.toString());
      setAvgCost(asset.price.toString());
      setAssetType(asset.type);
    }
    // Auto-fetch live price for custom symbols
    void handleAutoFetchPrice(val);
  };

  const handleAutoFetchPrice = async (sym?: string) => {
    const lookup = sym ?? symbol;
    if (!lookup) return;
    setIsFetchingPrice(true);
    // Try fetching from external APIs first
    const data = await financeApi.fetchSingleAssetPrice(lookup);
    if (data && data.price) {
      setCustomPrice(data.price.toString());
      if (!avgCost || Number(avgCost) === 0) {
        setAvgCost(data.price.toString());
      }
    } else {
      // Fallback: use locally cached asset (mock or previously fetched market data)
      const asset = financeApi.getAsset(lookup);
      if (asset && asset.price) {
        setCustomPrice(asset.price.toString());
        if (!avgCost || Number(avgCost) === 0) {
          setAvgCost(asset.price.toString());
        }
      } else {
        setErrorMsg('ไม่พบข้อมูลราคาสำหรับสินทรัพย์นี้');
      }
    }
    setIsFetchingPrice(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) {
      setErrorMsg('กรุณากรอกจำนวนหน่วยการลงทุนให้ถูกต้อง (มากกว่า 0)');
      return;
    }

    if (!avgCost || isNaN(Number(avgCost)) || Number(avgCost) <= 0) {
      setErrorMsg('กรุณากรอกราคาทุนเฉลี่ยต่อหน่วยให้ถูกต้อง (มากกว่า 0)');
      return;
    }

    let finalSymbol = symbol.toUpperCase().trim();

    if (isCustom) {
      if (!finalSymbol) {
        setErrorMsg('กรุณาระบุชื่อย่อสินทรัพย์ เช่น PTT, AAPL');
        return;
      }
      if (!customName) {
        setErrorMsg('กรุณาระบุชื่อบริษัท/กองทุนเต็ม');
        return;
      }
      if (!customSector) {
        setErrorMsg('กรุณาระบุกลุ่มอุตสาหกรรม/ประเภทกองทุน');
        return;
      }
      if (!customPrice || isNaN(Number(customPrice)) || Number(customPrice) <= 0) {
        setErrorMsg('กรุณากรอกราคาปัจจุบันของสินทรัพย์ให้ถูกต้อง');
        return;
      }

      // Add custom asset to mock DB
      const added = financeApi.addCustomAsset(
        finalSymbol,
        customName,
        assetType,
        customSector,
        Number(customPrice)
      );

      if (!added && !editingHolding) {
        // If it already exists, that's okay, just use the existing one
        console.log(`Asset ${finalSymbol} already exists, using existing.`);
      }
    }

    onSave({
      id: editingHolding ? editingHolding.id : Math.random().toString(36).substr(2, 9),
      symbol: finalSymbol,
      quantity: Number(quantity),
      avgCost: Number(avgCost),
      purchaseDate: purchaseDate || new Date().toISOString().split('T')[0],
      holdingType
    });
    
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass" style={{ border: '1px solid rgba(255, 255, 255, 0.15)' }}>
        <button 
          onClick={onClose} 
          style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>

        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>
          {editingHolding ? '📝 แก้ไขรายการลงทุน' : '➕ เพิ่มรายการซื้อขาย'}
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '-0.75rem' }}>
          ระบุสัดส่วนการลงทุนและต้นทุน เพื่อให้ AI สามารถนำไปวิเคราะห์ได้อย่างถูกต้อง
        </p>

        {errorMsg && (
          <div className="glass" style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.3)', color: 'var(--accent-red)', padding: '0.75rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.8rem' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Asset Type Selector */}
          <div className="form-group">
            <label>ประเภทสินทรัพย์</label>
            <div style={{ display: 'flex', background: 'var(--bg-input)', padding: '0.25rem', borderRadius: '8px', gap: '0.25rem' }}>
              <button 
                type="button" 
                style={{ flex: 1, padding: '0.5rem', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', background: assetType === 'stock' ? 'var(--accent-primary)' : 'transparent', color: assetType === 'stock' ? '#fff' : 'var(--text-secondary)', transition: 'var(--transition-smooth)' }}
                onClick={() => handleAssetTypeChange('stock')}
              >
                หุ้น (Stock)
              </button>
              <button 
                type="button" 
                style={{ flex: 1, padding: '0.5rem', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', background: assetType === 'fund' ? 'var(--accent-primary)' : 'transparent', color: assetType === 'fund' ? '#fff' : 'var(--text-secondary)', transition: 'var(--transition-smooth)' }}
                onClick={() => handleAssetTypeChange('fund')}
              >
                กองทุนรวม (Mutual Fund)
              </button>
            </div>
          </div>

          {/* Holding Type Selector */}
          <div className="form-group">
            <label>ประเภทการถือครอง (Holding Type)</label>
            <div style={{ display: 'flex', background: 'var(--bg-input)', padding: '0.25rem', borderRadius: '8px', gap: '0.25rem' }}>
              <button 
                type="button" 
                style={{ flex: 1, padding: '0.5rem', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', background: holdingType === 'real' ? 'var(--accent-primary)' : 'transparent', color: holdingType === 'real' ? '#fff' : 'var(--text-secondary)', transition: 'var(--transition-smooth)' }}
                onClick={() => setHoldingType('real')}
              >
                💼 ลงทุนจริง (Actual)
              </button>
              <button 
                type="button" 
                style={{ flex: 1, padding: '0.5rem', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', background: holdingType === 'reference' ? 'var(--accent-blue)' : 'transparent', color: holdingType === 'reference' ? '#fff' : 'var(--text-secondary)', transition: 'var(--transition-smooth)' }}
                onClick={() => {
                  setHoldingType('reference');
                  // Auto-fill from market database if symbol exists
                  const asset = financeApi.getAsset(symbol);
                  if (asset) {
                    setCustomName(asset.name);
                    setCustomSector(asset.sector);
                    setCustomPrice(asset.price.toString());
                    setAvgCost(asset.price.toString());
                    setAssetType(asset.type);
                  }
                }}
              >
                🔍 จำลอง/อ้างอิง (Sandbox)
              </button>
            </div>
          </div>

          {/* Symbol Selector */}
          <div className="form-group">
            <label>เลือกตัวย่อหุ้น / กองทุน</label>
            {editingHolding ? (
              <input 
                type="text" 
                className="form-control" 
                value={symbol} 
                placeholder="ระบุตัวย่อหุ้น / กองทุน เช่น KFGG-A"
                onChange={handleCustomSymbolChange}
              />
            ) : (
              <select className="form-control" value={isCustom ? 'CUSTOM' : symbol} onChange={handleSymbolChange}>
                <optgroup label={assetType === 'stock' ? 'หุ้นเด่นจัดจำลอง' : 'กองทุนเด่นจัดจำลอง'}>
                  {(assetType === 'stock' ? PRESET_STOCKS : PRESET_FUNDS).map(item => (
                    <option key={item.symbol} value={item.symbol}>{item.symbol} - {item.name}</option>
                  ))}
                </optgroup>
                <option value="CUSTOM">➕ ระบุสินทรัพย์อื่นๆ เอง (Custom Asset)</option>
              </select>
            )}
          </div>

          {/* Custom Asset Form */}
          {isCustom && (
            <div className="glass" style={{ padding: '1rem', background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="form-row">
                {!editingHolding ? (
                  <>
                    <div className="form-group">
                      <label>ตัวย่อ (เช่น PTT)</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="ตัวย่อ"
                        value={symbol}
                        onChange={handleCustomSymbolChange}
                        onBlur={() => handleAutoFetchPrice(symbol)}
                      />
                    </div>
                    <div className="form-group">
                      <label>กลุ่มอุตสาหกรรม</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="เช่น Energy, Technology"
                        value={customSector}
                        onChange={(e) => setCustomSector(e.target.value)}
                      />
                    </div>
                  </>
                ) : (
                  <div className="form-group" style={{ width: '100%' }}>
                    <label>กลุ่มอุตสาหกรรม / ประเภทกองทุน</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="เช่น Energy, Tech Equity, ESG Equity"
                      value={customSector}
                      onChange={(e) => setCustomSector(e.target.value)}
                    />
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>ชื่อเต็มบริษัท/กองทุน</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="เช่น Apple Inc. / กองทุนเปิดบัวหลวงอินโนเทค"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <label style={{ margin: 0 }}>ราคาตลาดปัจจุบัน (บาท)</label>
                  <button 
                    type="button" 
                    onClick={() => handleAutoFetchPrice()}
                    disabled={isFetchingPrice || !symbol}
                    style={{ background: 'transparent', border: 'none', color: '#a78bfa', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                  >
                    {isFetchingPrice ? 'กำลังดึงราคา...' : '🔄 ดึงราคาอัตโนมัติ'}
                  </button>
                </div>
                <input 
                  type="number" 
                  className="form-control" 
                  step="any"
                  placeholder="เช่น 185.50"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Quantity & Avg Cost */}
          <div className="form-row">
            <div className="form-group">
              <label>จำนวนหน่วย (Quantity)</label>
              <input 
                type="number" 
                className="form-control" 
                step="any"
                placeholder="เช่น 100, 15.25"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>ราคาเฉลี่ยต่อหน่วย (Cost/Unit)</label>
              <input 
                type="number" 
                className="form-control" 
                step="any"
                placeholder="ต้นทุนเฉลี่ย"
                value={avgCost}
                onChange={(e) => setAvgCost(e.target.value)}
              />
            </div>
          </div>

          {/* Purchase Date */}
          <div className="form-group">
            <label>วันที่เข้าซื้อ (Purchase Date)</label>
            <input 
              type="date" 
              className="form-control"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker();
                } catch (err) {
                  // Fallback for older browsers
                }
              }}
              style={{ cursor: 'pointer' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
              ยกเลิก
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              {editingHolding ? 'บันทึกการแก้ไข' : 'เพิ่มในพอร์ต'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
