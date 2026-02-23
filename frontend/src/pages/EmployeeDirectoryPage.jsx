import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { buildAppPath } from '../utils/prodModeUtils';
import LoadingScreen from '../components/common/LoadingScreen';
import AgGridWrapper from '../components/common/AgGridWrapper';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8002';

async function searchEmployees(token, query, limit = 100) {
    if (!query || query.trim().length === 0) return [];

    try {
        const response = await fetch(`${API_BASE_URL}/payroll/employee/search?q=${encodeURIComponent(query)}&limit=${limit}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to search');
        const json = await response.json();
        return json.data || [];
    } catch (err) {
        console.error('Error searching employees:', err);
        return [];
    }
}

export default function EmployeeDirectoryPage() {
    const navigate = useNavigate();
    const { token } = useAuth();

    const [searchTerm, setSearchTerm] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [results, setResults] = useState([]);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = useCallback(async (e) => {
        if (e) e.preventDefault();

        if (!searchTerm || searchTerm.trim().length < 2) {
            alert('Masukkan minimal 2 karakter (Nama atau NIK)');
            return;
        }

        setIsSearching(true);
        setHasSearched(true);

        try {
            const data = await searchEmployees(token, searchTerm);
            setResults(data);
        } catch (error) {
            setResults([]);
        } finally {
            setIsSearching(false);
        }
    }, [searchTerm, token]);

    // Auto-search on Enter key
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSearch(e);
        }
    };

    const handleViewProfile = (nik) => {
        if (!nik) return;

        const params = new URLSearchParams({
            nik: nik
        });

        const detailPath = buildAppPath(`/hr-info?${params.toString()}`);
        window.open(detailPath, '_blank', 'noopener,noreferrer');
    };

    // Column Definitions for AG Grid
    const columnDefs = useMemo(() => [
        {
            field: 'actual_nik',
            headerName: 'NIK (KTP)',
            width: 160,
            pinned: 'left'
        },
        { field: 'nik', headerName: 'Emp Code', width: 120 },
        { field: 'nama', headerName: 'Nama Karyawan', flex: 1, minWidth: 200 },
        { field: 'jenis_kelamin', headerName: 'L/P', width: 80 },
        { field: 'loc_code', headerName: 'Lokasi', width: 100 },
        { field: 'gang_code', headerName: 'Gang', width: 100 },
        {
            headerName: 'Aksi',
            width: 150,
            pinned: 'right',
            cellRenderer: (params) => {
                if (!params.data) return null;
                const nikTarget = params.data.actual_nik || params.data.nik;
                return (
                    <button
                        onClick={() => handleViewProfile(nikTarget)}
                        style={{
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            padding: '4px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600'
                        }}
                    >
                        Lihat Profil HR
                    </button>
                );
            }
        }
    ], []);

    return (
        <div style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>

            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem' }}>
                    Employee Directory (HR)
                </h1>
                <p style={{ color: '#64748b' }}>
                    Cari riwayat dan profil karyawan berdasarkan NIK KTP atau Nama.
                </p>
            </div>

            <div style={{
                backgroundColor: 'white',
                padding: '1.5rem',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                marginBottom: '1.5rem',
                display: 'flex',
                gap: '1rem',
                alignItems: 'center'
            }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }}>
                        🔍
                    </span>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Masukkan NIK KTP, Emp Code, atau Nama Karyawan..."
                        style={{
                            width: '100%',
                            padding: '10px 10px 10px 36px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '1rem'
                        }}
                    />
                </div>
                <button
                    onClick={handleSearch}
                    disabled={isSearching}
                    style={{
                        padding: '10px 24px',
                        backgroundColor: '#0f172a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: isSearching ? 'not-allowed' : 'pointer',
                        fontWeight: '600',
                        fontSize: '1rem',
                        minWidth: '120px'
                    }}
                >
                    {isSearching ? 'Mencari...' : 'Cari Data'}
                </button>
            </div>

            <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {hasSearched ? (
                    <>
                        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: '600', color: '#334155' }}>Hasil Pencarian</span>
                            <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{results.length} karyawan ditemukan</span>
                        </div>
                        {results.length > 0 ? (
                            <div className="ag-theme-alpine" style={{ flex: 1, width: '100%' }}>
                                <AgGridWrapper
                                    rowData={results}
                                    columnDefs={columnDefs}
                                    height="100%"
                                />
                            </div>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
                                <h3>Data tidak ditemukan</h3>
                                <p>Coba gunakan kata kunci pencarian yang lain.</p>
                            </div>
                        )}
                    </>
                ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</div>
                        <h3>Mulai Pencarian</h3>
                        <p>Ketikkan nama atau NIK di kolom pencarian di atas.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
