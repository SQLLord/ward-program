// PDFGenerator.js — with per-panel dynamic font sizes
import { jsPDF } from 'jspdf';
import { fetchUrlAsBase64 } from '../utils/imageUtils';
import { resolveImgHeight, COVER_PANEL_HEIGHT_IN } from '../utils/coverImageUtils';
import { getResolvedSizes } from '../utils/printSettingsUtils';
import { logger } from '../utils/logger';

// ── Image placeholder ────────────────────────────────────────────────────────
const drawImagePlaceholder = (pdf, x, y, width, height) => {
  pdf.setFillColor(230, 230, 230);
  pdf.setDrawColor(160, 160, 160);
  pdf.setLineWidth(0.02);
  pdf.rect(x, y, width, height, 'FD');
  pdf.setDrawColor(180, 180, 180);
  pdf.setLineWidth(0.01);
  pdf.rect(x + 0.1, y + 0.1, width - 0.2, height - 0.2);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(120, 120, 120);
  pdf.text('[ Cover Image ]', x + width / 2, y + height / 2 - 0.1, { align: 'center' });
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'italic');
  pdf.text('(Image could not be loaded)', x + width / 2, y + height / 2 + 0.2, { align: 'center' });
  pdf.setTextColor(0, 0, 0);
  pdf.setDrawColor(0, 0, 0);
};


