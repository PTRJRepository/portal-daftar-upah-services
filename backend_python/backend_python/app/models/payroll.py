from pydantic import BaseModel, ConfigDict
from typing import Optional, Dict

class PayrollRow(BaseModel):
    # Allow dynamic fields for premi fields based on DocDesc
    model_config = ConfigDict(extra='allow')
    
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
    jabatan_jumlah: Optional[float] = None
    masa_kerja_tahun: int
    masa_kerja_jumlah: Optional[float] = None
    masa_kerja_amount: Optional[float] = None
    lembur_jam: Optional[int] = None
    lembur_jumlah: Optional[float] = None
    total_tunjangan: float = 0.0
    premi_brondol: float
    
    # Premi Group (Nested) - descriptive fields will be added dynamically via extra='allow'
    # Examples: premi_pruning, premi_kinerja_mandor_panen, etc.
    premi: Dict[str, float] = {}
    # Structure:
    # {
    #   "premi_brondol": float,
    #   "premi_pruning": float,
    #   ... other dynamic fields ...
    #   "total_premi": float
    # }

    # Total premium for backward compatibility and easy access
    total_premi: float = 0.0

    jumlah_upah_kotor: float = 0.0
    pot_pph21: float
    pot_kontan: float
    pot_thr: float
    pot_pinjam: float
    pot_kl: float
    pot_tiket: float = 0.0
    pot_alat: float = 0.0
    pot_bpjs_kes: float
    pot_bpjs_pek: float
    pot_bpjs_maj: float
    pot_total_1: float
    pot_total_2: float
    pot_total_3: float
    pot_total_4: float
    total_potongan: float = 0.0
    # Additional BPJS fields from reference code
    pot_bpjs_kesehatan_pekerja: float = 0.0
    pot_bpjs_kesehatan_majikan: float = 0.0
    pot_bpjs_pensiun_pekerja: float = 0.0
    pot_bpjs_pensiun_majikan: float = 0.0
    pot_bpjs_jumlah: float = 0.0
    pot_bpjs_pekerja_total: float = 0.0
    # Total fields for health and pension
    pot_bpjs_kesehatan_total: float = 0.0
    pot_bpjs_pensiun_total: float = 0.0
    pot_spsi: float
    # Koreksi field from reference code
    premi_koreksi: float = 0.0
    pot_koreksi: float = 0.0
    
    # New fields for "Potongan Upah Kotor" requirement
    potongan_upah_kotor_total: float = 0.0  # Sum of dynamic potongan + koreksi
    upah_kotor_premi: float = 0.0  # Total Premi - Potongan Upah Kotor Total
    
    # New Tax Group fields
    gaji_pokok_ideal: float = 0.0
    gaji_pokok_dibayarkan: float = 0.0
    koreksi_hk: float = 0.0

    upah_bersih: float = 0.0
    tidak_hadir_cth: int = 0
    tidak_hadir_alpa: int = 0
