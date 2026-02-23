import React, { createContext, useState, useContext, useEffect } from 'react';
import { useCurrentPeriod } from '../hooks/useCurrentPeriod';
import { fetchGangs, fetchDivisions } from '../services/gangService';
import { getLockedGangs } from '../services/lockedDivisionService';
import { useAuth } from './AuthContext';
import { isProdMode, getUserDivision } from '../utils/prodModeUtils';

const ReportContext = createContext();

export const useReport = () => useContext(ReportContext);

export const ReportProvider = ({ children }) => {
    const { user, token, lockedDivision } = useAuth();
    const { month, setMonth, year, setYear, data: currentPeriodData } = useCurrentPeriod();

    // State for filters
    const [division, setDivision] = useState('');
    const [gang, setGang] = useState('');
    const [gangs, setGangs] = useState([]);
    const [allDivisions, setAllDivisions] = useState([]);

    // Loading states
    const [gangLoading, setGangLoading] = useState(false);
    const [divisionsLoading, setDivisionsLoading] = useState(false);

    // Determine if we're in locked mode (Admin is never locked)
    const inProdMode = isProdMode();
    const prodDivision = inProdMode ? getUserDivision() : null;
    const isAdminUser = user?.isAdmin === true ||
        (user?.role && user.role.toUpperCase() === 'ADMIN') ||
        (user?.divisi && user.divisi.toUpperCase() === 'ALL');

    const externalLockedDiv = isAdminUser ? null : (lockedDivision || null); // removed prop drilling support for now, rely on context/auth
    const isLockedMode = !isAdminUser && !!(externalLockedDiv || prodDivision);

    // Load Divisions
    useEffect(() => {
        async function loadDivisions() {
            if (!token) return;
            setDivisionsLoading(true);
            try {
                const divisions = await fetchDivisions(token);
                setAllDivisions(divisions || []);
                console.log('[ReportContext] Loaded divisions:', divisions);
            } catch (e) {
                console.error('[ReportContext] Failed to load divisions:', e);
                setAllDivisions([]);
            } finally {
                setDivisionsLoading(false);
            }
        }
        loadDivisions();
    }, [token]);

    // Initial Division Selection Logic
    useEffect(() => {
        let initialDivision = '';

        // Priority 1: External locked division
        if (externalLockedDiv) {
            initialDivision = externalLockedDiv;
        }
        // Priority 2: PRODUCTION MODE - Division is LOCKED
        else if (inProdMode && prodDivision) {
            initialDivision = prodDivision;
        }
        // Priority 3: Non-Admin User - Auto-select from Token
        else if (!isAdminUser && (user?.divisions?.length > 0 || user?.divisi)) {
            initialDivision = user?.divisions?.[0] || user?.divisi;
        }
        // Priority 4: Try first division from API (Fallback for Admins)
        else if (allDivisions.length > 0 && !division) {
            // Only auto-select if nothing selected yet
            // initialDivision = allDivisions[0]; // Maybe don't auto-select for admin to force choice? 
            // Let's keep existing behavior:
            initialDivision = allDivisions[0];
        }

        if (initialDivision && !division) {
            setDivision(initialDivision);
        }
    }, [user, inProdMode, prodDivision, externalLockedDiv, allDivisions, isAdminUser, division]);

    // Track latest gang value to avoid stale closures in async calls
    const gangRef = React.useRef(gang);
    useEffect(() => {
        gangRef.current = gang;
    }, [gang]);

    // Load Gangs when Division changes
    useEffect(() => {
        async function load() {
            console.log('[ReportContext] loadGangs effect triggered', { division, hasToken: !!token, isLockedMode });

            if (!division || !token) {
                setGangs([]);
                setGang('');
                return;
            }

            // If the user already selected a gang, we don't want to wipe it out while loading
            // But we do want to disable the selector potentially? 
            // For now, let's just fetch.
            setGangLoading(true);
            try {
                let list;
                if (isLockedMode) {
                    list = await getLockedGangs(token, division);
                } else {
                    list = await fetchGangs(token, division, null, true);
                }

                if (list && list.length > 0) {
                    setGangs(list);

                    // Check against the LATEST gang value (from ref)
                    const currentGang = gangRef.current;
                    const currentExists = list.some(g => g.gang_code === currentGang);

                    console.log('[ReportContext] Gangs loaded', {
                        count: list.length,
                        currentGang,
                        currentExists
                    });

                    // Only auto-select if:
                    // 1. No gang is currently selected
                    // 2. OR the currently selected gang is NOT in the new list (invalid)
                    if (!currentGang || !currentExists) {
                        if (list[0]?.gang_code) {
                            console.log('[ReportContext] Auto-selecting first gang:', list[0].gang_code);
                            setGang(list[0].gang_code);
                        }
                    }
                } else {
                    setGangs([]);
                    setGang('');
                }
            } catch (e) {
                console.error('Failed to load gangs:', e);
                if (e.response?.status !== 401) {
                    setGangs([]);
                    setGang('');
                }
            } finally {
                setGangLoading(false);
            }
        }
        load();
    }, [division, token, isLockedMode]);

    const value = {
        month, setMonth,
        year, setYear,
        division, setDivision,
        gang, setGang,
        gangs,
        allDivisions,
        gangLoading,
        divisionsLoading,
        isLockedMode,
        isAdminUser,
        currentPeriod: currentPeriodData
    };

    return <ReportContext.Provider value={value}>{children}</ReportContext.Provider>;
};