export const generateProgramPDF = async (programProp, wardDefaults = { leadership: [], schedules: [] }) => {
  // ── Work on a deep clone — never mutate the caller's state object ─────────
  const program = JSON.parse(JSON.stringify(programProp));

  try {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'in', format: 'letter' });

    const pageWidth  = 11;
    const pageHeight = 8.5;
    const margin     = 0.3;
    const halfWidth  = (pageWidth - margin * 2) / 2;
    const centerX    = pageWidth / 2;

    // ── Resolve per-panel font sizes ────────────────────────────────────────
    const coverSizes   = getResolvedSizes(program.cover?.printSettings);
    const meetSizes    = getResolvedSizes(program.meetingOrder?.printSettings);
    const annSizes     = getResolvedSizes(program.announcementSettings);
    const leaderSizes  = getResolvedSizes(program.leadershipSettings);
    
    const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api')
      .replace(/\/api$/, '');


    // ── Table helper ───────────────────────────────────────────────────────────
    const drawTable = (headers, rows, startX, startY, colWidths, sizes) => {
      let y = startY;

      // ── Scale row height to font size ────────────────────────────────────────
      // Base row height was designed for ~7-8pt. Scale proportionally.
      const baseRowHeight = 0.20;
      const baseFontPt = 8;
      const scaledRowHeight = baseRowHeight * (sizes.bodyPt / baseFontPt);
      const cellPadX = 0.05;
      const cellPadY = scaledRowHeight * 0.70; // vertical text baseline offset within row

      const totalWidth = colWidths.reduce((a, b) => a + b, 0);

      // ── Header row ───────────────────────────────────────────────────────────
      const headerRowH = scaledRowHeight * (sizes.headingPt / sizes.bodyPt);
      pdf.setFillColor(41, 128, 185);
      pdf.rect(startX, y, totalWidth, headerRowH, 'F');
      pdf.setFontSize(sizes.headingPt);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 255, 255);
      let x = startX + cellPadX;
      headers.forEach((header, i) => {
        pdf.text(header, x, y + headerRowH * 0.70);
        x += colWidths[i];
      });
      y += headerRowH;

      // ── Data rows ────────────────────────────────────────────────────────────
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(sizes.bodyPt);

      rows.forEach((row, idx) => {
        // ── Pre-wrap all cells to find the tallest cell in this row ─────────────
        const wrappedCells = row.map((cell, i) => {
          const maxW = colWidths[i] - cellPadX * 2;
          return pdf.splitTextToSize(String(cell ?? ''), maxW);
        });
        const maxLines = Math.max(...wrappedCells.map(lines => lines.length));
        const rowH = Math.max(scaledRowHeight, maxLines * scaledRowHeight);

        // ── Alternating row background ───────────────────────────────────────────
        if (idx % 2 === 0) {
          pdf.setFillColor(240, 240, 240);
          pdf.rect(startX, y, totalWidth, rowH, 'F');
        }

        // ── Draw each wrapped cell ───────────────────────────────────────────────
        x = startX + cellPadX;
        wrappedCells.forEach((lines, i) => {
          lines.forEach((line, lineIdx) => {
            pdf.text(line, x, y + cellPadY + lineIdx * scaledRowHeight);
          });
          x += colWidths[i];
        });

        y += rowH;
      });

      // ── Outer border ─────────────────────────────────────────────────────────
      pdf.setDrawColor(0);
      pdf.setLineWidth(0.01);
      pdf.rect(startX, startY, totalWidth, y - startY);

      return y;
    };

    // =========================================================================
    // PAGE 1 — LEFT: Leadership & Schedules
    // =========================================================================
    let yPos = margin;

    // ── Resolve leadership ───────────────────────────────────────────────────
    const useDefaultLeadership = program.useDefaultLeadership
      ?? (program.leadershipMode === 'default')
      ?? true;
    const leadershipRows = (!useDefaultLeadership && program.leadership?.length > 0)
      ? program.leadership
      : wardDefaults.leadership;


    if (leadershipRows.length > 0) {
      pdf.setFontSize(leaderSizes.titlePt);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Ward Leadership', margin + 0.1, yPos + leaderSizes.headingLineH);

      const leadershipData = leadershipRows.map(l => [
        l.role ?? '', l.name ?? '', l.phone ?? '',
      ]);
      yPos = drawTable(
        ['Role', 'Name', 'Phone'],
        leadershipData,
        margin,
        yPos + leaderSizes.headingLineH + 0.1,
        [1.5, 1.9, 1.6],   // ← 5.0" total, 0.2" gap before center divider
        leaderSizes
      ) + 0.3;

    }


    // ── Resolve schedules ────────────────────────────────────────────────────
    const useDefaultSchedules = program.useDefaultSchedules
      ?? (program.schedulesMode === 'default')
      ?? true;
    const scheduleRows = (!useDefaultSchedules && program.schedules?.length > 0)
      ? program.schedules
      : wardDefaults.schedules;

    if (scheduleRows.length > 0) {
      pdf.setFontSize(leaderSizes.titlePt);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Meeting Schedules', margin + 0.1, yPos + leaderSizes.headingLineH * 0.8);

      const scheduleData = scheduleRows.map(s => [
        s.organization ?? '',
        s.day ?? '',
        s.meeting_time ?? s.time ?? '',
      ]);
      drawTable(
        ['Organization', 'Day', 'Time'],
        scheduleData,
        margin,
        yPos + leaderSizes.headingLineH + 0.05,
        [2.1, 1.5, 1.4],   // ← 5.0" total, 0.2" gap before center divider
        leaderSizes
      );

    }

    // Center line — Page 1
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.02);
    pdf.line(centerX, margin, centerX, pageHeight - margin);

    // =========================================================================
    // PAGE 1 — RIGHT: Cover Panel
    // =========================================================================
    const coverX    = centerX + 0.3;
    const coverPanelH = pageHeight - margin * 2;  // 7.9"
    const coverW    = halfWidth - 0.6;

    const coverLayout = program.cover?.layout ?? [
      { id: 'date',  type: 'date'  },
      { id: 'image', type: 'image' },
      { id: 'quote', type: 'quote' },
    ];

    const hasImageBlock = coverLayout.some(b => (b?.type ?? b) === 'image');
    const hasImageData  = !!(program.cover?.image || program.cover?.imageUrl);
    if (!hasImageBlock && hasImageData) {
      const dateIdx  = coverLayout.findIndex(b => (b?.type ?? b) === 'date');
      const insertAt = dateIdx >= 0 ? dateIdx + 1 : 0;
      coverLayout.splice(insertAt, 0, { id: 'image-injected', type: 'image' });
    }

    let imgHeight = resolveImgHeight(program.cover);
    imgHeight = Math.min(imgHeight, COVER_PANEL_HEIGHT_IN);

    // ── PASS 1: Measure total content height ──────────────────────────────────
    const measureBlock = (block) => {
      const blockType = typeof block === 'string' ? block : block?.type;
      if (!blockType) return 0;
      if (program.cover?.imageBleed && blockType === 'image') return 0;
      switch (blockType) {
        case 'date':
          return program.date ? coverSizes.titleLineH + 0.2 : 0;
        case 'image':
          return imgHeight + 0.3;
        
        case 'quote': {
          let h = 0;
          const quoteText = block?.quoteText ?? '';
          const attrText  = block?.attributionText ?? '';
          if (quoteText) {
            const quoteLines = Math.ceil(
              `"${quoteText}"`.length / Math.floor(coverW / (coverSizes.bodyPt * 0.0138 * 0.6))
            );
            h += Math.max(1, quoteLines) * coverSizes.bodyLineH + 0.2;
          }
          if (attrText) h += coverSizes.subLineH + 0.2;
          if (!quoteText && !attrText) h += coverSizes.bodyLineH + 0.2;
          return h;
        }

        case 'welcome':
          return coverSizes.headingLineH + 0.35 + 0.1;
        case 'custom': {
          const text = block?.customText ?? '';
          if (text.trim()) {
            const lines = Math.ceil(
              text.length / Math.floor(coverW / (coverSizes.bodyPt * 0.0138 * 0.6))
            );
            return Math.max(1, lines) * coverSizes.bodyLineH + 0.2;
          }
          return coverSizes.bodyLineH + 0.2;
        }
        default: return 0;
      }
    };

    // Only measure non-bleed blocks
    const isBleed = program.cover?.imageBleed ?? false;
    const totalContentH = isBleed
      ? 0  // bleed fills whole panel — no centering needed
      : coverLayout.reduce((sum, block) => sum + measureBlock(block), 0);

    // ── Compute centered start Y ──────────────────────────────────────────────
    const centeringOffset = isBleed
      ? 0
      : Math.max(0, (coverPanelH - totalContentH) / 2);

    let coverY = margin + centeringOffset;
    
    const coverBottom = margin + coverPanelH; // = 0.3 + 7.9 = 8.2"

    // ── PASS 2: Render — identical to before ─────────────────────────────────
    for (const block of coverLayout) {
      const blockType = typeof block === 'string' ? block : block?.type;
      if (!blockType) continue;
      if (coverY >= coverBottom - 0.15) continue; // prevent overflow (with 0.15" tolerance for final block)

      // ── DATE ──────────────────────────────────────────────────────────────
      if (blockType === 'date' && program.date) {
        pdf.setFontSize(coverSizes.titlePt);
        pdf.setFont('helvetica', 'bold');
        const formattedDate = new Date(program.date + 'T00:00:00').toLocaleDateString('en-US', {
          month: 'long', day: 'numeric', year: 'numeric',
        });
        const dateWidth = pdf.getTextWidth(formattedDate);
        pdf.text(
          formattedDate,
          coverX + (halfWidth - 0.3) / 2 - dateWidth / 2,
          coverY + coverSizes.titleLineH
        );
        coverY += coverSizes.titleLineH + 0.2;
      }

      // ── IMAGE ───────────────────────────────────────────────────────────────
      else if (blockType === 'image') {
        const imgX = isBleed ? centerX : coverX;
        const imgWidth = isBleed ? (pageWidth - centerX) : (halfWidth - 0.6);
        const imgY = isBleed ? 0 : coverY;
        const imgH = isBleed ? pageHeight : imgHeight;

        // ── Refresh SAS URL if image is from the library ──────────────────────
        // SAS URLs expire after 60 min — fetch a fresh one before rendering

        if (program.cover?.imageSource === 'library' && program.cover?.imageId) {
          try {
            const serveUrl = `${API_BASE}/api/images/${program.cover.imageId}/serve`;
            // ── Fetch with credentials (cookie auth) — do NOT go through proxy ──
            const res = await fetch(serveUrl, { credentials: 'include' });
            if (res.ok) {
              const blob = await res.blob();
              const base64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
              });
              if (base64) program.cover.image = base64;
            }
          } catch (e) {
            logger.warn('[PDF] Could not fetch library image:', e.message);
          }
        }


        const imageSrc = program.cover?.image ?? program.cover?.imageUrl;

        if (!imageSrc) {
          drawImagePlaceholder(pdf, imgX, imgY, imgWidth, imgH);
          if (!isBleed) coverY += imgHeight + 0.3;
          continue;
        }

        let imageData = null;
        if (imageSrc.startsWith('data:')) {
          imageData = imageSrc;
        } else {
          
          try {
            // ── Use credentialed fetch for own API URLs, proxy for external ──────
            if (imageSrc.startsWith(API_BASE)) {
              const res = await fetch(imageSrc, { credentials: 'include' });
              if (res.ok) {
                const blob = await res.blob();
                imageData = await new Promise((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result);
                  reader.readAsDataURL(blob);
                });
              }
            } else {
              imageData = await fetchUrlAsBase64(imageSrc);  // ← proxy for external URLs
            }
          } catch (e) { logger.warn('fetchUrlAsBase64 threw:', e.message); }

        }

        if (imageData) {
          try {
            const nativeDims = await new Promise((resolve) => {
              const img = new Image();
              img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
              img.onerror = () => resolve(null);
              img.src = imageData;
            });
            if (isBleed) {
              let drawX = imgX, drawY = imgY, drawW = imgWidth, drawH = imgH;
              if (nativeDims) {
                const scale = Math.max(imgWidth / nativeDims.w, imgH / nativeDims.h);
                drawW = nativeDims.w * scale;
                drawH = nativeDims.h * scale;
                drawX = imgX + (imgWidth - drawW) / 2;
                drawY = imgY + (imgH - drawH) / 2;
              }
              pdf.saveGraphicsState();
              pdf.rect(imgX, imgY, imgWidth, imgH, null);
              pdf.clip(); pdf.discardPath();
              pdf.addImage(imageData, 'JPEG', drawX, drawY, drawW, drawH, undefined, 'NONE');
              pdf.restoreGraphicsState();
            } else {
              let drawX = imgX, drawY = coverY, drawW = imgWidth, drawH = imgHeight;
              if (nativeDims) {
                const scale = Math.max(imgWidth / nativeDims.w, imgHeight / nativeDims.h);
                drawW = nativeDims.w * scale;
                drawH = nativeDims.h * scale;
                drawX = imgX + (imgWidth - drawW) / 2;
                drawY = coverY + (imgHeight - drawH) / 2;
              }
              pdf.saveGraphicsState();
              pdf.rect(imgX, coverY, imgWidth, imgHeight, null);
              pdf.clip(); pdf.discardPath();
              pdf.addImage(imageData, 'JPEG', drawX, drawY, drawW, drawH, undefined, 'NONE');
              pdf.restoreGraphicsState();
              coverY += imgHeight + 0.3;
            }
          } catch (e) {
            logger.error('addImage failed:', e.message);
            drawImagePlaceholder(pdf, imgX, imgY, imgWidth, imgH);
            if (!isBleed) coverY += imgHeight + 0.3;
          }
        } else {
          drawImagePlaceholder(pdf, imgX, imgY, imgWidth, imgH);
          if (!isBleed) coverY += imgHeight + 0.3;
        }
      }

      // ── QUOTE ─────────────────────────────────────────────────────────────
      
      else if (blockType === 'quote') {
        const quoteText = block?.quoteText ?? '';
        const attrText  = block?.attributionText ?? '';
        if (quoteText) {
          pdf.setFontSize(coverSizes.bodyPt);
          pdf.setFont('helvetica', 'italic');
          const quote = `"${quoteText}"`;
          const quoteLines = pdf.splitTextToSize(quote, halfWidth - 0.8);
          pdf.text(quoteLines, coverX + (halfWidth - 0.3) / 2, coverY + coverSizes.bodyLineH,
            { align: 'center', maxWidth: halfWidth - 0.8 });
          coverY += quoteLines.length * coverSizes.bodyLineH + 0.2;
        }
        if (attrText) {
          pdf.setFontSize(coverSizes.subPt);
          pdf.setFont('helvetica', 'normal');
          const attrWidth = pdf.getTextWidth(attrText);
          pdf.text(attrText,
            coverX + (halfWidth - 0.3) / 2 - attrWidth / 2,
            coverY + coverSizes.subLineH);
          coverY += coverSizes.subLineH + 0.2;
        }
        if (!quoteText && !attrText) {
          coverY += coverSizes.bodyLineH + 0.2;
        }
      }


      // ── WELCOME ───────────────────────────────────────────────────────────
      else if (blockType === 'welcome') {
        const welcomeText = block?.welcomeText || 'Welcome to Sacrament Meeting';
        pdf.setFontSize(coverSizes.headingPt + 2);
        pdf.setFont('helvetica', 'bold');
        pdf.setDrawColor(41, 128, 185);
        pdf.setLineWidth(0.02);
        pdf.line(coverX + 0.2, coverY + 0.05, coverX + halfWidth - 0.5, coverY + 0.05);
        coverY += 0.1;
        const welcomeWidth = pdf.getTextWidth(welcomeText);
        pdf.setTextColor(41, 128, 185);
        pdf.text(welcomeText,
          coverX + (halfWidth - 0.3) / 2 - welcomeWidth / 2,
          coverY + coverSizes.headingLineH);
        pdf.line(coverX + 0.2, coverY + coverSizes.headingLineH + 0.1,
                coverX + halfWidth - 0.5, coverY + coverSizes.headingLineH + 0.1);
        pdf.setTextColor(0, 0, 0);
        pdf.setDrawColor(0, 0, 0);
        coverY += coverSizes.headingLineH + 0.35;
      }

      // ── CUSTOM TEXT ───────────────────────────────────────────────────────
      else if (blockType === 'custom') {
        const customText = block?.customText ?? '';
        if (customText.trim()) {
          pdf.setFontSize(coverSizes.bodyPt);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(50, 50, 50);
          const customLines = pdf.splitTextToSize(customText, halfWidth - 0.8);
          pdf.text(customLines, coverX + (halfWidth - 0.3) / 2,
            coverY + coverSizes.bodyLineH,
            { align: 'center', maxWidth: halfWidth - 0.8 });
          coverY += customLines.length * coverSizes.bodyLineH + 0.2;
          pdf.setTextColor(0, 0, 0);
        } else {
          coverY += coverSizes.bodyLineH + 0.2;
        }
      }
    }

    // =========================================================================
    // PAGE 2 — Right: Meeting Order
    // =========================================================================
    pdf.addPage();
    
    const p2LeftX  = margin;          // left panel start  (0.3")
    const p2RightX = centerX + 0.3;   // right panel start (5.8")
    let yPosMeet = margin;

    if (program.meetingOrder) {
      // Program title
      
      const programTitle = program.programName?.trim() || 'Sacrament Meeting Program';
      pdf.setFontSize(meetSizes.titlePt);
      pdf.setFont('helvetica', 'bold');
      const titleLines = pdf.splitTextToSize(programTitle, halfWidth - 0.4);
      pdf.text(titleLines, p2RightX + 0.1, yPosMeet + meetSizes.titleLineH);
      yPosMeet += titleLines.length * meetSizes.titleLineH + 0.25;


      // 4 header fields
      pdf.setFontSize(meetSizes.bodyPt);
      pdf.setFont('helvetica', 'normal');
      const headerFields = [
        ['Conducting',  program.meetingOrder.conducting  ?? ''],
        ['Presiding',   program.meetingOrder.presiding   ?? ''],
        ['Chorister',   program.meetingOrder.chorister   ?? ''],
        ['Accompanist', program.meetingOrder.accompanist ?? ''],
      ];
      for (const [label, val] of headerFields) {
        pdf.text(`${label}: ${val}`, p2RightX + 0.1, yPosMeet);
        yPosMeet += meetSizes.bodyLineH + 0.05;
      }
      yPosMeet += 0.1;

      // Meeting items
      if (program.meetingOrder.meetingItems?.length > 0) {
        program.meetingOrder.meetingItems.forEach(item => {
          if (yPosMeet > pageHeight - 1) return;

          switch (item.type) {
            case 'openingHymn':
            case 'sacramentHymn':
            case 'closingHymn': {
              const labels = { openingHymn: 'Opening Hymn', sacramentHymn: 'Sacrament Hymn', closingHymn: 'Closing Hymn' };
              pdf.setFontSize(meetSizes.headingPt); pdf.setFont('helvetica', 'bold');
              pdf.text(labels[item.type], p2RightX + 0.1, yPosMeet);
              yPosMeet += meetSizes.headingLineH;
              pdf.setFont('helvetica', 'normal'); pdf.setFontSize(meetSizes.bodyPt);
              pdf.text(`Hymn #${item.number ?? '?'}: ${item.title ?? ''}`, p2RightX + 0.2, yPosMeet);
              yPosMeet += meetSizes.bodyLineH + 0.08;
              break;
            }
            case 'openingPrayer':
            case 'closingPrayer': {
              const labels = { openingPrayer: 'Opening Prayer', closingPrayer: 'Closing Prayer' };
              pdf.setFontSize(meetSizes.headingPt); pdf.setFont('helvetica', 'bold');
              pdf.text(labels[item.type], p2RightX + 0.1, yPosMeet);
              yPosMeet += meetSizes.headingLineH;
              pdf.setFont('helvetica', 'normal'); pdf.setFontSize(meetSizes.bodyPt);
              pdf.text(item.name ?? '', p2RightX + 0.2, yPosMeet);
              yPosMeet += meetSizes.bodyLineH + 0.08;
              break;
            }
            case 'sacramentAdmin':
              pdf.setFontSize(meetSizes.headingPt); pdf.setFont('helvetica', 'bold');
              pdf.text('Blessing and Passing of the Sacrament', p2RightX + 0.1, yPosMeet);
              yPosMeet += meetSizes.headingLineH + 0.08;
              break;


            // ── AFTER: speaker ───────────────────────────────────────────────────
            case 'speaker':
              // Heading
              pdf.setFontSize(meetSizes.headingPt); pdf.setFont('helvetica', 'bold');
              pdf.text('Speaker', p2RightX + 0.1, yPosMeet);
              yPosMeet += meetSizes.headingLineH;
              // Name
              pdf.setFontSize(meetSizes.bodyPt + 1); pdf.setFont('helvetica', 'normal');
              pdf.text(item.name ?? '', p2RightX + 0.2, yPosMeet);
              yPosMeet += meetSizes.bodyLineH + 0.05;
              // Topic
              if (item.topic) {
                pdf.setFont('helvetica', 'italic'); pdf.setFontSize(meetSizes.subPt);
                const topicLines = pdf.splitTextToSize(item.topic, halfWidth - 0.6);
                pdf.text(topicLines, p2RightX + 0.4, yPosMeet);
                yPosMeet += topicLines.length * meetSizes.subLineH + 0.1;
              }
              yPosMeet += 0.05;
              break;



            case 'hymn':
              // Heading
              pdf.setFontSize(meetSizes.headingPt); pdf.setFont('helvetica', 'bold');
              pdf.text('Hymn', p2RightX + 0.1, yPosMeet);
              yPosMeet += meetSizes.headingLineH;
              // Detail
              pdf.setFont('helvetica', 'normal'); pdf.setFontSize(meetSizes.bodyPt);
              pdf.text(`Hymn #${item.number ?? '?'}: ${item.title ?? ''}`, p2RightX + 0.2, yPosMeet);
              yPosMeet += meetSizes.bodyLineH + 0.1;
              break;

            
            // ── ADD THIS CASE ──────────────────────────────────────────────────────────
            case 'childrensHymn':
              // Heading
              pdf.setFontSize(meetSizes.headingPt); pdf.setFont('helvetica', 'bold');
              pdf.text("Children's Song", p2RightX + 0.1, yPosMeet);
              yPosMeet += meetSizes.headingLineH;
              // Detail
              pdf.setFont('helvetica', 'normal'); pdf.setFontSize(meetSizes.bodyPt);
              pdf.text(`#${item.number ?? '?'}: ${item.title ?? ''}`, p2RightX + 0.2, yPosMeet);
              yPosMeet += meetSizes.bodyLineH + 0.1;
              break;
            // ──────────────────────────────────────────────────────────────────────────



            case 'musical':
              // Heading
              pdf.setFontSize(meetSizes.headingPt); pdf.setFont('helvetica', 'bold');
              pdf.text('Musical Number', p2RightX + 0.1, yPosMeet);
              yPosMeet += meetSizes.headingLineH;
              // Detail
              pdf.setFont('helvetica', 'normal'); pdf.setFontSize(meetSizes.bodyPt);
              pdf.text(`${item.performers ?? ''}: ${item.piece ?? ''}`, p2RightX + 0.2, yPosMeet);
              yPosMeet += meetSizes.bodyLineH + 0.1;
              break;


            case 'customText': {
              const customText = item.text?.trim() ?? '';
              if (customText) {
                pdf.setFontSize(meetSizes.headingPt); pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(0, 0, 0);
                const customLines = pdf.splitTextToSize(customText, halfWidth - 0.6);
                pdf.text(customLines, p2RightX + 0.1, yPosMeet);
                yPosMeet += customLines.length * meetSizes.headingLineH + 0.08;
              } else {
                yPosMeet += 2 * meetSizes.bodyLineH;
              }
              break;
            }
            case 'announce':
              pdf.setFont('helvetica', 'bold'); pdf.setFontSize(meetSizes.bodyPt + 1);
              pdf.text('Announcements and Ward Business', p2RightX + 0.2, yPosMeet);
              yPosMeet += meetSizes.bodyLineH + 0.2;
              break;

            case 'baptism':
              pdf.setFont('helvetica', 'bold'); pdf.setFontSize(meetSizes.bodyPt + 1);
              pdf.text(`Baptism of ${item.personName ?? ''}`, p2RightX + 0.2, yPosMeet);
              yPosMeet += meetSizes.bodyLineH + 0.05;
              pdf.setFont('helvetica', 'italic'); pdf.setFontSize(meetSizes.subPt);
              pdf.text(`Performed by ${item.performedBy ?? ''}`, p2RightX + 0.4, yPosMeet);
              yPosMeet += meetSizes.subLineH + 0.05;
              pdf.text(`Witnessed by ${item.witness1 ?? ''} and ${item.witness2 ?? ''}`, p2RightX + 0.4, yPosMeet);
              yPosMeet += meetSizes.subLineH + 0.1;
              break;

            case 'confirmation':
              pdf.setFont('helvetica', 'bold'); pdf.setFontSize(meetSizes.bodyPt + 1);
              pdf.text(`Confirmation of ${item.personName ?? ''}`, p2RightX + 0.2, yPosMeet);
              yPosMeet += meetSizes.bodyLineH + 0.05;
              pdf.setFont('helvetica', 'italic'); pdf.setFontSize(meetSizes.subPt);
              pdf.text(`Performed by ${item.performedBy ?? ''}`, p2RightX + 0.4, yPosMeet);
              yPosMeet += meetSizes.subLineH + 0.1;
              break;
          }
        });
      }
    }

    // Center line — Page 2
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.02);
    pdf.line(centerX, margin, centerX, pageHeight - margin);

    // =========================================================================
    // PAGE 2 — Left: Announcements
    // =========================================================================
    yPos = margin;
    pdf.setFontSize(annSizes.titlePt);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Announcements', p2LeftX + 0.1, yPos + annSizes.titleLineH);
    yPos += annSizes.titleLineH + 0.15;  // ← was 0.3, tightened to match panelHealth

    if (program.announcements?.length > 0) {
      program.announcements.forEach(ann => {
        if (yPos > pageHeight - 0.8) return;

        // ── Title ─────────────────────────────────────────────────────────────
        pdf.setFontSize(annSizes.headingPt);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`• ${ann.title ?? ''}`, p2LeftX + 0.1, yPos);
        yPos += annSizes.headingLineH;

        // ── Description ───────────────────────────────────────────────────────
        if (ann.description?.trim()) {
          pdf.setFontSize(annSizes.bodyPt);
          pdf.setFont('helvetica', 'normal');
          const descLines = pdf.splitTextToSize(ann.description, halfWidth - 0.5);
          pdf.text(descLines, p2LeftX + 0.1, yPos);
          yPos += descLines.length * annSizes.bodyLineH;
        }

        // ── Date / Time ───────────────────────────────────────────────────────
        if (ann.date || ann.time) {
          if (!ann.description?.trim()) yPos += annSizes.subLineH * 0.5;
          pdf.setFontSize(annSizes.subPt);
          pdf.setFont('helvetica', 'italic');

          let dateTimeText = '';

          if (ann.isAllDay) {
            // All-day: show date or date range
            if (ann.date) {
              dateTimeText = new Date(ann.date + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric',
              });
            }
            if (ann.endDate && ann.endDate !== ann.date) {
              dateTimeText += ` \u2013 ${new Date(ann.endDate + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric',
              })}`;
            }
            dateTimeText += ' \u00B7 All Day';
          } else {
            // Timed event
            if (ann.date) {
              dateTimeText = new Date(ann.date + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric',
              });
            }
            if (ann.endDate && ann.endDate !== ann.date) {
              dateTimeText += ` \u2013 ${new Date(ann.endDate + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric',
              })}`;
            }
            if (ann.time) {
              if (dateTimeText) dateTimeText += ' \u00B7 ';
              dateTimeText += new Date(`2000-01-01T${ann.time}`).toLocaleTimeString('en-US', {
                hour: 'numeric', minute: '2-digit', hour12: true,
              });
            }
            if (ann.endTime) {
              dateTimeText += ` \u2013 ${new Date(`2000-01-01T${ann.endTime}`).toLocaleTimeString('en-US', {
                hour: 'numeric', minute: '2-digit', hour12: true,
              })}`;
            }
          }

          if (dateTimeText) {
            pdf.text(dateTimeText, p2LeftX + 0.1, yPos);
            yPos += annSizes.subLineH;
          }
        }

        // ── Location ──────────────────────────────────────────────────────────
        if (ann.location?.trim()) {
          pdf.setFontSize(annSizes.subPt);
          pdf.setFont('helvetica', 'italic');
          const locLines = pdf.splitTextToSize(ann.location, halfWidth - 0.5);
          pdf.text(locLines, p2LeftX + 0.1, yPos);
          yPos += locLines.length * annSizes.subLineH;
        }

        yPos += 0.2; // between-announcement padding
      });
    }

    return pdf;

  } catch (error) {
    logger.error('=== PDF Error ===', error);
    throw error;
  }
};