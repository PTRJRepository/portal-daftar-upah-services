import { useState, useEffect, useMemo } from 'react'
import AgGridWrapper from '../components/common/AgGridWrapper'
import { fetchEmployees } from '../services/employeeService'

export default function Employees({ token }) {
  const [rows, setRows] = useState([])
  useEffect(() => {
    async function run() {
      const data = await fetchEmployees(token)
      setRows(data)
    }
    run()
  }, [token])
  const currencyFormatter = p => p.value ? `Rp ${Number(p.value).toLocaleString('id-ID')}` : ''
  const columnDefs = useMemo(() => [
    { field: 'nik', headerName: 'NIK' },
    { field: 'nama', headerName: 'Nama' },
    { field: 'jenis_kelamin', headerName: 'Jenis Kelamin' },
    { field: 'loc_code', headerName: 'Lokasi' },
    { field: 'gang_code', headerName: 'Gang' },
    { field: 'gaji_pokok', headerName: 'Gaji Pokok', valueFormatter: currencyFormatter }
  ], [])
  return <AgGridWrapper columnDefs={columnDefs} rowData={rows} />
}
