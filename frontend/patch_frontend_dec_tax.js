const fs = require('fs');
const path = require('path');

const jsxPath = path.join(__dirname, 'src/pages/TaxReportPage.jsx');
let content = fs.readFileSync(jsxPath, 'utf8');

// Ensure import includes fetchDecemberTaxReport
if (!content.includes('fetchDecemberTaxReport')) {
    content = content.replace(
        'fetchAnnualAstekBpjsReport, downloadMonthlyTaxReportExcel',
        'fetchAnnualAstekBpjsReport, fetchDecemberTaxReport, downloadMonthlyTaxReportExcel'
    );
}

// Add the DecemberTaxTab component string
const componentStr = `
// ================================================================
// TAB 5: Pajak Desember (Dedicated Yearly Tax finalization)
// ================================================================
function DecemberTaxTab({ token, year, division, gang }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await fetchDecemberTaxReport(token, year, division, gang);
            setData(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [token, year, division, gang]);

    useEffect(() => { loadData(); }, [loadData]);

    if (loading) return (
        <div className="tax-report-loading">
            <span className="spinner"></span> Memuat data Pajak Desember...
        </div>
    );

    if (error) return (
        <div className="tax-report-empty">
            <h3>⚠️ Error</h3>
            <p>{error}</p>
        </div>
    );

    return (
        <div className="tax-report-panel">
            <div className="tax-report-panel-header">
                <h2>Tabulasi Pajak Desember {year}</h2>
                <div className="tax-report-panel-actions">
                    <button className="tax-report-btn" onClick={loadData}>
                        🔄 Refresh
                    </button>
                    {data && data.employees.length > 0 && (
                        <button className="tax-report-btn" style={{backgroundColor: '#10b981', color: 'white'}} onClick={() => alert('Download Excel Pajak Desember akan segera hadir!')}>
                            <Download size={14} /> Download Excel
                        </button>
                    )}
                </div>
            </div>

            {(!data || data.employees.length === 0) ? (
                <div className="tax-report-empty">
                    Tidak ada data pajak desember untuk divisi/gang ini pada tahun {year}.
                </div>
            ) : (
                <div className="tax-report-table-wrapper" style={{ overflowX: 'auto', maxHeight: '70vh' }}>
                    <table className="tax-report-table custom-december-table">
                        <thead>
                            <tr>
                                <th rowSpan="2" className="sticky-col first-col">No</th>
                                <th rowSpan="2" className="sticky-col second-col">NAMA KARYAWAN</th>
                                <th rowSpan="2">NIK / PASPOR</th>
                                <th rowSpan="2">NPWP</th>
                                <th rowSpan="2">ALAMAT</th>
                                <th rowSpan="2">JABATAN</th>
                                <th colSpan="4" className="group-header">STATUS KARYAWAN</th>
                                <th colSpan="5" className="group-header" style={{backgroundColor: '#2b5797', color: 'white'}}>DESEMBER</th>
                                <th colSpan="3" className="group-header" style={{backgroundColor: '#e3a21a', color: 'white'}}>PENGHASILAN TIDAK TERATUR</th>
                                <th colSpan="6" className="group-header" style={{backgroundColor: '#2d89ef', color: 'white'}}>DISETAHUNKAN</th>
                                <th colSpan="3" className="group-header" style={{backgroundColor: '#ee1111', color: 'white'}}>PENGURANG</th>
                                <th colSpan="6" className="group-header" style={{backgroundColor: '#00a300', color: 'white'}}>KALKULASI PAJAK</th>
                            </tr>
                            <tr className="sub-header">
                                {/* Status Karyawan */}
                                <th>L/P</th>
                                <th>PTKP</th>
                                <th>TER</th>
                                <th>MASA KERJA</th>
                                
                                {/* Desember */}
                                <th style={{color: '#2b5797', fontWeight: 600}}>Gaji Pokok</th>
                                <th style={{color: '#2b5797', fontWeight: 600}}>Total Tunjangan</th>
                                <th style={{color: '#2b5797', fontWeight: 600}}>Premi JKK/JKM/Kes</th>
                                <th style={{color: '#2b5797', fontWeight: 600}}>Tunjangan PPh</th>
                                <th style={{color: '#2b5797', fontWeight: 600}}>Ph. Bruto Des</th>
                                
                                {/* Penghasilan Tidak Teratur */}
                                <th style={{color: '#e3a21a', fontWeight: 600}}>THR</th>
                                <th style={{color: '#e3a21a', fontWeight: 600}}>BONUS</th>
                                <th style={{color: '#e3a21a', fontWeight: 600}}>TANTIEM</th>
                                
                                {/* Disetahunkan */}
                                <th style={{color: '#2d89ef', fontWeight: 600}}>Total Gaji Pokok</th>
                                <th style={{color: '#2d89ef', fontWeight: 600}}>Total Tunj. Lainnya</th>
                                <th style={{color: '#2d89ef', fontWeight: 600}}>Total Premi Asuransi</th>
                                <th style={{color: '#2d89ef', fontWeight: 600}}>Total Tunj. PPh</th>
                                <th style={{color: '#2d89ef', fontWeight: 600}}>Total Natura</th>
                                <th style={{color: '#2d89ef', fontWeight: 600}}>Total THR/Bonus</th>
                                <th style={{color: '#2d89ef', fontWeight: 600}}>Ph. Bruto Setahun</th>
                                
                                {/* Pengurang */}
                                <th style={{color: '#ee1111', fontWeight: 600}}>Biaya Jabatan</th>
                                <th style={{color: '#ee1111', fontWeight: 600}}>Total Iuran JHT/JP</th>
                                <th style={{color: '#ee1111', fontWeight: 600}}>Ph. Netto Setahun</th>

                                {/* Kalkulasi */}
                                <th style={{color: '#00a300', fontWeight: 600}}>PTKP</th>
                                <th style={{color: '#00a300', fontWeight: 600}}>PKP</th>
                                <th style={{color: '#00a300', fontWeight: 600}}>PPh 21 Setahun</th>
                                <th style={{color: '#00a300', fontWeight: 600}}>PPh 21 Non NPWP</th>
                                <th style={{color: '#00a300', fontWeight: 600}}>PPh 21 Jan S.D Nop</th>
                                <th style={{color: '#00a300', fontWeight: 600}}>PPh 21 Desember</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.employees.map((emp) => (
                                <tr key={emp.emp_code}>
                                    <td className="sticky-col first-col text-center">{emp.no}</td>
                                    <td className="sticky-col second-col">{emp.emp_name}</td>
                                    <td className="text-center">{emp.nik}</td>
                                    <td className="text-center">{emp.npwp}</td>
                                    <td style={{maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}} title={emp.alamat}>{emp.alamat}</td>
                                    <td className="text-center">{emp.jabatan}</td>
                                    
                                    <td className="text-center">{emp.gender}</td>
                                    <td className="text-center">{emp.status_ptkp}</td>
                                    <td className="text-center">{emp.kategori_ter}</td>
                                    <td className="text-center">{emp.masa_kerja_tahun} {emp.masa_kerja_bulan}</td>
                                    
                                    <td className="text-right highlight-des">{formatNumber(emp.gaji_pokok_des)}</td>
                                    <td className="text-right highlight-des">{formatNumber(emp.tunjangan_des)}</td>
                                    <td className="text-right highlight-des">{formatNumber(emp.premi_asuransi_des)}</td>
                                    <td className="text-right highlight-des">{formatNumber(emp.tunjangan_pph_des)}</td>
                                    <td className="text-right highlight-des"><strong>{formatNumber(emp.bruto_des)}</strong></td>

                                    <td className="text-right highlight-irr">{formatNumber(emp.thr)}</td>
                                    <td className="text-right highlight-irr">{formatNumber(emp.bonus)}</td>
                                    <td className="text-right highlight-irr">{formatNumber(emp.tantiem)}</td>

                                    <td className="text-right highlight-annual">{formatNumber(emp.gaji_pokok_setahun)}</td>
                                    <td className="text-right highlight-annual">{formatNumber(emp.tunjangan_lainnya_setahun)}</td>
                                    <td className="text-right highlight-annual">{formatNumber(emp.premi_asuransi_setahun)}</td>
                                    <td className="text-right highlight-annual">{formatNumber(emp.tunjangan_pph_setahun)}</td>
                                    <td className="text-right highlight-annual">{formatNumber(emp.natura_setahun)}</td>
                                    <td className="text-right highlight-annual">{formatNumber(emp.thr_bonus_tantiem_setahun)}</td>
                                    <td className="text-right highlight-annual"><strong>{formatNumber(emp.bruto_setahun)}</strong></td>

                                    <td className="text-right highlight-deduct">{formatNumber(emp.biaya_jabatan)}</td>
                                    <td className="text-right highlight-deduct">{formatNumber(emp.iuran_jht_jp_setahun)}</td>
                                    <td className="text-right highlight-deduct"><strong>{formatNumber(emp.netto_setahun)}</strong></td>

                                    <td className="text-right highlight-calc">{formatNumber(emp.ptkp)}</td>
                                    <td className="text-right highlight-calc">{formatNumber(emp.pkp)}</td>
                                    <td className="text-right highlight-calc"><strong>{formatNumber(emp.pph21_setahun)}</strong></td>
                                    <td className="text-right highlight-calc"><strong>{formatNumber(emp.pph21_setahun)}</strong></td>
                                    <td className="text-right highlight-calc">{formatNumber(emp.pph21_jan_nov)}</td>
                                    <td className="text-right" style={{backgroundColor: '#abf0ac', fontWeight: 600}}>
                                        {formatNumber(emp.pph21_desember)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="summary-row">
                                <td colSpan="10" className="text-right"><strong>TOTAL</strong></td>
                                <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + e.gaji_pokok_des, 0))}</strong></td>
                                <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + e.tunjangan_des, 0))}</strong></td>
                                <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + e.premi_asuransi_des, 0))}</strong></td>
                                <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + e.tunjangan_pph_des, 0))}</strong></td>
                                <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + e.bruto_des, 0))}</strong></td>

                                <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + e.thr, 0))}</strong></td>
                                <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + e.bonus, 0))}</strong></td>
                                <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + e.tantiem, 0))}</strong></td>

                                <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + e.gaji_pokok_setahun, 0))}</strong></td>
                                <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + e.tunjangan_lainnya_setahun, 0))}</strong></td>
                                <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + e.premi_asuransi_setahun, 0))}</strong></td>
                                <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + e.tunjangan_pph_setahun, 0))}</strong></td>
                                <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + e.natura_setahun, 0))}</strong></td>
                                <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + e.thr_bonus_tantiem_setahun, 0))}</strong></td>
                                <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + e.bruto_setahun, 0))}</strong></td>

                                <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + e.biaya_jabatan, 0))}</strong></td>
                                <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + e.iuran_jht_jp_setahun, 0))}</strong></td>
                                <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + e.netto_setahun, 0))}</strong></td>

                                <td className="text-right"><strong>-</strong></td>
                                <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + e.pkp, 0))}</strong></td>
                                <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + e.pph21_setahun, 0))}</strong></td>
                                <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + e.pph21_setahun, 0))}</strong></td>
                                <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + e.pph21_jan_nov, 0))}</strong></td>
                                <td className="text-right" style={{backgroundColor: '#abf0ac', color: '#1a4f1a', fontWeight: 700}}>
                                    <strong>{formatNumber(data.employees.reduce((s, e) => s + e.pph21_desember, 0))}</strong>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
}
`;

