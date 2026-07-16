import type { Asset } from './financeApi';
import { financeApi } from './financeApi';

export interface Holding {
  id: string;
  symbol: string;
  quantity: number;
  avgCost: number;
  purchaseDate: string;
  holdingType?: 'real' | 'reference';
}

export interface PortfolioAnalysis {
  totalValue: number;
  totalCost: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  riskScore: number; // 0 - 100
  riskLevel: 'ต่ำ' | 'ปานกลาง' | 'สูง';
  diversificationScore: number; // 0 - 100
  sectorAllocations: { sector: string; value: number; percentage: number }[];
  assetAllocations: { type: 'stock' | 'fund'; value: number; percentage: number }[];
  warnings: string[];
  suggestions: {
    symbol: string;
    name: string;
    type: 'stock' | 'fund';
    reason: string;
  }[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface ScanResult {
  status: 'overheating' | 'underperforming' | 'hold' | 'accumulate';
  reason: string;
}

// Built-in rule-based recommendations database
const RECOMMENDATION_ITEMS: { symbol: string; name: string; type: 'stock' | 'fund'; reason: string }[] = [
  { symbol: 'CPALL', name: 'CP ALL PLC', type: 'stock', reason: 'หุ้นกลุ่มค้าปลีกที่แข็งแกร่ง มีกระแสเงินสดมั่นคง เหมาะสำหรับเพิ่มความเสถียรให้กับพอร์ต' },
  { symbol: 'KBANK', name: 'Kasikornbank PLC', type: 'stock', reason: 'หุ้นกลุ่มธนาคารปันผลเด่น มูลค่า (Valuation) ปัจจุบันไม่แพงเกินไป' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', type: 'stock', reason: 'ผู้นำด้าน AI Chips ทั่วโลก เหมาะกับพอร์ตที่ต้องการความเติบโตสูงและพร้อมรับความผันผวน' },
  { symbol: 'B-INNOTECH', name: 'Bualuang Global Innovation Tech', type: 'fund', reason: 'กองทุนรวมที่เน้นลงทุนในบริษัทเทคโนโลยีระดับโลกชั้นนำ เพื่อเกาะกระแสเศรษฐกิจดิจิทัล' },
  { symbol: 'ONE-UGG-RA', name: 'One Ultimate Global Growth Fund', type: 'fund', reason: 'เน้นลงทุนในกองทุนสากลจับกระแสการเติบโตระยะยาวทั่วโลก ช่วยกระจายความเสี่ยงไปตลาดต่างประเทศ' },
  { symbol: 'SCBGP', name: 'SCB Global Population Fund', type: 'fund', reason: 'เน้นกลุ่มอุปโภคบริโภคและการดูแลสุขภาพทั่วโลก มีความผันผวนต่ำกว่าหุ้นเทคโนโลยี' }
];

class AiService {
  
  public analyzePortfolio(holdings: Holding[], currentPrices: Record<string, Asset>): PortfolioAnalysis {
    let totalValue = 0;
    let totalCost = 0;
    const sectorMap: Record<string, number> = {};
    const assetTypeMap: Record<'stock' | 'fund', number> = { stock: 0, fund: 0 };
    
    // Process holdings
    holdings.forEach(holding => {
      const asset = currentPrices[holding.symbol.toUpperCase()];
      const currentPrice = asset ? asset.price : holding.avgCost;
      const value = holding.quantity * currentPrice;
      const cost = holding.quantity * holding.avgCost;
      
      totalValue += value;
      totalCost += cost;
      
      // Sector Allocation
      const sector = asset ? asset.sector : 'Other';
      sectorMap[sector] = (sectorMap[sector] || 0) + value;
      
      // Asset Type Allocation
      const type = asset ? asset.type : 'stock';
      assetTypeMap[type] += value;
    });

    const totalGainLoss = totalValue - totalCost;
    const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

    // Calculate allocations
    const sectorAllocations = Object.keys(sectorMap).map(sector => ({
      sector,
      value: sectorMap[sector],
      percentage: totalValue > 0 ? (sectorMap[sector] / totalValue) * 100 : 0
    })).sort((a, b) => b.value - a.value);

    const assetAllocations = [
      { type: 'stock' as const, value: assetTypeMap.stock, percentage: totalValue > 0 ? (assetTypeMap.stock / totalValue) * 100 : 0 },
      { type: 'fund' as const, value: assetTypeMap.fund, percentage: totalValue > 0 ? (assetTypeMap.fund / totalValue) * 100 : 0 }
    ];

    // Determine Risk Score & Level
    // Base rule: Stocks represent higher risk than funds.
    const stockRatio = totalValue > 0 ? (assetTypeMap.stock / totalValue) : 0.5;
    let riskScore = Math.round(stockRatio * 100);
    
    // Adjust risk score by sector concentration
    if (sectorAllocations.length > 0 && sectorAllocations[0].percentage > 50) {
      riskScore = Math.min(100, riskScore + 15); // penalize concentration
    }
    
    let riskLevel: 'ต่ำ' | 'ปานกลาง' | 'สูง' = 'ปานกลาง';
    if (riskScore < 35) riskLevel = 'ต่ำ';
    else if (riskScore > 70) riskLevel = 'สูง';

    // Calculate Diversification Score (0-100)
    // High score means many sectors and balanced asset types
    let diversificationScore = 100;
    if (holdings.length === 0) {
      diversificationScore = 0;
    } else {
      // Penalty for concentration in top sector
      if (sectorAllocations.length > 0) {
        const topSectorPercent = sectorAllocations[0].percentage;
        diversificationScore -= (topSectorPercent - 20) * 0.8; // Lose points if top sector > 20%
      }
      // Penalty for few holdings
      if (holdings.length < 3) diversificationScore -= 30;
      else if (holdings.length < 5) diversificationScore -= 15;
      
      // Penalty for missing asset types
      if (assetTypeMap.stock === 0 || assetTypeMap.fund === 0) {
        diversificationScore -= 20;
      }
      
      diversificationScore = Math.max(10, Math.min(100, Math.round(diversificationScore)));
    }

    // Generate Warnings
    const warnings: string[] = [];
    if (holdings.length > 0) {
      if (assetTypeMap.stock / totalValue > 0.85) {
        warnings.push('พอร์ตของคุณมีสัดส่วนหุ้นสูงมาก (>85%) ซึ่งมีความผันผวนสูงมาก ควรเพิ่มกองทุนรวมตราสารหนี้หรือกองทุนรวมต่างประเทศเพื่อลดความเสี่ยง');
      }
      if (sectorAllocations.length > 0 && sectorAllocations[0].percentage > 50) {
        warnings.push(`มีการกระจุกตัวในกลุ่มอุตสาหกรรม "${sectorAllocations[0].sector}" มากเกินไป (${sectorAllocations[0].percentage.toFixed(1)}%) แนะนำกระจายไปยังอุตสาหกรรมอื่น`);
      }
      if (holdings.length <= 2) {
        warnings.push('พอร์ตของคุณมีจำนวนสินทรัพย์น้อยเกินไป (ต่ำกว่า 3 ชิ้น) ควรเพิ่มความหลากหลายเพื่อลดความเสี่ยงเฉพาะตัวของหุ้นแต่ละตัว');
      }
      
      // Individual holding concentration warning
      holdings.forEach(h => {
        const assetPrice = currentPrices[h.symbol.toUpperCase()]?.price || h.avgCost;
        const val = h.quantity * assetPrice;
        if (totalValue > 0 && (val / totalValue) > 0.4) {
          warnings.push(`หุ้น/กองทุน "${h.symbol.toUpperCase()}" มีสัดส่วนมากกว่า 40% ของพอร์ตทั้งหมด ความผันผวนของสินทรัพย์นี้จะส่งผลกระทบต่อพอร์ตค่อนข้างสูง`);
        }
      });
    } else {
      warnings.push('ยังไม่มีรายการลงทุนในพอร์ต เริ่มต้นเพิ่มรายการหุ้นหรือกองทุนรวมได้เลย!');
    }

    // Generate Dynamic Suggestions
    const suggestions = RECOMMENDATION_ITEMS.filter(item => {
      // Don't recommend what they already own
      const ownsItem = holdings.some(h => h.symbol.toUpperCase() === item.symbol);
      if (ownsItem) return false;

      // Customize suggestions based on portfolio needs
      if (riskLevel === 'สูง' && item.type === 'stock' && item.symbol === 'NVDA') {
        return false; // Don't suggest high-risk stock if already high risk, suggest funds instead
      }
      if (riskLevel === 'ต่ำ' && item.type === 'stock' && item.symbol === 'NVDA') {
        return false; // Low risk target shouldn't buy tech growth stocks
      }
      return true;
    }).slice(0, 3); // Pick top 3 recommendations

    return {
      totalValue,
      totalCost,
      totalGainLoss,
      totalGainLossPercent,
      riskScore,
      riskLevel,
      diversificationScore,
      sectorAllocations,
      assetAllocations,
      warnings,
      suggestions
    };
  }

  // Live Gemini AI report generator
  public async generateAiReport(
    analysis: PortfolioAnalysis, 
    holdings: Holding[], 
    _apiKey: string
  ): Promise<string> {
    

    const portfolioSummary = holdings.map(h => {
      const asset = financeApi.getAsset(h.symbol);
      const currentPrice = asset ? asset.price : h.avgCost;
      const profitLoss = (currentPrice - h.avgCost) * h.quantity;
      const profitLossPercent = (profitLoss / (h.avgCost * h.quantity)) * 100;
      return `- ${h.symbol} (${asset?.type === 'stock' ? 'หุ้น' : 'กองทุนรวม'}): ซื้อเฉลี่ย ${h.avgCost}, ราคาปัจจุบัน ${currentPrice}, จำนวน ${h.quantity} หน่วย, มูลค่าปัจจุบัน ${(h.quantity * currentPrice).toLocaleString()} บาท, กำไร/ขาดทุน ${profitLoss.toLocaleString()} บาท (${profitLossPercent.toFixed(2)}%)`;
    }).join('\n');

    // Get feedback loop data from LocalStorage
    let feedbackText = '';
    try {
      const savedFeedback = localStorage.getItem('portfolio_tracker_feedback');
      if (savedFeedback) {
        const feedbackMap = JSON.parse(savedFeedback);
        const likes = Object.keys(feedbackMap).filter(k => feedbackMap[k] === 'like');
        const dislikes = Object.keys(feedbackMap).filter(k => feedbackMap[k] === 'dislike');
        if (likes.length > 0 || dislikes.length > 0) {
          feedbackText = `\nประวัติสไตล์การลงทุนที่ผู้ใช้เคยให้ข้อเสนอแนะไว้ (Feedback Loop):\n`;
          if (likes.length > 0) feedbackText += `- สินทรัพย์แนะนำที่ผู้ใช้สนใจ/ชอบสไตล์นี้: ${likes.join(', ')}\n`;
          if (dislikes.length > 0) feedbackText += `- สินทรัพย์แนะนำที่ผู้ใช้ปฏิเสธ/เลี่ยงสไตล์นี้: ${dislikes.join(', ')}\n`;
          feedbackText += `กรุณานำคำติชมและความชอบนี้ไปคำนวณในการเลือกจัดสรรสินทรัพย์และให้คำแนะนำด้วย\n`;
        }
      }
    } catch (e) {
      console.error(e);
    }

    const prompt = `
คุณเป็นผู้เชี่ยวชาญด้านการวางแผนการเงินและ AI Advisor วิเคราะห์การลงทุนระดับมืออาชีพ 
นี่คือข้อมูลพอร์ตการลงทุนของลูกค้าในปัจจุบัน:
- มูลค่าพอร์ตรวม: ${analysis.totalValue.toLocaleString()} บาท
- ต้นทุนรวม: ${analysis.totalCost.toLocaleString()} บาท
- กำไร/ขาดทุนทั้งหมด: ${analysis.totalGainLoss.toLocaleString()} บาท (${analysis.totalGainLossPercent.toFixed(2)}%)
- คะแนนความเสี่ยงของพอร์ต (0-100): ${analysis.riskScore} (ระดับความเสี่ยง: ${analysis.riskLevel})
- คะแนนการกระจายความเสี่ยง (0-100): ${analysis.diversificationScore}
${feedbackText}

รายการสินทรัพย์ในพอร์ต:
${portfolioSummary}

การจัดสรรกลุ่มอุตสาหกรรม (Sector Allocation):
${analysis.sectorAllocations.map(s => `- ${s.sector}: ${s.percentage.toFixed(2)}% (มูลค่า ${s.value.toLocaleString()} บาท)`).join('\n')}

การจัดสรรประเภทสินทรัพย์ (Asset Allocation):
${analysis.assetAllocations.map(a => `- ${a.type === 'stock' ? 'หุ้น' : 'กองทุนรวม'}: ${a.percentage.toFixed(2)}%`).join('\n')}

คำสั่ง:
ให้เขียนบทวิเคราะห์พอร์ตการลงทุนนี้เป็นภาษาไทยในรูปแบบ Markdown ที่สวยงามและพรีเมียม โดยแบ่งเป็นหัวข้อดังนี้:
1. **ภาพรวมสุขภาพพอร์ตการลงทุน** (ความแข็งแกร่งและจุดอ่อนของพอร์ตนี้)
2. **การประเมินความเสี่ยงและคำเตือน** (ประเมินว่าระดับความเสี่ยงเหมาะสมหรือไม่ รวมถึงจุดที่ต้องระวัง เช่น การกระจุกตัวในกลุ่มอุตสาหกรรมหรือตัวหุ้น)
3. **คำแนะนำเชิงกลยุทธ์** (ควรปรับพอร์ตอย่างไร ซื้อ/ขายตัวไหนเพิ่ม เช่น การเพิ่มกองทุนประเภทใด หรือหุ้นกลุ่มใดเพื่อเพิ่มประสิทธิภาพพอร์ต)
4. **หุ้น/กองทุนแนะนำที่น่าสนใจสำหรับสภาวะพอร์ตนี้** (เลือกแนะนำ 2-3 ตัว เช่น หุ้นปันผลดี หรือ กองทุนต่างประเทศ พร้อมเหตุผลประกอบ)

เขียนด้วยน้ำเสียงที่เป็นมิตร น่าเชื่อถือ สุภาพ และเป็นธรรมชาติ หลีกเลี่ยงคำพูดที่แข็งทื่อ
`;

    const config = financeApi.getConfig();
    const model = (config.selectedModel || 'gemini-3.5-flash').trim();

    try {
      const response = await fetch(
        '/api/gemini',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Gemini-Model': model },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API Error ${response.status}: ${errorText} (Model: ${model})`);
      }

      const data = await response.json();
      const report = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!report) {
        throw new Error('No content returned from Gemini');
      }
      financeApi.incrementApiUsage();
      return report;
    } catch (error) {
      console.error('Failed to generate Gemini AI report', error);
      return `> **ระบบขัดข้องในการเชื่อมต่อ Gemini API (จะใช้รายงานแบบออฟไลน์แทน)**\n\n` + this.generateOfflineReport(analysis, holdings);
    }
  }

  public async generateWeeklyReport(
    analysis: PortfolioAnalysis, 
    holdings: Holding[], 
    _apiKey: string
  ): Promise<string> {
    

    const portfolioSummary = holdings.map(h => {
      const asset = financeApi.getAsset(h.symbol);
      const currentPrice = asset ? asset.price : h.avgCost;
      const profitLoss = (currentPrice - h.avgCost) * h.quantity;
      const profitLossPercent = (profitLoss / (h.avgCost * h.quantity)) * 100;
      return `- ${h.symbol} (${asset?.type === 'stock' ? 'หุ้น' : 'กองทุนรวม'}): ต้นทุน ฿${h.avgCost}, ปัจจุบัน ฿${currentPrice}, ถือ ${h.quantity} หน่วย, มูลค่า ฿${(h.quantity * currentPrice).toLocaleString()}, กำไร/ขาดทุน ฿${profitLoss.toLocaleString()} (${profitLossPercent.toFixed(2)}%)`;
    }).join('\n');

    const prompt = `
คุณเป็นผู้เชี่ยวชาญด้านการวางแผนการเงินและ AI Advisor วิเคราะห์การลงทุนระดับมืออาชีพ 
นี่คือข้อมูลพอร์ตการลงทุนของลูกค้า ณ วันศุกร์สุดสัปดาห์นี้:
- มูลค่าพอร์ตรวม: ${analysis.totalValue.toLocaleString()} บาท
- ต้นทุนรวม: ${analysis.totalCost.toLocaleString()} บาท
- กำไร/ขาดทุนทั้งหมด: ${analysis.totalGainLoss.toLocaleString()} บาท (${analysis.totalGainLossPercent.toFixed(2)}%)
- คะแนนความเสี่ยงของพอร์ต (0-100): ${analysis.riskScore} (ระดับความเสี่ยง: ${analysis.riskLevel})

รายการสินทรัพย์ในพอร์ต:
${portfolioSummary}

การจัดสรรประเภทสินทรัพย์ (Asset Allocation):
${analysis.assetAllocations.map(a => `- ${a.type === 'stock' ? 'หุ้น' : 'กองทุนรวม'}: ${a.percentage.toFixed(2)}%`).join('\n')}

คำสั่ง:
ให้เขียน "รายงานสรุปรายสัปดาห์ (Weekly Summary Report)" เป็นภาษาไทยในรูปแบบ Markdown ที่สวยงามและพรีเมียม เพื่อประเมินผลการดำเนินงานในสัปดาห์นี้และภาพรวมระยะยาว โดยแบ่งเป็นหัวข้อดังนี้:
1. **📝 สรุปภาพรวมประจำสัปดาห์** (ประเมินว่าพอร์ตเติบโตหรือหดตัวอย่างไร สินทรัพย์ตัวไหนเป็นตัวเอกหรือตัวถ่วงในพอร์ต)
2. **🔭 มุมมองการลงทุนระยะยาว (Long-term Outlook)** (จากสินทรัพย์ที่ถืออยู่ พอร์ตนี้มีแนวโน้มในระยะยาวอย่างไร ตอบโจทย์การเกษียณหรือเป้าหมายระยะยาวหรือไม่)
3. **⚠️ ประเด็นสำคัญที่ต้องติดตาม (Key Points to Watch)** (มีปัจจัยเศรษฐกิจ หรือข่าวอะไรในสัปดาห์หน้า/เดือนหน้าที่อาจกระทบสินทรัพย์ในพอร์ตนี้)
4. **✅ แอคชั่นแนะนำสำหรับสัปดาห์หน้า** (สัปดาห์หน้าควรทำอะไรต่อ เช่น ถือต่อ (Hold), ทยอยเก็บเพิ่ม (Accumulate), หรือขายทำกำไรบางส่วน)

เขียนด้วยน้ำเสียงที่เป็นมิตร น่าเชื่อถือ สุภาพ และให้กำลังใจนักลงทุน
`;

    const config = financeApi.getConfig();
    const model = (config.selectedModel || 'gemini-3.5-flash').trim();

    try {
      const response = await fetch(
        '/api/gemini',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Gemini-Model': model },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API Error ${response.status}: ${errorText} (Model: ${model})`);
      }

      const data = await response.json();
      const report = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!report) {
        throw new Error('No content returned from Gemini');
      }
      financeApi.incrementApiUsage();
      return report;
    } catch (error) {
      console.error('Failed to generate Weekly Gemini AI report', error);
      return `> **ระบบขัดข้องในการเชื่อมต่อ Gemini API**\n\n` + error;
    }
  }

  public async chatWithGemini(
    messages: ChatMessage[],
    portfolioAnalysis: PortfolioAnalysis,
    holdings: Holding[],
    _apiKey: string,
    useSearch: boolean = true
  ): Promise<string> {
    

    const portfolioSummary = holdings.map(h => {
      const asset = financeApi.getAsset(h.symbol);
      const currentPrice = asset ? asset.price : h.avgCost;
      return `- ${h.symbol} (${asset?.type === 'stock' ? 'หุ้น' : 'กองทุนรวม'}): ซื้อเฉลี่ย ฿${h.avgCost}, ราคาปัจจุบัน ฿${currentPrice}, ถือ ${h.quantity} หน่วย, มูลค่าปัจจุบัน ฿${(h.quantity * currentPrice).toLocaleString()}`;
    }).join('\n');

    const systemInstructionText = `
คุณคือ SmartInvest AI Chatbot ผู้เชี่ยวชาญด้านการเงินและการลงทุนที่น่าเชื่อถือ เป็นมิตร และให้ข้อมูลอย่างรอบด้านแก่ผู้ใช้งาน 

ข้อมูลพอร์ตโฟลิโอปัจจุบันของลูกค้า:
- มูลค่าพอร์ตรวม: ฿${portfolioAnalysis.totalValue.toLocaleString()}
- ต้นทุนรวม: ฿${portfolioAnalysis.totalCost.toLocaleString()}
- กำไร/ขาดทุนรวม: ฿${portfolioAnalysis.totalGainLoss.toLocaleString()} (${portfolioAnalysis.totalGainLossPercent.toFixed(2)}%)
- ความเสี่ยงพอร์ต: ระดับ "${portfolioAnalysis.riskLevel}" (คะแนน: ${portfolioAnalysis.riskScore}/100)
- คะแนนการกระจายความเสี่ยง: ${portfolioAnalysis.diversificationScore}/100

รายการสินทรัพย์ที่ลูกค้าถือครอง:
${portfolioSummary || 'ลูกค้ายังไม่มีสินทรัพย์ในพอร์ต'}

คำแนะนำการตอบแชท:
1. ตอบคำถามของลูกค้าด้วยความสุภาพ น่าเชื่อถือ และใช้ภาษาไทยที่อ่านง่าย เป็นมิตร
2. หากเปิดใช้ Google Search Grounding (ค้นหาข้อมูลสด): คุณสามารถสืบค้นข่าวสาร ข้อมูลเศรษฐกิจ ดัชนีหุ้น หรืออัตราดอกเบี้ยปัจจุบันเพื่อตอบคำถามลูกค้าแบบเรียลไทม์ได้
3. หลีกเลี่ยงการแนะนำให้ซื้อ/ขายสินทรัพย์ตรงๆ ในลักษณะชี้นำการลงทุนโดยไม่มีข้อมูลรองรับ ให้แสดงวิเคราะห์เป็นแนวทาง โอกาส และความเสี่ยงประกอบการตัดสินใจเสมอตามหลักการบริหารสินทรัพย์ที่ดี
4. ถ้าลูกค้าถามเกี่ยวกับพอร์ต ให้ใช้ข้อมูลพอร์ตข้างต้นตอบและวิเคราะห์ เช่น การปรับสมดุลพอร์ต
`;

    // Map message history to Gemini API format
    const contents = messages.map(msg => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.text }]
    }));

    const config = financeApi.getConfig();
    const model = (config.selectedModel || 'gemini-3.5-flash').trim();

    const requestBody: any = {
      contents,
      systemInstruction: {
        parts: [{ text: systemInstructionText }]
      }
    };

    if (useSearch) {
      requestBody.tools = [{
        googleSearch: {}
      }];
    }

    try {
      const response = await fetch(
        '/api/gemini',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Gemini-Model': model },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API Error ${response.status}: ${errorText} (Model: ${model})`);
      }

      const data = await response.json();
      const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!answer) {
        throw new Error('No answer text returned from Gemini API');
      }
      financeApi.incrementApiUsage();
      return answer;
    } catch (error: any) {
      console.error('Failed to chat with Gemini', error);
      throw new Error(error.message || 'การเชื่อมต่อกับ AI ขัดข้อง กรุณาลองใหม่อีกครั้ง');
    }
  }

  // Fallback offline generator if no API key is specified
  public generateOfflineReport(analysis: PortfolioAnalysis, holdings: Holding[]): string {
    if (holdings.length === 0) {
      return `### ยินดีต้อนรับสู่แผงประเมินความเสี่ยงและพอร์ตการลงทุนโดย AI
      
ระบบ AI พร้อมที่จะช่วยวิเคราะห์การลงทุนของคุณ โปรดเพิ่มสินทรัพย์ที่คุณถือครอง (เช่น หุ้น หรือ กองทุนรวม) ลงในพอร์ตผ่านทางเมนู **"เพิ่มรายการซื้อขาย"** เพื่อรับรายงานวิเคราะห์ความเสี่ยงและการจัดสรรสินทรัพย์อย่างเป็นระบบทันที`;
    }

    let report = `### 📊 บทวิเคราะห์พอร์ตโฟลิโอโดยระบบ AI

#### 1. ภาพรวมสุขภาพพอร์ตการลงทุน
พอร์ตโฟลิโอของคุณมีมูลค่ารวม **${analysis.totalValue.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท** บนต้นทุนรวม **${analysis.totalCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท** ซึ่งปัจจุบันมีผลตอบแทนสะสมเป็น **${analysis.totalGainLoss >= 0 ? 'กำไร' : 'ขาดทุน'} ${Math.abs(analysis.totalGainLoss).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท (${analysis.totalGainLossPercent.toFixed(2)}%)**
คะแนนการกระจายความเสี่ยงของพอร์ตอยู่ที่ **${analysis.diversificationScore}/100** โดยพอร์ตของคุณถูกประเมินว่ามีระดับความเสี่ยงเป็น **"ระดับ${analysis.riskLevel}"** (คะแนนความเสี่ยง ${analysis.riskScore}/100)

#### 2. การประเมินความเสี่ยงและคำเตือน
${analysis.warnings.map(w => `- ⚠️ ${w}`).join('\n')}
${analysis.warnings.length === 0 ? '- ✅ สัดส่วนการกระจายพอร์ตของคุณอยู่ในเกณฑ์ดีเยี่ยม ไม่พบสัญญาณความเสี่ยงการกระจุกตัวในขณะนี้' : ''}

#### 3. กลยุทธ์การจัดพอร์ตและคำแนะนำ
- **สำหรับประเภทสินทรัพย์**: พอร์ตของคุณลงทุนใน **หุ้น ${analysis.assetAllocations.find(a => a.type === 'stock')?.percentage.toFixed(1)}%** และ **กองทุนรวม ${analysis.assetAllocations.find(a => a.type === 'fund')?.percentage.toFixed(1)}%** 
${analysis.riskLevel === 'สูง' 
  ? '- แนะนำให้โอนย้ายเงินลงทุนบางส่วนไปยังกองทุนรวมตราสารหนี้ หรือกองทุนต่างประเทศที่มีความมั่นคงสูงเพื่อกระจายความเสี่ยงไม่ให้ผันผวนตามตลาดหุ้นไทยมากเกินไป' 
  : analysis.riskLevel === 'ต่ำ'
  ? '- พอร์ตของคุณมีความมั่นคงสูงมาก แต่หากคุณสามารถยอมรับความผันผวนเพื่อโอกาสในการสร้างความมั่งคั่งได้ แนะนำให้แบ่งสัดส่วน 10-20% มาลงทุนในหุ้นปันผล หรือหุ้นกลุ่มเทคโนโลยีระดับโลก'
  : '- สัดส่วนของคุณมีความสมดุลปานกลาง แนะนำรักษาอัตราส่วนและเข้าลงทุนแบบเฉลี่ยต้นทุน (DCA) อย่างสม่ำเสมอในสินทรัพย์หลักเพื่อสะสมมูลค่าระยะยาว'}

#### 4. หุ้น/กองทุนรวมที่น่าสนใจสำหรับการลงทุนเพิ่มเติม
ตามสถานะพอร์ตและระดับความเสี่ยงของคุณ AI แนะนำสินทรัพย์ดังต่อไปนี้เพื่อเสริมพอร์ต:
${analysis.suggestions.map(s => `- **${s.symbol}** (${s.type === 'stock' ? 'หุ้น' : 'กองทุนรวม'}): ${s.reason}`).join('\n')}
`;

    return report;
  }

  // Live Gemini Stress Test Report Generator
  public async generateStressTestReport(
    scenario: 'war' | 'rate' | 'pandemic' | 'bubble',
    analysis: PortfolioAnalysis,
    holdings: Holding[],
    _apiKey: string
  ): Promise<string> {
    const portfolioSummary = holdings.map(h => {
      const asset = financeApi.getAsset(h.symbol);
      const currentPrice = asset ? asset.price : h.avgCost;
      return `- ${h.symbol} (${asset?.type === 'stock' ? 'หุ้น' : 'กองทุนรวม'}): ซื้อเฉลี่ย ${h.avgCost}, ราคาปัจจุบัน ${currentPrice}, จำนวน ${h.quantity} หน่วย`;
    }).join('\n');

    let scenarioName = '';
    let scenarioDetail = '';
    if (scenario === 'war') {
      scenarioName = '💥 สงครามใหญ่ / วิกฤตภูมิรัฐศาสตร์รุนแรง (Geopolitical Conflict / War)';
      scenarioDetail = 'ความตึงเครียดของขั้วอำนาจโลกทวีความรุนแรง เกิดสงครามระดับภูมิภาค ส่งผลให้ราคาน้ำมันโลกดีดตัวพุ่งสูงอย่างรุนแรง (>120 USD/บาร์เรล) เกิดการชะงักงันของห่วงโซ่อุปทาน (Supply Chain Shock) ทั่วโลก และทำให้ความต้องการถือครองสินทรัพย์ปลอดภัยสูงขึ้นมาก เงินดอลลาร์สหรัฐฯ แข็งค่า ในขณะที่ตลาดหุ้นเทคโนโลยีและหุ้นเติบโตทั่วโลกได้รับผลกระทบรุนแรง';
    } else if (scenario === 'rate') {
      scenarioName = '📈 อัตราดอกเบี้ย FED พุ่งทะลุ 6% (FED Rate Spike > 6%)';
      scenarioDetail = 'ธนาคารกลางสหรัฐฯ (FED) ปรับขึ้นอัตราดอกเบี้ยนโยบายต่อเนื่องเพื่อสู้กับเงินเฟ้อฝังลึก จนทะลุระดับ 6.00% สูงที่สุดในรอบหลายสิบปี ส่งผลให้อัตราผลตอบแทนพันธบัตรรัฐบาล (Yield) ทะยานขึ้น สภาพคล่องในตลาดหดตัวอย่างรุนแรง มูลค่าหุ้นเติบโต (Growth Stocks) ที่มีกระแสเงินสดในอนาคตลดลง (Discount Rate สูงขึ้น) และกดดันมูลค่ากองทุนรวมอสังหาริมทรัพย์และ REITs';
    } else if (scenario === 'pandemic') {
      scenarioName = '☣️ วิกฤตโรคระบาดครั้งใหม่ทั่วโลก (Global Pandemic Crisis)';
      scenarioDetail = 'เกิดการแพร่ระบาดของไวรัสสายพันธุ์ใหม่ที่ร้ายแรง ส่งผลให้หลายประเทศประกาศล็อกดาวน์ ธุรกิจท่องเที่ยว การบิน และห้างร้านชะงักงัน ในขณะที่หุ้นกลุ่มดิจิทัล คลาวด์คอมพิวเตอร์ โลจิสติกส์การจัดส่ง และกลุ่มการแพทย์/วัคซีน ปรับตัวขึ้นต้านตลาด';
    } else {
      scenarioName = '📉 ฟองสบู่หุ้นเทคโนโลยีและ AI แตก (Tech & AI Bubble Burst)';
      scenarioDetail = 'การเก็งกำไรในหุ้นเทคโนโลยีและปัญญาประดิษฐ์ (AI) พุ่งถึงขีดสุดก่อนที่ผลประกอบการจริงจะออกมาต่ำกว่าคาด ส่งผลให้เกิดการเทขายอย่างรุนแรงในหุ้นเทคฯ ขนาดใหญ่ (Magnificent Seven) ดัชนี Nasdaq ดิ่งลงมากกว่า 30-40% ภายในระยะเวลาสั้นๆ กระทบต่อกองทุนรวมเทคโนโลยีทั่วโลก';
    }

    // Get feedback loop data from LocalStorage
    let feedbackText = '';
    try {
      const savedFeedback = localStorage.getItem('portfolio_tracker_feedback');
      if (savedFeedback) {
        const feedbackMap = JSON.parse(savedFeedback);
        const likes = Object.keys(feedbackMap).filter(k => feedbackMap[k] === 'like');
        const dislikes = Object.keys(feedbackMap).filter(k => feedbackMap[k] === 'dislike');
        if (likes.length > 0 || dislikes.length > 0) {
          feedbackText = `\nประวัติสไตล์การลงทุนที่ผู้ใช้เคยให้ข้อเสนอแนะไว้ (Feedback Loop):\n`;
          if (likes.length > 0) feedbackText += `- สินทรัพย์แนะนำที่ผู้ใช้สนใจ/ชอบสไตล์นี้: ${likes.join(', ')}\n`;
          if (dislikes.length > 0) feedbackText += `- สินทรัพย์แนะนำที่ผู้ใช้ปฏิเสธ/เลี่ยงสไตล์นี้: ${dislikes.join(', ')}\n`;
          feedbackText += `กรุณานำคำติชมความชอบนี้ไปคำนวณสไตล์การบริหารความเสี่ยงและปรับเปลี่ยนพอร์ตในการตอบด้วย\n`;
        }
      }
    } catch (e) {
      console.error(e);
    }

    const prompt = `
คุณเป็นผู้เชี่ยวชาญด้านการจำลองความเสี่ยงพอร์ตการลงทุน (Stress Test Expert) และที่ปรึกษาด้านการบริหารความเสี่ยงระดับสถาบัน
นี่คือข้อมูลพอร์ตของลูกค้าปัจจุบัน:
- มูลค่าพอร์ตรวม: ${analysis.totalValue.toLocaleString()} บาท
- ต้นทุนรวม: ${analysis.totalCost.toLocaleString()} บาท
- รายการสินทรัพย์:
${portfolioSummary}

สภาวะวิกฤตที่ต้องการทดสอบจำลอง (Stress Test Scenario):
หัวข้อ: ${scenarioName}
คำอธิบายเหตุการณ์: ${scenarioDetail}
${feedbackText}

คำสั่ง:
ให้วิเคราะห์พอร์ตการลงทุนนี้ภายใต้สภาวะวิกฤตดังกล่าวเป็นภาษาไทย ในรูปแบบ Markdown ที่สวยงาม โดยตอบคำถามหัวข้อดังนี้:
1. **ผลกระทบต่อพอร์ตโดยรวม** (ประเมินว่าตัวเลขมูลค่าพอร์ตจะลดลงประมาณกี่เปอร์เซ็นต์ เช่น คาดว่ามูลค่าพอร์ตอาจปรับตัวลดลงชั่วคราว -15% ถึง -25% เนื่องจากสัดส่วนของกองทุนเทคโนโลยีที่มีความผันผวนสูง หรือทนทานได้ดีเนื่องจากถือสินทรัพย์ปันผล)
2. **การวิเคราะห์รายสินทรัพย์ภายใต้ภัยคุกคาม** (เจาะลึกว่าแต่ละตัวในพอร์ตของเขา เช่น KFGG-A, CPALL จะทนทานหรือรับแรงกระแทกอย่างไร พร้อมให้เหตุผลสนับสนุน)
3. **แผนรับมือฉุกเฉินและการปรับพอร์ต (Stress Test Mitigation Plan)** (แนะนำสัดส่วนใหม่ที่ทนทานต่อวิกฤตนี้มากขึ้น เช่น ลดการถือครองตัวเสี่ยง เพิ่มทองคำ พันธบัตร หรือสินทรัพย์ปลอดภัยอย่างไร พร้อมแนะนำชื่อหุ้นหรือกองทุนที่ทนทานเป็นพิเศษ)

หากไม่มี API Key หรือการเรียกใช้งานขัดข้อง ให้ใช้โมเดลวิเคราะห์เชิงคาดการณ์แบบเป็นระบบและสมเหตุสมผลตามหลักการจัดพอร์ตการลงทุนสากล
`;

    if (!_apiKey) {
      return this.generateOfflineStressTest(scenario, analysis, holdings);
    }

    const config = financeApi.getConfig();
    const model = config.selectedModel || 'gemini-3.5-flash';

    try {
      const response = await fetch(
        '/api/gemini',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Gemini-Model': model },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        }
      );
      if (!response.ok) throw new Error(`Gemini API returned: ${response.status}`);
      const data = await response.json();
      const stressTestReport = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!stressTestReport) throw new Error('No content from Gemini');
      financeApi.incrementApiUsage();
      return stressTestReport;
    } catch (e) {
      console.error(e);
      return this.generateOfflineStressTest(scenario, analysis, holdings);
    }
  }

  private generateOfflineStressTest(
    scenario: 'war' | 'rate' | 'pandemic' | 'bubble',
    _analysis: PortfolioAnalysis,
    _holdings: Holding[]
  ): string {
    let report = '';
    if (scenario === 'war') {
      report = `### 💥 รายงานการทดสอบจำลอง: สงครามใหญ่ / วิกฤตภูมิรัฐศาสตร์รุนแรง
      
#### 1. ผลกระทบต่อพอร์ตโดยรวม
* **การปรับตัวชั่วคราวที่คาดการณ์**: ปรับลดลงประมาณ **-12% ถึง -20%**
* **ระดับความต้านทาน**: ปานกลาง
* **เหตุผล**: หุ้นกลุ่มเทคโนโลยีและกองทุนต่างประเทศหลักของคุณ (เช่น KFGTECH-A, KFGG-A) จะเผชิญกับการลดระดับมูลค่าอย่างรวดเร็วเนื่องจากนักลงทุนหนีเข้าถือดอลลาร์สหรัฐและทองคำ อย่างไรก็ตาม หากพอร์ตมีสินทรัพย์กลุ่มสินค้าบริโภคพื้นฐานหรือกองทุนตราสารหนี้ปันผล จะช่วยพยุงลดแรงกระแทกได้บ้าง

#### 2. การวิเคราะห์รายสินทรัพย์
* **KFGTECH-A / KFGG-A**: เผชิญแรงเทขายรุนแรงในฐานะสินทรัพย์เสี่ยงสูง คาดว่าอาจย่อตัวลงแรง
* **K-USXNDQRMF**: ทรงตัวดีกว่าเนื่องจากเป็นหุ้นสหรัฐฯ ดัชนีหลัก แต่ยังคงผันผวนสูง
* **K-WPULTIMATE**: เผชิญความผันผวนปานกลางจากการลงทุนแบบผสม

#### 3. แผนรับมือฉุกเฉิน (Mitigation Plan)
* **การลดน้ำหนัก**: แนะนำทยอยแบ่งกำไรจากกลุ่มเทคโนโลยีที่มีระดับ Beta สูงลงชั่วคราว
* **สินทรัพย์แนะนำเข้าพอร์ตเสริม**: 
  1. **ทองคำ (Gold)**: เช่น กองทุนรวมทองคำเพื่อป้องกันมูลค่าพอร์ตสลายตัว
  2. **กองทุนรวมตราสารหนี้ระยะสั้น / พันธบัตรรัฐบาล**: เพื่อเตรียมสภาพคล่องไว้ช้อนซื้อหลังวิกฤตผ่านพ้น`;
    } else if (scenario === 'rate') {
      report = `### 📈 รายงานการทดสอบจำลอง: อัตราดอกเบี้ย FED พุ่งทะลุ 6%
      
#### 1. ผลกระทบต่อพอร์ตโดยรวม
* **การปรับตัวชั่วคราวที่คาดการณ์**: ปรับลดลงประมาณ **-15% ถึง -25%**
* **ระดับความต้านทาน**: ต่ำ
* **เหตุผล**: ดอกเบี้ย 6% จะกดดัน Discount Rate ของมูลค่าหุ้นกลุ่มเติบโต (Growth Stocks) ทุกตัวลดลงอย่างมีนัยสำคัญ กองทุนหลักในพอร์ตของคุณที่เน้นหุ้นเติบโตและเทคฯ จะโดนกดดันโดยตรง

#### 2. การวิเคราะห์รายสินทรัพย์
* **KFGTECH-A / K-USXNDQRMF**: มีความเสี่ยงปรับลดลงสูงสุด เนื่องจากมีสัดส่วนกลุ่ม High-Growth สูง ซึ่งแพ้ดอกเบี้ยขาขึ้น
* **K-WPULTIMATE**: ได้รับผลกระทบจำกัดกว่าเนื่องจากมีการปรับสัดส่วนตราสารหนี้ในพอร์ตประคอง

#### 3. แผนรับมือฉุกเฉิน (Mitigation Plan)
* **การปรับสมดุล**: ลดน้ำหนักหุ้นเติบโตชั่วคราว
* **สินทรัพย์แนะนำเข้าพอร์ตเสริม**:
  1. **กองทุนรวมตราสารหนี้ระยะสั้น (Short-term Fixed Income)**: ที่ได้รับประโยชน์โดยตรงจากยีลด์ที่ปรับตัวขึ้น
  2. **หุ้นคุณค่าปันผลสูง (High-Dividend Value Stocks)**: เช่น กลุ่มการเงินหรือกลุ่มสาธารณูปโภคที่กระแสเงินสดแข็งแกร่ง`;
    } else if (scenario === 'pandemic') {
      report = `### ☣️ รายงานการทดสอบจำลอง: วิกฤตโรคระบาดระลอกใหม่ทั่วโลก
      
#### 1. ผลกระทบต่อพอร์ตโดยรวม
* **การปรับตัวชั่วคราวที่คาดการณ์**: ปรับลดลงประมาณ **-8% ถึง -15%** (มีผลต้านตลาดได้ค่อนข้างดี)
* **ระดับความต้านทาน**: สูง
* **เหตุผล**: พอร์ตของคุณมีกองทุนกลุ่มเทคโนโลยี (KFGTECH-A, K-USXNDQRMF) ซึ่งมักเป็นกลุ่มที่ได้ประโยชน์จากการปรับเปลี่ยนพฤติกรรมเข้าสู่โลกออนไลน์และทำงานจากที่บ้าน (Work From Home) ทำให้ได้รับแรงหนุนช่วยลดแรงลบจากตลาดหุ้นปกติ

#### 2. การวิเคราะห์รายสินทรัพย์
* **KFGTECH-A / K-USXNDQRMF**: คาดว่าจะกลับมาฟื้นตัวได้อย่างรวดเร็วและ Outperform ตลาดรวม
* **KFGG-A / K-WPULTIMATE**: เผชิญแรงผันผวนจากการชะลอตัวทางเศรษฐกิจทั่วโลก

#### 3. แผนรับมือฉุกเฉิน (Mitigation Plan)
* **สินทรัพย์แนะนำเข้าพอร์ตเสริม**:
  1. **หุ้นกลุ่มเทคโนโลยีเชิงลึก / คลาวด์คอมพิวเตอร์**: ซื้อเพิ่มเมื่อราคาย่อตัวลงมา
  2. **กองทุนกลุ่ม Healthcare / เวชภัณฑ์**: เพื่อเพิ่มเกราะป้องกันพอร์ตสะสมมูลค่า`;
    } else {
      report = `### 📉 รายงานการทดสอบจำลอง: ฟองสบู่หุ้นเทคโนโลยีและ AI แตก
      
#### 1. ผลกระทบต่อพอร์ตโดยรวม
* **การปรับตัวชั่วคราวที่คาดการณ์**: ปรับลดลงประมาณ **-20% ถึง -35%**
* **ระดับความต้านทาน**: ต่ำมาก (ความเสี่ยงสูง)
* **เหตุผล**: พอร์ตลงทุนของคุณเน้นสัดส่วนของกองทุนกลุ่มเทคโนโลยีและดัชนีสหรัฐฯ ขนาดใหญ่อย่างหนาแน่น (KFGTECH-A, K-USXNDQRMF, KFGG-A) เมื่อฟองสบู่เทคโนโลยีแตก จะส่งผลให้กลุ่มนี้โดนถล่มเทขายหนักที่สุดในรอบทศวรรษ

#### 2. การวิเคราะห์รายสินทรัพย์
* **KFGTECH-A / K-USXNDQRMF**: ปรับย่อตัวลงลึกตามดัชนี Nasdaq 100 และดัชนีหุ้นเทคฯ โดนดึงมูลค่าลดลงสูงสุด
* **KFGG-A / K-WPULTIMATE**: ได้รับผลกระทบลดหลั่นลงมาตามลำดับจากสภาวะอารมณ์ตกใจของตลาดตลาด

#### 3. แผนรับมือฉุกเฉิน (Mitigation Plan)
* **การปรับสมดุล**: ลดน้ำหนักกลุ่มเทคโนโลยีลงทันทีเพื่อความปลอดภัย รักษาสภาพคล่อง
* **สินทรัพย์แนะนำเข้าพอร์ตเสริม**:
  1. **กองทุนรวมตลาดเงิน (Money Market Funds)**: เพื่อรักษามูลค่าเงินต้นให้ปลอดภัย 100%
  2. **หุ้นกลุ่มตั้งรับบริโภคพื้นฐาน (Defensive Value Stocks)**: เช่น หุ้นกลุ่มค้าปลีก โรงพยาบาล หรือสาธารณูปโภคเพื่อหาผลตอบแทนสม่ำเสมอ`;
    }
    return report;
  }

  public async scanHoldings(holdings: Holding[], currentPrices: Record<string, Asset>, _apiKey: string): Promise<Record<string, ScanResult>> {
    if (!_apiKey) {
      throw new Error('กรุณาตั้งค่า API Key เพื่อสแกนหาจุดซื้อ/ขาย');
    }

    const portfolioSummary = holdings.map(h => {
      const asset = currentPrices[h.symbol.toUpperCase()];
      const currentPrice = asset ? asset.price : h.avgCost;
      const profitLoss = (currentPrice - h.avgCost) * h.quantity;
      const profitLossPercent = (profitLoss / (h.avgCost * h.quantity)) * 100;
      return `- ${h.symbol.toUpperCase()}: ต้นทุน ฿${h.avgCost}, ปัจจุบัน ฿${currentPrice}, กำไร/ขาดทุน ${profitLossPercent.toFixed(2)}%`;
    }).join('\n');

    const prompt = `
คุณคือ AI Advisor ด้านการลงทุน
จงสแกนรายการสินทรัพย์ต่อไปนี้และประเมินว่าแต่ละตัวอยู่ในสถานะใด (overheating, underperforming, hold, หรือ accumulate)
- overheating (🔥): กำไรสูงมาก น่าพิจารณาขายทำกำไร
- underperforming (🧊): ขาดทุนหนักหรือย่ำแย่ น่าพิจารณาตัดขาดทุน
- hold (🛡️): พื้นฐานดีหรือกำไร/ขาดทุนยังอยู่ในกรอบปกติ ถือต่อไปได้
- accumulate (🚀): ราคาปรับลดลงมาต่ำกว่าต้นทุนเฉลี่ยพอสมควร น่าสนใจในการเข้าสะสม/ซื้อเพิ่ม

รายการสินทรัพย์:
${portfolioSummary}

จงตอบกลับเป็นรูปแบบ JSON เท่านั้น โดยให้ key เป็นชื่อสัญลักษณ์ (symbol) และ value เป็น object ที่มี "status" (overheating/underperforming/hold/accumulate) และ "reason" (เหตุผลสั้นๆ ไม่เกิน 2 ประโยค)
ตัวอย่าง:
{
  "CPALL": { "status": "hold", "reason": "กำไร/ขาดทุนอยู่ในเกณฑ์ปกติ ถือลงทุนระยะยาวได้" },
  "NVDA": { "status": "overheating", "reason": "ราคาปรับขึ้นมาสูงมาก พิจารณาขายทำกำไรบางส่วน" },
  "AAPL": { "status": "accumulate", "reason": "ราคาปัจจุบันต่ำกว่าต้นทุนเฉลี่ยมาก เป็นโอกาสดีที่จะสะสมเพิ่ม" }
}
`;

    const config = financeApi.getConfig();
    const model = (config.selectedModel || 'gemini-3.1-flash-lite').trim();

    try {
      const response = await fetch(
        '/api/gemini',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Gemini-Model': model },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' }
          })
        }
      );

      if (!response.ok) throw new Error(`Gemini API Error: ${response.status}`);

      const data = await response.json();
      const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!answer) throw new Error('No answer from AI');
      
      financeApi.incrementApiUsage();
      return JSON.parse(answer);
    } catch (e: any) {
      console.error('Scan Error:', e);
      throw new Error(e.message || 'สแกนล้มเหลว');
    }
  }
}

export const aiService = new AiService();
