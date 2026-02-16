/**
 * Type definitions for Harvest / Bunches data
 */

export interface HarvestData {
    total_bunches: number;
    bunches_ripe: number;
    bunches_unripe: number;
    bunches_round: number;
    bunches_transactions: number;
}

export interface HarvestDataRaw {
    EmpCode: string;
    EmpName: string;
    TotalBunches: number;
    Ripe: number;
    Unripe: number;
    TotalRound: number;
    TrxCount: number;
}

export interface HarvestMasterData {
    ID: string;
    DocID: string;
    GangCode: string;
    DocDate: Date;
    TotalBunches: number;
    LocCode: string;
    AccMonth: string;
    AccYear: string;
    PhyMonth: string;
    PhyYear: string;
}

export interface HarvestLineData {
    ID: string;
    MasterID: string;
    GangMember: boolean;
    EmpCode: string;
    EmpName: string;
    TaskCode: string;
    TaskRtnVal: number;
    GrpRef: string;
    ChargeTo: string;
    Hours: number;
    Ripe: number;
    Unripe: number;
    TotalBunches: number;
    Rate: number;
    ABW: number;
    Amount: number;
    Status: number;
    TrxDate: Date;
    TotalRound: number;
    TotalWeight: number;
}

export interface HarvestExtendedData extends HarvestData {
    gang_code: string;
    emp_code: string;
    emp_name: string;
    month: number;
    year: number;
    doc_date?: Date;
    trx_date?: Date;
}
