
from db_connection import get_extend_db_connection

def create_table():
    sql = """
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[daftar_upah_aggregation_history]') AND type in (N'U'))
    BEGIN
        CREATE TABLE [dbo].[daftar_upah_aggregation_history](
            [id] [int] IDENTITY(1,1) NOT NULL,
            [period_month] [int] NULL,
            [period_year] [int] NULL,
            [division_code] [varchar](50) NULL,
            [gang_code] [varchar](50) NULL,
            [gang_description] [varchar](255) NULL,
            [total_employees] [int] NULL,
            [total_hk] [decimal](18, 2) NULL,
            [total_hari_kerja] [decimal](18, 2) NULL,
            [total_cuti_tahunan] [decimal](18, 2) NULL,
            [total_cuti_sakit] [decimal](18, 2) NULL,
            [total_cuti_minggu] [decimal](18, 2) NULL,
            [total_cuti_nasional] [decimal](18, 2) NULL,
            [total_upah_dasar] [decimal](18, 2) NULL,
            [total_upah_pokok] [decimal](18, 2) NULL,
            [total_gaji_pokok] [decimal](18, 2) NULL,
            [total_beras] [decimal](18, 2) NULL,
            [total_jabatan] [decimal](18, 2) NULL,
            [total_masa_kerja] [decimal](18, 2) NULL,
            [total_lembur] [decimal](18, 2) NULL,
            [total_tunjangan] [decimal](18, 2) NULL,
            [total_premi_brondol] [decimal](18, 2) NULL,
            [total_premi_prunning] [decimal](18, 2) NULL,
            [total_premi] [decimal](18, 2) NULL,
            [total_potongan] [decimal](18, 2) NULL,
            [total_pph21] [decimal](18, 2) NULL,
            [total_bpjs_pekerja] [decimal](18, 2) NULL,
            [total_bpjs_majikan] [decimal](18, 2) NULL,
            [total_spsi] [decimal](18, 2) NULL,
            [total_upah_kotor] [decimal](18, 2) NULL,
            [total_upah_bersih] [decimal](18, 2) NULL,
            [created_at] [datetime] NULL,
            [updated_at] [datetime] NULL,
            [source_endpoint] [varchar](255) NULL,
            [dynamic_premi_data] [nvarchar](max) NULL,
            [total_koreksi] [decimal](18, 2) NULL,
            [informasi_tambahan] [nvarchar](max) NULL,
            [total_ffb_weight] [decimal](18, 2) NULL,
            [total_weight_tbs] [decimal](18, 2) NULL,
            PRIMARY KEY CLUSTERED 
            (
                [id] ASC
            )
        )
        PRINT 'Table created successfully'
    END
    ELSE
    BEGIN
        PRINT 'Table already exists'
    END
    """
    
    try:
        conn = get_extend_db_connection()
        cursor = conn.cursor()
        cursor.execute(sql)
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error creating table: {e}")

if __name__ == "__main__":
    create_table()
