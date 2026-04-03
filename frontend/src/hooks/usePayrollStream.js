/**
 * usePayrollStream.js
 *
 * Custom hook for consuming the SSE streaming endpoint for progressive payroll data.
 * Consumes Server-Sent Events (SSE) from `/payroll/report/division-raw-tree/stream`
 * and provides progressive state updates for the table.
 *
 * Features:
 * - TRUE progressive streaming (chunk-by-chunk, not waiting for full response)
 * - Proper SSE parsing that handles chunk boundaries
 * - Gang-by-gang progressive rendering
 * - Loading state management
 * - Error handling with progress tracking
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
    // State for gangs - array that grows progressively
    const [gangs, setGangs] = useState([]);           // Array of streamed gang objects
    const [meta, setMeta] = useState(null);           // Initial metadata from 'meta' event
    const [progress, setProgress] = useState({
        stage: null,                                  // null | 'connecting' | 'querying' | 'streaming' | 'complete' | 'error'
        message: '',
        processedGangs: 0,
        totalGangs: 0,
        processedEmployees: 0,
        totalEmployees: 0,
        bytesReceived: 0,
        currentGang: null,
        progressPct: 0,                               // 0-100 progressive percentage
        currentPhase: null                            // 'identity' | 'attendance' | 'overtime' | 'premium' | 'deductions' | 'complete'
    });
    const [grandTotal, setGrandTotal] = useState(null);
    const [error, setError] = useState(null);
    const [isComplete, setIsComplete] = useState(false);

    const abortControllerRef = useRef(null);
    const gangsMapRef = useRef({});                   // Track gangs by code for updates
    const mountedRef = useRef(true);

    // Reset gangs when params change (but not on every render)
    useEffect(() => {
        if (mountedRef.current) {
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
                bytesReceived: 0,
                currentGang: null,
                progressPct: 0,
                currentPhase: null
            });
        }
    }, [division, month, year, gangPrefix, gangCode]);

    const startStream = useCallback(async () => {
        if (!token || !division || !month || !year || !enabled) return;

        // Abort any existing stream
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        // Reset state for new stream
        gangsMapRef.current = {};
        setGangs([]);
        setMeta(null);
        setGrandTotal(null);
        setError(null);
        setIsComplete(false);
        setProgress({
            stage: 'connecting',
            message: 'Menghubungi server...',
            processedGangs: 0,
            totalGangs: 0,
            processedEmployees: 0,
            totalEmployees: 0,
            bytesReceived: 0,
            currentGang: null,
            progressPct: 0,
            currentPhase: null
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

            console.log('[usePayrollStream] Response status:', response.status, 'ok:', response.ok);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            if (!response.body) {
                throw new Error('No response body available');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    console.log('[usePayrollStream] Stream complete');
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                // Process complete SSE events
                while (true) {
                    const delimiterIndex = buffer.indexOf('\n\n');
                    if (delimiterIndex === -1) break;

                    const eventString = buffer.slice(0, delimiterIndex + 2);
                    buffer = buffer.slice(delimiterIndex + 2);

                    const eventMatch = eventString.match(/^event: ([^\n]+)\ndata: ([\s\S]*?)\n\n$/);
                    if (!eventMatch) continue;

                    const eventName = eventMatch[1];
                    const eventData = eventMatch[2];

                    try {
                        const data = JSON.parse(eventData);

                        switch (eventName) {
                            case 'meta': {
                                gangsMapRef.current = {};
                                setMeta(data);
                                setProgress(prev => ({
                                    ...prev,
                                    stage: data.stage || 'querying',
                                    message: data.meta?.query_time_ms ? `Query selesai (${data.meta.query_time_ms}ms)` : 'Menunggu data...',
                                    totalGangs: data.total_gangs || 0,
                                    totalEmployees: data.total_employees || 0
                                }));
                                console.log('[usePayrollStream] Meta:', data.total_gangs, 'gangs');
                                break;
                            }

                            case 'progress': {
                                setProgress(prev => ({
                                    ...prev,
                                    stage: data.stage || 'streaming',
                                    message: data.message || 'Memproses...',
                                    processedGangs: data.processed_gangs || prev.processedGangs,
                                    totalGangs: data.total_gangs || prev.totalGangs,
                                    processedEmployees: data.processed_employees || prev.processedEmployees,
                                    totalEmployees: data.total_employees || prev.totalEmployees,
                                    currentGang: data.current_gang || prev.currentGang,
                                    progressPct: data.progress_pct || (data.stage === 'complete' ? 100 : 0),
                                    currentPhase: data.current_phase || prev.currentPhase
                                }));
                                break;
                            }

                            case 'gang':
                            case 'gang_update': {
                                const { gang_code, employees, gang_totals, employees_count, gang_index, phase, is_complete } = data;

                                // Track if this gang data is from complete phase (fully enriched)
                                gangsMapRef.current[gang_code] = {
                                    gang_code,
                                    employees,
                                    gang_totals,
                                    employees_count,
                                    gang_index,
                                    phase,
                                    is_complete: is_complete || false
                                };

                                setGangs(prev => {
                                    const next = [...prev];
                                    const existingIdx = next.findIndex(g => g.gang_code === gang_code);
                                    if (existingIdx >= 0) {
                                        // Update existing gang - keep the most enriched version
                                        const existing = next[existingIdx];
                                        const existingPhase = existing.phase || 'identity';
                                        // Only update if new data is more enriched
                                        if ((phase === 'complete' && is_complete) || !existing.is_complete) {
                                            next[existingIdx] = gangsMapRef.current[gang_code];
                                        }
                                    } else {
                                        const insertIdx = next.findIndex(g => g.gang_code > gang_code);
                                        if (insertIdx >= 0) {
                                            next.splice(insertIdx, 0, gangsMapRef.current[gang_code]);
                                        } else {
                                            next.push(gangsMapRef.current[gang_code]);
                                        }
                                    }
                                    return next;
                                });
                                break;
                            }

                            case 'headers': {
                                // Update meta with dynamic headers when they arrive
                                console.log('[usePayrollStream] Headers received:', data);
                                setMeta(prev => ({
                                    ...(prev || {}),
                                    dynamic_premi_headers: data.dynamic_premi_headers || prev?.dynamic_premi_headers || [],
                                    dynamic_potongan_headers: data.dynamic_potongan_headers || prev?.dynamic_potongan_headers || [],
                                    premi_title_map: data.dynamic_premi_titles || prev?.premi_title_map || {},
                                    potongan_title_map: data.dynamic_potongan_titles || prev?.potongan_title_map || {}
                                }));
                                break;
                            }

                            case 'complete': {
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
                                    currentGang: null
                                }));
                                console.log('[usePayrollStream] Complete');
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
                        console.warn('[usePayrollStream] Parse error:', e.message);
                    }
                }
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                console.log('[usePayrollStream] Aborted');
                return;
            }
            console.error('[usePayrollStream] Error:', err);
            setError(err.message);
            setProgress(prev => ({ ...prev, stage: 'error', message: err.message }));
        }
    }, [token, division, month, year, gangPrefix, gangCode, enabled]);

    const abort = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            console.log('[usePayrollStream] Stream aborted by user');
        }
    }, []);

    // Auto-start when enabled
    useEffect(() => {
        mountedRef.current = true;
        if (enabled) {
            startStream();
        } else {
            abort();
        }
        return () => {
            mountedRef.current = false;
            abort();
        };
    }, [enabled, startStream, abort]);

    // Return stream object with all properties the component expects
    // Component uses: stream.gangs, stream.meta, stream.progress, stream.grandTotal, stream.error, stream.isComplete, stream.gangsMap
    return {
        // gangs array - grows progressively
        gangs,
        // metadata from 'meta' event
        meta,
        // progress info (stage, message, counts, etc)
        progress,
        // grand total from 'complete' event
        grandTotal,
        // error message if any
        error,
        // true when stream is complete
        isComplete,
        // map of gangs by code (for quick lookup)
        gangsMap: gangsMapRef.current,
        // start/abort functions
        startStream,
        abort,
        // total bytes received
        totalBytesReceived: progress.bytesReceived
    };
}
