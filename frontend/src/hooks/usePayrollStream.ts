/**
 * useStream.ts
 *
 * Simplified progressive payroll data streaming with minimal state management.
 *
 * Uses a stable ref pattern to avoid React circular dependencies:
 * - All mutable state lives in refs, updated in event handlers
 * - Only trigger re-render via useState setters in single batches
 * - No effects reading from hook state to trigger other state changes
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface StreamProgress {
    stage: 'connecting' | 'querying' | 'streaming' | 'complete' | 'error' | null;
    message: string;
    processedGangs: number;
    totalGangs: number;
    processedEmployees: number;
    totalEmployees: number;
    bytesReceived: number;
    queryTime?: number;
    error?: string;
}

interface StreamState {
    gangs: ReturnType<typeof useState<any[]>[0];
    meta: ReturnType<typeof useState<any>[0];
    progress: StreamProgress;
    grandTotal: ReturnType<typeof useState<any>[0];
    error: ReturnType<typeof useState<string | null>[0];
    isComplete: boolean;
    gangsMap: Record<string, any>;
    startStream: () => void;
    abort: () => void;
}

export function usePayrollStream({
    token, division, month, year, gangPrefix, gangCode, enabled
}: {
    token?: string;
    division?: string;
    month?: number;
    year?: number;
    gangPrefix?: string | null;
    gangCode?: string | null;
    enabled: boolean;
}): StreamState {
    // Stable render state (batched updates)
    const [renderState, setRenderState] = useState<{
        gangs: any[];
        meta: any;
        progress: StreamProgress;
        grandTotal: any;
        error: string | null;
        isComplete: boolean;
    }>({
        gangs: [],
        meta: null,
        progress: { stage: null, message: '', processedGangs: 0, totalGangs: 0, processedEmployees: 0, totalEmployees: 0, bytesReceived: 0 },
        grandTotal: null,
        error: null,
        isComplete: false,
    });

    // Mutable refs — never trigger re-render
    const gangsMapRef = useRef<Record<string, any>>({});
    const abortRef = useRef<AbortController | null>(null);
    const mountedRef = useRef(true);

    // Keep latest params in ref to avoid stale closures
    const paramsRef = useRef({ token, division, month, year, gangPrefix, gangCode, enabled });

    useEffect(() => {
        paramsRef.current = { token, division, month, year, gangPrefix, gangCode, enabled };
    }, [token, division, month, year, gangPrefix, gangCode, enabled]);

    const startStream = useCallback(() => {
        const p = paramsRef.current;
        if (!p.token || !p.division || !p.month || !p.year || !p.enabled) return;

        // Abort previous
        if (abortRef.current) {
            abortRef.current.abort();
        }
        abortRef.current = new AbortController();

        const ctrl = abortRef.current;

        const shouldSendPrefix = !p.gangCode || p.gangCode === 'ALL';
        const prefixParam = shouldSendPrefix && p.gangPrefix ? `&gang_prefix=${p.gangPrefix}` : '';
        const gangCodeParam = p.gangCode && p.gangCode !== 'ALL' ? `&gang_code=${p.gangCode}` : '';
        const url = `/payroll/report/division-raw-tree/stream?division_code=${p.division}&month=${p.month}&year=${p.year}${prefixParam}${gangCodeParam}`;

        console.log('[usePayrollStream] Starting:', url);

        fetch(url, {
            headers: { 'Authorization': `Bearer ${p.token}` },
            signal: ctrl.signal
        })
            .then(async (response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.text();
            })
            .then((text) => {
                if (!mountedRef.current) return;

                // Parse SSE manually from text
                const gangs: any[] = [];
                const lines = text.split('\n');
                let meta: any = null;
                let grandTotal: any = null;
                const progress: StreamProgress = {
                    stage: 'querying', message: 'Parsing...',
                    processedGangs: 0, totalGangs: 0, processedEmployees: 0, totalEmployees: 0, bytesReceived: text.length, queryTime: 0
                };

                let eventName = '';
                let eventData = '';
                let gangsMap: Record<string, any> = {};

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        eventName = line.slice(7).trim();
                    } else if (line.startsWith('data: ')) {
                        eventData = line.slice(6);
                    } else if (line === '' && eventName && eventData) {
                        try {
                            const data = JSON.parse(eventData);
                            if (eventName === 'meta') {
                                meta = data;
                                gangsMap = {};
                                progress.stage = 'querying';
                                progress.totalGangs = data.total_gangs || 0;
                                progress.totalEmployees = data.total_employees || 0;
                                progress.message = `Query selesai (${data.meta?.query_time_ms}ms)`;
                                progress.queryTime = data.meta?.query_time_ms;
                            } else if (eventName === 'progress') {
                                progress.stage = data.stage || 'streaming';
                                progress.message = data.message || 'Streaming...';
                                progress.processedGangs = data.processed_gangs || 0;
                                progress.totalGangs = data.total_gangs || 0;
                                progress.processedEmployees = data.processed_employees || 0;
                            } else if (eventName === 'gang') {
                                gangsMap[data.gang_code] = data;
                                progress.processedGangs = Math.max(progress.processedGangs || 0, (data.gang_index || 0) + 1);
                            } else if (eventName === 'complete') {
                                grandTotal = data.grand_total;
                                progress.stage = 'complete';
                                progress.isComplete = true;
                            } else if (eventName === 'error') {
                                progress.stage = 'error';
                                progress.error = data.message || 'Stream error';
                            }
                        } catch {}
                        eventName = '';
                        eventData = '';
                    }
                }

                if (!mountedRef.current) return;

                // Build sorted gangs array
                const sortedGangs = Object.keys(gangsMap)
                    .sort()
                    .map(k => gangsMap[k]);

                setRenderState({
                    gangs: sortedGangs,
                    meta: meta || null,
                    progress: { stage: 'complete', message: 'Selesai',
                        processedGangs: sortedGangs.length, totalGangs: sortedGangs.length,
                        processedEmployees: 0, totalEmployees: 0,
                        bytesReceived: text.length, queryTime: progress.queryTime || 0 },
                    grandTotal: grandTotal || null,
                    error: progress.error || null,
                    isComplete: true,
                });
            })
            .catch((err) => {
                if (err.name === 'AbortError') return;
                console.error('[usePayrollStream] Error:', err);
                setRenderState(prev => ({
                    ...prev,
                    progress: { ...prev.progress, stage: 'error', message: err.message },
                    error: err.message,
                }));
            });
    }, []); // Stable — uses refs only

    const abort = useCallback(() => {
        if (abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            abort();
        };
    }, [abort]);

    // Auto-start / abort when enabled changes
    useEffect(() => {
        if (!enabled) {
            abort();
            return;
        }
        // enabled=true → start stream via stable callback
        startStream();
    }, [enabled, startStream, abort]);

    return {
        gangs: renderState.gangs,
        meta: renderState.meta,
        progress: renderState.progress,
        grandTotal: renderState.grandTotal,
        error: renderState.error,
        isComplete: renderState.isComplete,
        gangsMap: gangsMapRef.current,
        startStream,
        abort,
    };
}
