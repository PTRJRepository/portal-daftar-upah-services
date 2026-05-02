export function getDaftarUpahDownloadActionCopy(isLoading = false) {
  if (isLoading) {
    return {
      label: 'Mengunduh...',
      icon: '⏳',
      title: 'Unduh file Daftar Upah sedang diproses',
    };
  }

  return {
    label: 'Unduh File Daftar Upah',
    icon: '⬇️',
    title: 'Unduh file Daftar Upah sesuai data yang tampil sekarang',
  };
}
