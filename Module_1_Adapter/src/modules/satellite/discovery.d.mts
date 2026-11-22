export declare const SCIENCE_DATASETS:Readonly<Record<string,{source:string;collection?:string;shortName?:string;kind:string}>>;
export declare function discoveryUrl(id:string,now?:Date):string;
export declare function parseDiscovery(id:string,data:unknown,now?:number):Array<{metric:'science_scene';location:string;observationKey:string;observedAt:string;payload:Record<string,unknown>}>;
