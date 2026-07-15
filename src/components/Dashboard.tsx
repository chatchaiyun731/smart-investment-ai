import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown, Wallet, PieChart as ChartIcon, Briefcase } from 'lucide-react';
import type { PortfolioAnalysis, Holding } from '../services/aiService';
import type { Asset } from '../services/financeApi';

interface DashboardProps {
  analysis: PortfolioAnalysis;
  holdings?: Holding[];
  currentPrices?: Record<string, Asset>;
}

const COLORS = [
  '#8b5cf6', // Indigo/Purple
  '#10b981', // Emerald Green
  '#0284c7', // Sky Blue
  '#f59e0b', // Amber/Gold
  '#ef4444', // Rose Red
  '#ec4899', // Pink
  '#14b8a6'  // Teal
];

export const Dashboard: React.FC<DashboardProps> = ({ analysis, holdings = [], currentPrices = {} }) => {
  const {
    totalValue,
    sectorAllocations,
    assetAllocations
  } = analysis;

  const calculateSubPortfolio = (filteredHoldings: Holding[] = []) => {
    let cost = 0;
    let value = 0;
    filteredHoldings.forEach(h => {
      const asset = currentPrices ? currentPrices[h.symbol.toUpperCase()] : undefined;
      const price = asset ? asset.price : h.avgCost;
      cost += h.quantity * h.avgCost;
      value += h.quantity * price;
    });
    const gainLoss = value - cost;
    const gainLossPercent = cost > 0 ? (gainLoss / cost) * 100 : 0;
    return { cost, value, gainLoss, gainLossPercent };
  };

  const realMetrics = calculateSubPortfolio(holdings?.filter(h => (h.holdingType || 'real') === 'real'));
  const sandboxMetrics = calculateSubPortfolio(holdings?.filter(h => h.holdingType === 'reference'));

  // Formatting helper
  const formatCurrency = (val: number) => {
    return `฿${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Convert Asset Allocations for Pie Chart
  const assetPieData = assetAllocations
    .filter(a => a.value > 0)
    .map(a => ({
      name: a.type === 'stock' ? 'หุ้น (Stocks)' : 'กองทุนรวม (Funds)',
      value: a.value
    }));

  // Tooltip custom styling
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass" style={{ padding: '0.75rem 1rem', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
          <p style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{payload[0].name}</p>
          <p style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
            {formatCurrency(payload[0].value)} ({((payload[0].value / (totalValue || 1)) * 100).toFixed(1)}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* SECTION 1: Actual Portfolio (ลงทุนจริง) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <span style={{ fontSize: '1.1rem' }}>💼</span>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>พอร์ตลงทุนจริง (Actual Portfolio)</h3>
          <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.25)', fontSize: '0.7rem', fontWeight: 600 }}>
            {holdings.filter(h => (h.holdingType || 'real') === 'real').length} สินทรัพย์
          </span>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
          {/* Real Value */}
          <div className="glass stat-card" style={{ borderLeft: '4px solid var(--accent-primary)' }}>
            <div className="stat-header">
              <span>มูลค่าพอร์ตจริง</span>
              <Wallet size={16} color="var(--accent-primary)" />
            </div>
            <div className="stat-value" style={{ fontSize: '1.75rem', fontWeight: 800 }}>{formatCurrency(realMetrics.value)}</div>
            <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
              มูลค่าตลาดปัจจุบันของหลักทรัพย์ลงทุนจริง
            </div>
          </div>

          {/* Real Cost */}
          <div className="glass stat-card" style={{ borderLeft: '4px solid var(--accent-blue)' }}>
            <div className="stat-header">
              <span>เงินลงทุนจริง (ต้นทุน)</span>
              <Briefcase size={16} color="var(--accent-blue)" />
            </div>
            <div className="stat-value" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(realMetrics.cost)}</div>
            <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
              จำนวนเงินรวมที่ใช้ซื้อหลักทรัพย์จริง
            </div>
          </div>

          {/* Real Gain/Loss */}
          <div className="glass stat-card" style={{ borderLeft: `4px solid ${realMetrics.gainLoss >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}` }}>
            <div className="stat-header">
              <span>กำไร / ขาดทุนจริง</span>
              {realMetrics.gainLoss >= 0 ? (
                <TrendingUp size={16} color="var(--accent-green)" />
              ) : (
                <TrendingDown size={16} color="var(--accent-red)" />
              )}
            </div>
            <div className={`stat-value ${realMetrics.gainLoss >= 0 ? 'change-up' : 'change-down'}`} style={{ fontSize: '1.75rem', fontWeight: 800 }}>
              {realMetrics.gainLoss >= 0 ? '+' : ''}{formatCurrency(realMetrics.gainLoss)}
            </div>
            <div className={`stat-change ${realMetrics.gainLoss >= 0 ? 'change-up' : 'change-down'}`} style={{ fontSize: '0.725rem' }}>
              {realMetrics.gainLoss >= 0 ? '+' : ''}{realMetrics.gainLossPercent.toFixed(2)}% ของต้นทุนจริง
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: Sandbox Portfolio (จำลอง/อ้างอิง) */}
      {sandboxMetrics.cost > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '1.1rem' }}>🔍</span>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>พอร์ตอ้างอิง / จำลอง (Sandbox Portfolio)</h3>
            <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.25)', fontSize: '0.7rem', fontWeight: 600 }}>
              {holdings.filter(h => h.holdingType === 'reference').length} สินทรัพย์
            </span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
            {/* Sandbox Value */}
            <div className="glass stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
              <div className="stat-header">
                <span>มูลค่าพอร์ตจำลอง</span>
                <Wallet size={16} color="#3b82f6" />
              </div>
              <div className="stat-value" style={{ fontSize: '1.75rem', fontWeight: 800 }}>{formatCurrency(sandboxMetrics.value)}</div>
              <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
                มูลค่าตลาดปัจจุบันของหลักทรัพย์อ้างอิง
              </div>
            </div>

            {/* Sandbox Cost */}
            <div className="glass stat-card" style={{ borderLeft: '4px solid #60a5fa' }}>
              <div className="stat-header">
                <span>เงินลงทุนจำลอง (ต้นทุน)</span>
                <Briefcase size={16} color="#60a5fa" />
              </div>
              <div className="stat-value" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(sandboxMetrics.cost)}</div>
              <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
                จำนวนเงินรวมที่ใช้ซื้อพอร์ตจำลอง
              </div>
            </div>

            {/* Sandbox Gain/Loss */}
            <div className="glass stat-card" style={{ borderLeft: `4px solid ${sandboxMetrics.gainLoss >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}` }}>
              <div className="stat-header">
                <span>กำไร / ขาดทุนจำลอง</span>
                {sandboxMetrics.gainLoss >= 0 ? (
                  <TrendingUp size={16} color="var(--accent-green)" />
                ) : (
                  <TrendingDown size={16} color="var(--accent-red)" />
                )}
              </div>
              <div className={`stat-value ${sandboxMetrics.gainLoss >= 0 ? 'change-up' : 'change-down'}`} style={{ fontSize: '1.75rem', fontWeight: 800 }}>
                {sandboxMetrics.gainLoss >= 0 ? '+' : ''}{formatCurrency(sandboxMetrics.gainLoss)}
              </div>
              <div className={`stat-change ${sandboxMetrics.gainLoss >= 0 ? 'change-up' : 'change-down'}`} style={{ fontSize: '0.725rem' }}>
                {sandboxMetrics.gainLoss >= 0 ? '+' : ''}{sandboxMetrics.gainLossPercent.toFixed(2)}% ของต้นทุนอ้างอิง
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="dashboard-grid">
        
        {/* Left Column: Sector Allocation (Bar Chart) */}
        <div className="glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ChartIcon size={18} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>สัดส่วนการลงทุนตามกลุ่มธุรกิจ (Sector Allocation)</h3>
          </div>
          
          {sectorAllocations.length === 0 ? (
            <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              ไม่มีข้อมูลอุตสาหกรรมในขณะนี้ (เพิ่มหลักทรัพย์เพื่อสร้างกราฟ)
            </div>
          ) : (
            <div style={{ width: '100%', height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sectorAllocations}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickFormatter={(val) => `฿${(val / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="sector" type="category" stroke="var(--text-muted)" fontSize={11} width={80} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {sectorAllocations.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Right Column: Asset Allocation (Pie Chart) */}
        <div className="glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ChartIcon size={18} color="var(--accent-blue)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>สัดส่วน หุ้น vs กองทุน</h3>
          </div>

          {assetPieData.length === 0 ? (
            <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              ไม่มีข้อมูลประเภทหลักทรัพย์ในขณะนี้
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', position: 'relative' }}>
              <div style={{ width: '100%', height: '220px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={assetPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {assetPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.name.includes('หุ้น') ? 'var(--accent-blue)' : 'var(--accent-primary)'} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              {/* Legends Custom */}
              <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', fontWeight: 600 }}>
                {assetAllocations.map((alloc) => {
                  if (alloc.value === 0) return null;
                  const label = alloc.type === 'stock' ? 'หุ้น' : 'กองทุนรวม';
                  const color = alloc.type === 'stock' ? 'var(--accent-blue)' : 'var(--accent-primary)';
                  return (
                    <div key={alloc.type} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: color, display: 'inline-block' }} />
                      <span>{label} ({alloc.percentage.toFixed(1)}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
