import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { StockPosition, InvestmentStrategy, AnalysisResult } from "../types";

export const generatePDFReport = (
  portfolio: StockPosition[],
  strategy: InvestmentStrategy,
  analysis: AnalysisResult | null
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  let yPos = 20;

  // --- HEADER ---
  doc.setFont("times", "bold");
  doc.setFontSize(24);
  doc.text("Investment Diary Report", pageWidth / 2, yPos, { align: "center" });
  yPos += 10;
  
  doc.setFontSize(12);
  doc.setFont("times", "italic");
  doc.text(`Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, pageWidth / 2, yPos, { align: "center" });
  yPos += 15;
  
  doc.setDrawColor(200, 200, 200);
  doc.line(15, yPos, pageWidth - 15, yPos);
  yPos += 15;

  // --- STRATEGY SECTION ---
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.text("Manifesto & Strategy", 15, yPos);
  yPos += 8;

  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.text(`Primary Goal: ${strategy.goal}`, 15, yPos);
  yPos += 6;
  doc.text(`Risk Tolerance: ${strategy.riskTolerance}`, 15, yPos);
  yPos += 6;
  doc.text(`Investment Horizon: ${strategy.horizonYears} years`, 15, yPos);
  yPos += 8;
  
  if (strategy.notes) {
      doc.setFont("times", "italic");
      doc.setTextColor(80, 80, 80);
      const splitNotes = doc.splitTextToSize(`"Note to self: ${strategy.notes}"`, pageWidth - 30);
      doc.text(splitNotes, 15, yPos);
      doc.setTextColor(0, 0, 0);
      yPos += (splitNotes.length * 5) + 10;
  }

  // --- PORTFOLIO SUMMARY ---
  const totalValue = portfolio.reduce((acc, stock) => acc + (stock.shares * (stock.currentPrice || stock.avgBuyPrice)), 0);
  const totalCost = portfolio.reduce((acc, stock) => acc + (stock.shares * stock.avgBuyPrice), 0);
  const totalGain = totalValue - totalCost;
  const totalGainPercent = totalCost ? (totalGain / totalCost) * 100 : 0;

  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.text("Portfolio Ledger", 15, yPos);
  yPos += 8;

  const summaryData = [
      [`Net Worth: PKR ${totalValue.toLocaleString()}`, `Total Cost: PKR ${totalCost.toLocaleString()}`, `Total Return: ${totalGainPercent.toFixed(2)}%`]
  ];
  
  autoTable(doc, {
      startY: yPos,
      head: [],
      body: summaryData,
      theme: 'plain',
      styles: { font: 'times', fontSize: 12, fontStyle: 'bold' },
      columnStyles: { 0: { textColor: [0,0,0] }, 2: { textColor: totalGain >= 0 ? [5, 150, 105] : [225, 29, 72] } }
  });
  
  // @ts-ignore
  yPos = doc.lastAutoTable.finalY + 5;

  const tableData = portfolio.map(s => {
      const current = s.currentPrice || s.avgBuyPrice;
      const val = current * s.shares;
      const gain = val - (s.avgBuyPrice * s.shares);
      return [
          s.symbol,
          s.shares.toString(),
          s.avgBuyPrice.toFixed(2),
          current.toFixed(2),
          val.toLocaleString(),
          `${gain >= 0 ? '+' : ''}${gain.toLocaleString()}`
      ];
  });

  autoTable(doc, {
      startY: yPos,
      head: [['Asset', 'Qty', 'Avg Cost', 'Price', 'Value (PKR)', 'Gain/Loss']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85], font: 'times' },
      styles: { font: 'times', fontSize: 10 },
      columnStyles: { 5: { fontStyle: 'bold' } }
  });

  // @ts-ignore
  yPos = doc.lastAutoTable.finalY + 15;

  // --- ANALYSIS SECTION ---
  if (analysis) {
      if (yPos > 200) {
          doc.addPage();
          yPos = 20;
      }

      doc.setFont("times", "bold");
      doc.setFontSize(18);
      doc.setTextColor(70, 70, 90);
      doc.text("Advisor Analysis & Insights", 15, yPos);
      yPos += 10;
      doc.setTextColor(0, 0, 0);

      // Scores
      doc.setFontSize(12);
      doc.text(`Portfolio Health Score: ${analysis.score}/100`, 15, yPos);
      doc.text(`Manifesto Alignment: ${analysis.manifestoAlignmentScore}%`, pageWidth / 2, yPos);
      yPos += 8;
      
      doc.text(`Market Sentiment: ${analysis.marketSentiment.overall} (${analysis.marketSentiment.score}/100)`, 15, yPos);
      yPos += 12;

      // Executive Summary
      doc.setFont("times", "bold");
      doc.text("Executive Summary:", 15, yPos);
      yPos += 6;
      doc.setFont("times", "normal");
      const summaryText = doc.splitTextToSize(analysis.summary, pageWidth - 30);
      doc.text(summaryText, 15, yPos);
      yPos += (summaryText.length * 5) + 10;

      // Dividends
      if (analysis.dividendForecast) {
          doc.setFont("times", "bold");
          doc.text("Dividend Forecast:", 15, yPos);
          yPos += 6;
          doc.setFont("times", "normal");
          doc.text(`Estimated Annual Income: PKR ${analysis.dividendForecast.estimatedAnnualIncome.toLocaleString()}`, 15, yPos);
          yPos += 5;
          doc.text(`Portfolio Yield: ${analysis.dividendForecast.portfolioYield.toFixed(2)}%`, 15, yPos);
          yPos += 5;
          doc.text(`Top Payer: ${analysis.dividendForecast.topPayer}`, 15, yPos);
          yPos += 10;
      }

      // Actionable Moves Table
      if (analysis.actionableMoves.length > 0) {
          if (yPos > 230) {
              doc.addPage();
              yPos = 20;
          }
          doc.setFont("times", "bold");
          doc.text("Recommended Moves:", 15, yPos);
          yPos += 5;

          const movesData = analysis.actionableMoves.map(m => [m.type, m.symbol, m.reason]);
          
          autoTable(doc, {
              startY: yPos,
              head: [['Action', 'Symbol', 'Reasoning']],
              body: movesData,
              theme: 'striped',
              headStyles: { fillColor: [70, 70, 90] },
              styles: { font: 'times' },
              columnStyles: { 
                  0: { fontStyle: 'bold' }
              }
          });
      }
      
      // Risk Assessment (if space allows)
      // @ts-ignore
      yPos = doc.lastAutoTable.finalY + 15;
      
      if (analysis.riskAssessment) {
           if (yPos > 230) {
              doc.addPage();
              yPos = 20;
          }
          doc.setFont("times", "bold");
          doc.text("Risk Assessment Notes:", 15, yPos);
          yPos += 6;
          doc.setFont("times", "normal");
          // Simple cleanup of markdown symbols for PDF
          const cleanRisk = analysis.riskAssessment.replace(/\*\*/g, '').replace(/\*/g, '-');
          const riskText = doc.splitTextToSize(cleanRisk, pageWidth - 30);
          doc.text(riskText, 15, yPos);
      }
  } else {
      yPos += 10;
      doc.setFont("times", "italic");
      doc.setTextColor(150, 150, 150);
      doc.text("No AI analysis has been generated for this report.", 15, yPos);
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for(let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setTextColor(150,150,150);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - 20, doc.internal.pageSize.height - 10, {align:'right'});
  }

  doc.save(`Investment_Diary_Report_${new Date().toISOString().split('T')[0]}.pdf`);
};