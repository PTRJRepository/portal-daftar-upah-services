
from db_connection import get_extend_db_connection

def setup_divisi_description():
    # Schema creation
    create_sql = """
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Divisi_Description]') AND type in (N'U'))
    BEGIN
        CREATE TABLE [dbo].[Divisi_Description](
            [Divisi] [varchar](50) NOT NULL,
            [Description] [varchar](255) NULL,
            [Luas_Hektar] [decimal](18, 2) NULL DEFAULT 0,
            PRIMARY KEY CLUSTERED ([Divisi] ASC)
        )
        PRINT 'Divisi_Description table created successfully'
    END
    ELSE
    BEGIN
        PRINT 'Divisi_Description table already exists'
        -- Ensure columns exist if table exists
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Divisi_Description' AND COLUMN_NAME = 'Luas_Hektar')
        BEGIN
            ALTER TABLE [dbo].[Divisi_Description] ADD [Luas_Hektar] [decimal](18, 2) NULL DEFAULT 0
            PRINT 'Added Luas_Hektar column'
        END
    END
    """
    
    # Data to seed
    divisions = {
        "AB1": "KEBUN AMBALATU 1",
        "AB2": "KEBUN AMBALATU 2",
        "ARA": "KEBUN ARA",
        "ARC": "KEBUN ARC",
        "DME": "KEBUN DME",
        "IJL": "KEBUN IJL",
        "INF": "INFRASTRUKTUR",
        "MILL": "MILL PKS",
        "NRS": "NURSERY",
        "P1A": "KEBUN PLASMA 1A",
        "P1B": "KEBUN PLASMA 1B",
        "P2A": "KEBUN PLASMA 2A",
        "P2B": "KEBUN PLASMA 2B",
        "PGE": "GENERAL",
        "WKS": "WORKSHOP",
        "WKS_AR": "WORKSHOP AIR RUAK",
        "WKS_PG": "WORKSHOP PARIT GUNUNG"
    }
    
    try:
        conn = get_extend_db_connection()
        cursor = conn.cursor()
        
        # 1. Create Table
        print("Creating/Checking table...")
        cursor.execute(create_sql)
        conn.commit()
        
        # 2. Insert/Update Data
        print("Seeding data...")
        for code, desc in divisions.items():
            # Check if exists
            cursor.execute("SELECT Divisi FROM [dbo].[Divisi_Description] WHERE Divisi = ?", (code,))
            if cursor.fetchone():
                # Update description (optional, but good for correction)
                cursor.execute("UPDATE [dbo].[Divisi_Description] SET Description = ? WHERE Divisi = ?", (desc, code))
                print(f"Updated: {code}")
            else:
                # Insert
                cursor.execute("INSERT INTO [dbo].[Divisi_Description] (Divisi, Description, Luas_Hektar) VALUES (?, ?, 0)", (code, desc))
                print(f"Inserted: {code}")
        
        conn.commit()
        print("Done.")
        conn.close()
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    setup_divisi_description()
