type Video={videoId:string;title:string;currentViews:number|null;publishedAt:string|null;observedAt:string|null};
type Cohort={videoCount:number;observationCount:number;points:{at:string;total:number;median:number}[]};
type Point={time:number;value:number};type Rate=Point&{from:number;gain:number;hours:number};type Observation={at:string;value:number};
export function profileAnalytics<T extends Video>(videos:T[],cohort:Cohort|null,subscribers:Observation[]):{portfolio:{known:T[];total:number|null;median:number|null;topShare:number|null;topFiveShare:number|null;topFiveViews:number|null;age:{videoId:string;title:string;days:number;value:number}[];bands:{label:string;value:number}[];dated:number};growth:{points:Point[];medians:Point[];cumulative:Point[];rates:Rate[];pace:number|null;delta:number|null;change:number|null;dailyTotals:Point[];dailyRates:Point[]};subscriberRanges:Record<7|30|90,{points:Observation[];gain:number|null}>};
export function profileAudience(accounts:{platform:string;followers:number|null}[]):{total:number|null;knownSum:number;rows:{platform:string;linked:boolean;count:number|null;share:number|null}[]};

export function safeChannelBanner(value:unknown):string|null;

export function channelGrowth(history:Observation[]):ReturnType<typeof profileAnalytics>['growth'];
