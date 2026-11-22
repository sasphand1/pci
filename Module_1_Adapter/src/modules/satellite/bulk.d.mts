export declare const SATELLITE_BATCH_SIZE: number;
export interface SatelliteBatchObservation { metric:'fire'|'rainfall'|'solar';location:string;observationKey:string;observedAt:string;payload:Record<string,unknown> }
export declare function buildObservationBatch(provider:'firms'|'power',observations:SatelliteBatchObservation[]):{sql:string;values:unknown[]};
