export declare const SATELLITE_BATCH_SIZE: number;
export type SatelliteProviderId='firms'|'power'|'eonet'|'usgs'|'gibs'|'gpm'|'airquality'|'weather'|'flood'|'gdacs'|'swpc'|'celestrak'|'openaq';
export type SatelliteMetric='fire'|'rainfall'|'solar'|'natural_event'|'imagery'|'earthquake'|'air_quality'|'weather'|'river_flow'|'disaster_alert'|'space_weather'|'orbit'|'aq_station';
export declare const SATELLITE_PROVIDER_IDS: readonly SatelliteProviderId[];
export declare const SATELLITE_METRICS: readonly SatelliteMetric[];
export interface SatelliteBatchObservation { metric:SatelliteMetric;location:string;observationKey:string;observedAt:string;payload:Record<string,unknown> }
export declare function buildObservationBatch(provider:SatelliteProviderId,observations:SatelliteBatchObservation[]):{sql:string;values:unknown[]};
