from pydantic import BaseModel
from typing import Optional

class PayrollRow(BaseModel):
    no: int
    jenis_kelamin: str
    nik: str
    nama: str
    phone: Optional[str] = "-"
    upah_dasar: float
    hari_kerja: int
    upah_pokok: float
    cuti_tahunan_hari: int
    cuti_sakit_haid_hari: int
    cuti_minggu_hari: int
    cuti_nasional_hari: int
    cuti_izin_hari: int
    jumlah_hk: int
    gaji_pokok: float
    beras_rate: float
    beras_jumlah: float
    jabatan_rate: float
    jabatan_jumlah: float
    masa_kerja_tahun: int
    masa_kerja_jumlah: float
    lembur_jam: int
    lembur_jumlah: float
    total_tunjangan: float
    premi_brondol: float
    premi_pruning: float
    premi_angkut_material: float
    premi_angkut_tbs: float
    premi_harvesting: float
    premi_harvesting_incentive: float
    premi_pupuk: float
    premi_dynamic_1: float = 0.0
    premi_dynamic_2: float = 0.0
    premi_dynamic_3: float = 0.0
    premi_dynamic_4: float = 0.0
    premi_dynamic_5: float = 0.0
    premi_dynamic_6: float = 0.0
    premi_dynamic_7: float = 0.0
    total_premi: float
    jumlah_upah_kotor: float
    pot_pph21: float
    pot_kontan: float
    pot_thr: float
    pot_pinjam: float
    pot_kl: float
    pot_bpjs_kes: float
    pot_bpjs_pek: float
    pot_bpjs_maj: float
    pot_total_1: float
    pot_total_2: float
    pot_total_3: float
    pot_total_4: float
    total_potongan: float
    # Additional BPJS fields from reference code
    pot_bpjs_kesehatan_pekerja: float = 0.0
    pot_bpjs_kesehatan_majikan: float = 0.0
    pot_bpjs_pensiun_pekerja: float = 0.0
    pot_bpjs_pensiun_majikan: float = 0.0
    pot_bpjs_jumlah: float = 0.0
    pot_bpjs_pekerja_total: float = 0.0
    pot_spsi: float
    # Koreksi field from reference code
    premi_koreksi: float = 0.0
    pot_koreksi: float = 0.0
    upah_bersih: float
    tidak_hadir_cth: int = 0
    tidak_hadir_alpa: int = 0
