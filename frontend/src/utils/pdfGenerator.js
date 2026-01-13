import html2pdf from 'html2pdf.js';

/**
 * Generates a PDF from a DOM element.
 * 
 * @param {HTMLElement} element - The DOM element to convert to PDF.
 * @param {string} filename - The name of the downloaded file.
 * @param {object} options - Optional configuration overrides.
 */
export const generatePDF = (element, filename = 'report.pdf', options = {}) => {
    if (!element) {
        console.error('generatePDF: Element not found');
        return;
    }

    const defaultOptions = {
        margin: [5, 5, 5, 5], // Top, Left, Bottom, Right (mm)
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2, // Higher scale for better resolution
            useCORS: true, 
            logging: false,
            letterRendering: true
        },
        jsPDF: { 
            unit: 'mm', 
            format: 'a4', 
            orientation: 'landscape', // Most reports are wide
            compress: true
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    const config = { ...defaultOptions, ...options };

    // Clone the element to apply PDF-specific styles without affecting the UI
    const clone = element.cloneNode(true);
    clone.classList.add('pdf-mode');

    // Create a container to hold the clone off-screen
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.top = '-9999px';
    container.style.left = '-9999px';
    // Ensure container has enough width to simulate landscape paper if needed, or let it flow
    container.style.width = '297mm'; // A4 Landscape width approx
    container.appendChild(clone);
    document.body.appendChild(container);

    // Show loading state or promise
    return html2pdf()
        .set(config)
        .from(clone)
        .save()
        .then(() => {
            document.body.removeChild(container);
        })
        .catch(err => {
            console.error('Error generating PDF:', err);
            alert('Gagal membuat PDF. Silakan coba lagi.');
            if (document.body.contains(container)) {
                document.body.removeChild(container);
            }
        });
};
