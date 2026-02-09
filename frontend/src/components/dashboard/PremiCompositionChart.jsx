
import React, { useState, useEffect } from 'react';
import {
    ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend
} from 'recharts';
import { Card, CardHeader, CardContent, Typography, Box, CircularProgress } from '@mui/material';

// Using Rebinmas official colors
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];

const PremiCompositionChart = ({ month, year, division }) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const queryParams = new URLSearchParams({
                    month,
                    year,
                    ...(division && division !== 'ALL' && { division_code: division })
                });

                const response = await fetch(`/api/payroll/dashboard/premi-analysis?${queryParams}`);
                const result = await response.json();

                if (result.success) {
                    setData(result.data);
                } else {
                    setError(result.error);
                }
            } catch (err) {
                console.error("Failed to fetch premi analysis:", err);
                setError("Failed to load data");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [month, year, division]);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error || data.length === 0) {
        return (
            <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                <Typography variant="body2">No detailed premi data available</Typography>
            </Box>
        );
    }

    return (
        <Card sx={{ height: '100%', boxShadow: 3 }}>
            <CardHeader title="Komposisi Premi" subheader={`Breakdown Total Premi`} />
            <CardContent>
                <Box sx={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer>
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                                nameKey="name"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value) => new Intl.NumberFormat('id-ID').format(value)} />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </Box>
            </CardContent>
        </Card>
    );
};

export default PremiCompositionChart;
