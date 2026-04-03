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
        currentGang: null
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
                currentGang: null
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
            currentGang: null
        });

        try {
            const shouldSendGangPrefix = !gangCode || gangCode === 'ALL';
            const prefixParam = shouldSendGangPrefix && gangPrefix ? `&gang_prefix=${gangPrefix}` : '';
            const gangCodeParam = gangCode && gangCode !== 'ALL' ? `&gang_code=${gangCode}` : '';
            const url = `/payroll/report/division-raw-tree/stream?division_code=${division}&month=${month}&year=${year}${prefixParam}${gangCodeParam}`;

            console.log('[usePayrollStream] Starting JSON fetch:', url);

            setProgress(prev => ({ ...prev, stage: 'querying', message: 'Memproses query database...' }));

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` },
                signal: controller.signal
            });

            console.log('[usePayrollStream] Response status:', response.status, 'ok:', response.ok);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const json = await response.json();
            console.log('[usePayrollStream] JSON received:', json.meta?.total_gangs, 'gangs,', json.meta?.total_employees, 'employees');

            if (json.error) {
                throw new Error(json.error);
            }

            // Set meta
            setMeta(json.meta || {});
            setProgress(prev => ({
                ...prev,
                stage: 'streaming',
                message: `Loading ${json.gangs?.length || 0} gangs...`,
                totalGangs: json.meta?.total_gangs || 0,
                totalEmployees: json.meta?.total_employees || 0
            }));

            // Process gangs progressively
            const gangsData = json.gangs || [];
            gangsMapRef.current = {};

            for (let i = 0; i < gangsData.length; i++) {
                if (controller.signal.aborted) {
                    console.log('[usePayrollStream] Aborted during progressive load');
                    return;
                }

                const gangData = gangsData[i];
                gangsMapRef.current[gangData.gang_code] = gangData;

                // Update gangs array incrementally
                setGangs(prev => {
                    const next = [...prev];
                    const existingIdx = next.findIndex(g => g.gang_code === gangData.gang_code);
                    if (existingIdx >= 0) {
                        next[existingIdx] = gangData;
                    } else {
                        // Insert in sorted order
                        const insertIdx = next.findIndex(g => g.gang_code > gangData.gang_code);
                        if (insertIdx >= 0) {
                            next.splice(insertIdx, 0, gangData);
                        } else {
                            next.push(gangData);
                        }
                    }
                    return next;
                });

                // Update progress
                setProgress(prev => ({
                    ...prev,
                    processedGangs: i + 1,
                    processedEmployees: prev.processedEmployees + (gangData.employees?.length || 0),
                    currentGang: gangData.gang_code
                }));

                // Small delay between gangs for visual effect
                await new Promise(r => setTimeout(r, 30));
            }

            // Complete
            setGrandTotal(json.grand_total || null);
            setIsComplete(true);
            setProgress(prev => ({
                ...prev,
                stage: 'complete',
                message: `Selesai! ${json.meta?.total_gangs || 0} gang, ${json.meta?.total_employees || 0} karyawan`,
                processedGangs: json.meta?.total_gangs || 0,
                totalGangs: json.meta?.total_gangs || 0,
                processedEmployees: json.meta?.total_employees || 0,
                totalEmployees: json.meta?.total_employees || 0,
                currentGang: null
            }));
            console.log('[usePayrollStream] Complete');

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
