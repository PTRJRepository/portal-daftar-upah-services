/**
 * Loading Screen Configuration
 * Contains tips, facts, motivational quotes, and notifications
 * Used by LoadingScreen component
 */

export const LOADING_SCREEN_CONFIG = {
  // Application info
  app: {
    name: 'PT REBINMAS JAYA',
    subtitle: 'Payroll Intelligence System',
    tagline: 'Precision in Every Calculation'
  },

  // Tips - Fakta tentang kelapa sawit dan perusahaan
  tips: [
    "Kelapa sawit adalah tanaman penghasil minyak nabati paling efisien di dunia.",
    "Satu hektar kelapa sawit dapat menghasilkan hingga 4 ton minyak per tahun.",
    "Minyak sawit mengandung Vitamin E (Tokotrienol) yang tinggi, baik untuk kesehatan jantung.",
    "Indonesia adalah produsen minyak kelapa sawit terbesar di dunia.",
    "Penggunaan sistem digital membantu akurasi perhitungan upah dan transparansi data.",
    "Produktivitas yang tinggi dimulai dari kesejahteraan karyawan yang terjaga.",
    "Kelapa sawit menyerap lebih banyak CO2 per hektar dibandingkan hutan tanaman industri lainnya.",
    "Sistem ini dirancang untuk memproses ribuan data karyawan dalam hitungan detik.",
    "Akurasi NIK sangat penting untuk integrasi data BPJS dan pajak yang valid.",
    "Memastikan data absensi lengkap akan mempercepat proses verifikasi payroll.",
    "PT Rebinmas Jaya memiliki komitmen tinggi terhadap kesejahteraan pekerjanya.",
    "Digitalisasi payroll mengurangi risiko kesalahan manusia secara signifikan.",
    "Karyawan yang bahagia adalah aset berharga bagi perusahaan.",
    "Perhitungan THR yang akurat mencerminkan keadilan perusahaan kepada karyawannya.",
    "Sistem payroll modern terintegrasi dengan sistem absensi secara real-time."
  ],

  // Motivational quotes
  quotes: [
    "Kerja keras hari ini, sucesso amanhã.",
    "Satu langkah kecil menuju konsistensi adalah awal dari pencapaian besar.",
    "Ketekunan dalam bekerja adalah kunci menuju kemakmuran.",
    "Setiap tetes keringat adalah investasi untuk masa depan.",
    "Kesuksesan adalah hasil dari persiapan, kerja keras, dan belajar dari kegagalan.",
    "Bersyukur atas pekerjaan yang kita miliki adalah awal dari kebahagiaan.",
    "Kecil dalam detail, besar dalam dampak.",
    "Disiplin adalah jembatan antara tujuan dan pencapaian.",
    "清晨一印尼语：Setiap pagi adalah kesempatan baru untuk menjadi lebih baik.",
    "没有付出就没有收获 - Tidak ada hasil tanpa usaha.",
    "团队精神是成功的关键 - Semangat tim adalah kunci keberhasilan.",
    "一起我们可以做得更好 - Bersama kita bisa lebih baik."
  ],

  // Fun facts
  funFacts: [
    "🌴 Tahukah Anda? Kelapa sawit bisa hidup produktif selama 25-30 tahun.",
    "🌱 Minyak kelapa sawit digunakan di sekitar 50% produk di supermarket!",
    "📊 Petani kelapa sawit Indonesia menghasilkan lebih dari 40 juta ton CPO per tahun.",
    "🏆 Indonesia dan Malaysia menguasai lebih dari 85% produksi kelapa sawit dunia.",
    "🌿 Kelapa sawit membutuhkan sinar matahari yang cukup, minimal 6 jam per hari.",
    "🌰 Satu pohon kelapa sawit bisa menghasilkan 12-15 tandan buah per tahun.",
    "⚡ Proses ekstraksi minyak kelapa sawit sudah menggunakan teknologi modern.",
    "🌍 Minyak kelapa sawit adalah yang paling efisien dibanding minyak nabati lainnya."
  ],

  // Wisdom quotes
  wisdom: [
    "\"Pendidikan adalah senjata paling powerful yang bisa kamu gunakan untuk mengubah dunia.\" - Nelson Mandela",
    "\"Sukses adalah kemampuan untuk bangkit dari kegagalan tanpa kehilangan antusiasme.\" - Winston Churchill",
    "\"Kerja cerdas, kerja keras, tetap rendah hati.\"",
    "\"Jangan takut melambat, yang penting tetap bergerak maju.\"",
    "\"Kesuksesan adalah perjalanan, bukan destinasi.\""
  ],

  // Notification messages (can be extended for system alerts)
  notifications: {
    enabled: true,
    rotateInterval: 5000, // ms
    types: {
      info: { icon: '💡', label: 'Tips' },
      quote: { icon: '✨', label: 'Motivasi' },
      fact: { icon: '🌴', label: 'Fakta' },
      wisdom: { icon: '💭', label: 'Kebijaksanaan' }
    }
  },

  // Animation settings
  animations: {
    tipRotateInterval: 5000, // Rotate tips every 5 seconds
    treeSwayDuration: 4, // seconds for tree sway animation
    progressBarDuration: 8, // seconds for full progress
    backgroundGradientDuration: 20 // seconds for gradient animation
  }
};

// Helper function to get random item from array
export function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Helper function to get mixed content
export function getAllMessages() {
  return [
    ...LOADING_SCREEN_CONFIG.tips.map(t => ({ type: 'info', text: t })),
    ...LOADING_SCREEN_CONFIG.quotes.map(q => ({ type: 'quote', text: q })),
    ...LOADING_SCREEN_CONFIG.funFacts.map(f => ({ type: 'fact', text: f })),
    ...LOADING_SCREEN_CONFIG.wisdom.map(w => ({ type: 'wisdom', text: w }))
  ];
}

// Get random mixed message
export function getRandomMessage() {
  const messages = getAllMessages();
  return getRandomItem(messages);
}

export default LOADING_SCREEN_CONFIG;