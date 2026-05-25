import { PDFDocument } from 'pdf-lib';

export interface MergeFileItem {
  name: string;
  type: 'image' | 'pdf';
  data: ArrayBuffer;
}

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

async function convertWebpToPng(webpBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  const blob = new Blob([webpBuffer], { type: 'image/webp' });
  const img = new Image();
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('Canvas context failed')); return; }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((pngBlob) => {
        URL.revokeObjectURL(url);
        if (!pngBlob) { reject(new Error('WebP to PNG conversion failed')); return; }
        pngBlob.arrayBuffer().then(resolve).catch(reject);
      }, 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('WebP load failed')); };
    img.src = url;
  });
}

export async function mergeFilesToPdf(files: MergeFileItem[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  for (const file of files) {
    if (file.type === 'pdf') {
      const donor = await PDFDocument.load(file.data);
      const pages = await pdfDoc.copyPages(donor, donor.getPageIndices());
      for (const page of pages) {
        pdfDoc.addPage(page);
      }
    } else {
      let imageBytes = file.data;
      const isWebp = file.name.toLowerCase().endsWith('.webp');

      let embeddedImage;
      if (isWebp) {
        imageBytes = await convertWebpToPng(imageBytes);
        embeddedImage = await pdfDoc.embedPng(imageBytes);
      } else if (file.name.toLowerCase().match(/\.(jpg|jpeg)$/)) {
        embeddedImage = await pdfDoc.embedJpg(imageBytes);
      } else {
        embeddedImage = await pdfDoc.embedPng(imageBytes);
      }

      const imgWidth = embeddedImage.width;
      const imgHeight = embeddedImage.height;
      const scale = Math.min((A4_WIDTH * 0.9) / imgWidth, (A4_HEIGHT * 0.9) / imgHeight);
      const scaledW = imgWidth * scale;
      const scaledH = imgHeight * scale;
      const x = (A4_WIDTH - scaledW) / 2;
      const y = (A4_HEIGHT - scaledH) / 2;

      const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
      page.drawImage(embeddedImage, { x, y, width: scaledW, height: scaledH });
    }
  }

  return pdfDoc.save();
}
