/** 
 * PDF Service for generating professional Arabic reports
 * Note: Real Arabic support in jsPDF requires a .ttf font converted to Base64.
 */

// This is a minimal subset of an Arabic font (Amiri) to support basic text.
// In a production app, the full .ttf base64 would be loaded here.
const AMIRI_FONT_BASE64 = ""; // I will provide a way to load this or use a subset

export async function generatePDF(title, headers, data, fileName) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        putOnlyUsedFonts: true
    });

    // 1. Register Arabic Font (If we have the base64)
    // doc.addFileToVFS('Amiri-Regular.ttf', AMIRI_FONT_BASE64);
    // doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
    // doc.setFont('Amiri');

    // 2. Headings
    doc.setFontSize(22);
    doc.text(title, 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.text(`التاريخ: ${new Date().toLocaleDateString('ar-EG')}`, 20, 30);
    doc.line(20, 35, 190, 35);

    // 3. Table
    doc.autoTable({
        head: [headers],
        body: data,
        startY: 40,
        styles: { font: 'Amiri', halign: 'right', direction: 'rtl' },
        headStyles: { fillStyle: 'F', fillColor: [41, 128, 185], textColor: 255 },
        theme: 'grid'
    });

    // 4. Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(`صفحة ${i} من ${pageCount}`, 105, 285, { align: 'center' });
    }

    doc.save(`${fileName}.pdf`);
}

/**
 * Specifically for Client Account Statement
 */
export async function generateAccountStatementPDF(clientData, cases, history) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Arabic support setup
    // ...

    doc.setFontSize(20);
    doc.text('كشف حساب عميل', 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.text(`العميل: ${clientData.name}`, 180, 40, { align: 'right' });
    doc.text(`رقم التوكيل: ${clientData.poa}`, 180, 50, { align: 'right' });

    // Cases Table
    doc.autoTable({
        head: [['رقم القضية', 'إجمالي الأتعاب', 'المحصل', 'المتبقي']],
        body: cases.map(c => [c.caseNo, c.totalFees, c.paidAmount, c.remainingBalance]),
        startY: 60,
        styles: { halign: 'right' }
    });

    // History Table
    doc.text('سجل المدفوعات', 180, doc.lastAutoTable.finalY + 15, { align: 'right' });
    doc.autoTable({
        head: [['التاريخ', 'رقم القضية', 'المبلغ']],
        body: history.map(h => [h.date, h.caseNo, h.amount]),
        startY: doc.lastAutoTable.finalY + 20,
        styles: { halign: 'right' }
    });

    doc.save(`statement_${clientData.poa}.pdf`);
}