if (!content.includes('function DecemberTaxTab({')) {
    // Insert before standard export
    content = content.replace('export default function TaxReportPage() {', componentStr + '\n\nexport default function TaxReportPage() {');
}

// Add the tab array entry
if (!content.includes("key: 'december', label: 'Pajak Desember'")) {
    const tabEntry = ` { key: 'astek', label: 'ASTEK & BPJS', icon: <Activity size={18} /> },
        { key: 'december', label: 'Pajak Desember', icon: <FileWarning size={18} /> },`;
    content = content.replace("{ key: 'astek', label: 'ASTEK & BPJS', icon: <Activity size={18} /> },", tabEntry);
}

// Add the content block rendering
if (!content.includes("activeTab === 'december'")) {
    const renderStr = `{activeTab === 'astek' && (
                    <AstekBpjsTab
                        token={token}
                        month={month}
                        year={year}
                        setMonth={setMonth}
                        setYear={setYear}
                        division={selectedDivision}
                        gang={selectedGang}
                    />
                )}
                {activeTab === 'december' && (
                    <DecemberTaxTab
                        token={token}
                        year={year}
                        division={selectedDivision}
                        gang={selectedGang}
                    />
                )}`;

    // Find where Astek is rendered and append December
    content = content.replace(
        `{activeTab === 'astek' && (
                    <AstekBpjsTab
                        token={token}
                        month={month}
                        year={year}
                        setMonth={setMonth}
                        setYear={setYear}
                        division={selectedDivision}
                        gang={selectedGang}
                    />
                )}`,
        renderStr
    );
}

fs.writeFileSync(jsxPath, content);
console.log('Frontend patched successfully.');
