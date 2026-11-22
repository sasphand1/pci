export declare const SATELLITE_BATCH_SIZE: number;
export interface SatelliteBatchObservation { metric:'fire'|'rainfall'|'solar'|'natural_event'|'scene'|'imagery';location:string;observationKey:string;observedAt:string;payload:Record<string,unknown> }
export declare function buildObservationBatch(provider:'firms'|'power'|'eonet'|'gibs'|'gpm'|'sentinel1'|'sentinel2'|'sentinel5p',observations:SatelliteBatchObservation[]):{sql:string;values:unknown[]};
