/**
 * usePayrollStream.js
 *
 * Custom hook for consuming the SSE streaming endpoint for progressive payroll data.
 * Consumes Server-Sent Events (SSE) from `/payroll/report/division-raw-tree/stream`
 * and provides progressive state updates for the table.
 *
 * Features:
 * - Progressive gang-by-gang rendering
 * - Loading state management
 * - Error handling
 * - Progress tracking
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Main stream hook
 *
 * @param {Object} params
 * @param {string} params.token - Auth token
 * @param {string} params.division - Division code
 * @param {number} params.month - Month (1-12)
 * @param {number} params.year - Year
 * @param {string|null} params.gangPrefix - Gang prefix filter
 * @param {string|null} params.gangCode - Specific gang code (or "ALL")
 * @param {boolean|null} params.enabled - Whether to start streaming
 *
 * @returns {Object} stream state
 */
export function usePayrollStream({ token, division, month, year, gangPrefix, gangCode, enabled }) {
    const [gangs, setGangs] = useState([]);           // Array of streamed gang objects
    const [meta, setMeta] = useState(null);           // Initial metadata from 'meta' event
    const [progress, setProgress] = useState({
        stage: null,                                  // null | 'connecting' | 'querying' | 'streaming' | 'complete' | 'error'
        message: '',
        processedGangs: 0,
        totalGangs: 0,
        processedEmployees: 0,
        totalEmployees: 0,
        bytesReceived: 0
    });
    const [grandTotal, setGrandTotal] = useState(null);
    const [error, setError] = useState(null);
    const [isComplete, setIsComplete] = useState(false);

    const abortControllerRef = useRef(null);
    const gangsMapRef = useRef({});                   // Track gangs by code for updates

    // Reset state when params change
    useEffect(() => {
        setGangs([]);
        setMeta(null);
        setGrandTotal(null);
        setError(null);
        setIsComplete(false);
        gangsMapRef.current = {};
        setProgress({
            stage: null,
            message: '',
            processedGangs: 0,
            totalGangs: 0,
            processedEmployees: 0,
            totalEmployees: 0,
            bytesReceived: 0
        });
    }, [division, month, year, gangPrefix, gangCode]);

    const startStream = useCallback(async () => {
        if (!token || !division || !month || !year || !enabled) return;

        // Abort any existing stream
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        // Reset state
        setGangs([]);
        setMeta(null);
        setGrandTotal(null);
        setError(null);
        setIsComplete(false);
        gangsMapRef.current = {};
        setProgress({
            stage: 'connecting',
            message: 'Menghubungi server...',
            processedGangs: 0,
            totalGangs: 0,
            processedEmployees: 0,
            totalEmployees: 0,
            bytesReceived: 0
        });

        try {
            const shouldSendGangPrefix = !gangCode || gangCode === 'ALL';
            const prefixParam = shouldSendGangPrefix && gangPrefix ? `&gang_prefix=${gangPrefix}` : '';
            const gangCodeParam = gangCode && gangCode !== 'ALL' ? `&gang_code=${gangCode}` : '';
            const url = `/payroll/report/division-raw-tree/stream?division_code=${division}&month=${month}&year=${year}${prefixParam}${gangCodeParam}`;

            console.log('[usePayrollStream] Starting SSE stream:', url);

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` },
                signal: controller.signal
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            // Set stage to querying (waiting for DB queries)
            setProgress(prev => ({ ...prev, stage: 'querying', message: 'Memproses query database...' }));

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let totalBytes = 0;

            while (true) {
                const { done, value } = await reader.read();

                if (done) break;

                totalBytes += value.length;
                buffer += decoder.decode(value, { stream: true });

                // Process complete SSE events in buffer
                // SSE format: "event: NAME\ndata: JSON\n\n"
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                let eventName = '';
                let eventData = '';

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        eventName = line.slice(7).trim();
                    } else if (line.startsWith('data: ')) {
                        eventData = line.slice(6);
                    } else if (line === '' && eventName && eventData) {
                        // End of event
                        try {
                            const data = JSON.parse(eventData);

                            switch (eventName) {
                                case 'meta': {
                                    // Initial metadata
                                    setMeta(data);
                                    setProgress(prev => ({
                                        ...prev,
                                        stage: 'querying',
                                        message: `Query selesai (${data.meta?.query_time_ms || 0}ms), siap streaming...`,
                                        totalGangs: data.total_gangs || 0,
                                        totalEmployees: data.total_employees || 0,
                                        bytesReceived: totalBytes
                                    }));
                                    break;
                                }

                                case 'progress': {
                                    // Progress update
                                    setProgress(prev => ({
                                        ...prev,
                                        stage: data.stage || 'streaming',
                                        message: data.message || 'Memproses...',
                                        processedGangs: data.processed_gangs || 0,
                                        totalGangs: data.total_gangs || 0,
                                        processedEmployees: data.processed_employees || 0,
                                        totalEmployees: data.total_employees || 0,
                                        bytesReceived: totalBytes
                                    }));
                                    break;
                                }

                                case 'gang': {
                                    // New gang data received
                                    const { gang_code, employees, gang_totals, employees_count } = data;

                                    gangsMapRef.current[gang_code] = {
                                        gang_code,
                                        employees,
                                        gang_totals
                                    };

                                    // Update gangs array reactively
                                    setGangs(prev => {
                                        const next = [...prev];
                                        const existingIdx = next.findIndex(g => g.gang_code === gang_code);
                                        if (existingIdx >= 0) {
                                            next[existingIdx] = gangsMapRef.current[gang_code];
                                        } else {
                                            // Insert in sorted order
                                            const insertIdx = next.findIndex(g => g.gang_code > gang_code);
                                            if (insertIdx >= 0) {
                                                next.splice(insertIdx, 0, gangsMapRef.current[gang_code]);
                                            } else {
                                                next.push(gangsMapRef.current[gang_code]);
                                            }
                                        }
                                        return next;
                                    });

                                    // Update progress
                                    setProgress(prev => ({
                                        ...prev,
                                        processedEmployees: prev.processedEmployees + (employees_count || 0),
                                        bytesReceived: totalBytes
                                    }));
                                    break;
                                }

                                case 'complete': {
                                    // Stream complete
                                    setGrandTotal(data.grand_total);
                                    setIsComplete(true);
                                    setProgress(prev => ({
                                        ...prev,
                                        stage: 'complete',
                                        message: `Selesai! ${data.gangs_count} gang, ${data.employees_count} karyawan`,
                                        processedGangs: data.gangs_count || 0,
                                        totalGangs: data.gangs_count || 0,
                                        processedEmployees: data.employees_count || 0,
                                        totalEmployees: data.employees_count || 0,
                                        bytesReceived: totalBytes
                                    }));
                                    break;
                                }

                                case 'error': {
                                    setError(data.message || 'Unknown error');
                                    setProgress(prev => ({
                                        ...prev,
                                        stage: 'error',
                                        message: data.message || 'Error'
                                    }));
                                    break;
                                }
                            }
                        } catch (e) {
                            console.warn('[usePayrollStream] Failed to parse SSE event:', e, 'raw:', eventData.slice(0, 100));
                        }

                        eventName = '';
                        eventData = '';
                    }
                }
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                console.log('[usePayrollStream] Stream aborted');
                return;
            }
            console.error('[usePayrollStream] Stream error:', err);
            setError(err.message);
            setProgress(prev => ({ ...prev, stage: 'error', message: err.message }));
        }
    }, [token, division, month, year, gangPrefix, gangCode, enabled]);

    const abort = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            console.log('[usePayrollStream] Stream aborted by user');
        }
    }, []);

    // Auto-start when enabled
    useEffect(() => {
        if (enabled) {
            startStream();
        } else {
            abort();
        }
        return () => abort();
    }, [enabled, startStream, abort]);

    return {
        gangs,
        meta,
        progress,
        grandTotal,
        error,
        isComplete,
        startStream,
        abort,
        totalBytesReceived: progress.bytesReceived
    };
}
