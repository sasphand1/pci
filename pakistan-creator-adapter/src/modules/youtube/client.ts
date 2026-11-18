import { config } from '../../lib/config.js';
import { boundedLimit } from '../../lib/redis.js';
import { chunks,countOrNull,dateOrNull,thumbUrl } from './normalizers.mjs';
export { chunks,countOrNull,dateOrNull,thumbUrl } from './normalizers.mjs';

export type YoutubeChannel={
 id:string; snippet?:{title?:string,description?:string,publishedAt?:string,thumbnails?:Record<string,{url:string}>};
 statistics?:{subscriberCount?:string,hiddenSubscriberCount?:boolean,viewCount?:string,videoCount?:string};
 contentDetails?:{relatedPlaylists?:{uploads?:string}};
};
export type YoutubeVideo={
 id:string; snippet?:{channelId?:string,title?:string,description?:string,publishedAt?:string,thumbnails?:Record<string,{url:string}>};
 contentDetails?:{duration?:string}; statistics?:{viewCount?:string,likeCount?:string,commentCount?:string};
};
export class YoutubeClient {
  calls=0;
  private async get<T>(path:string,params:Record<string,string>):Promise<T>{
    if(!config.YOUTUBE_API_KEY)throw new Error('YOUTUBE_API_KEY not configured');
    const url=new URL(`https://www.googleapis.com/youtube/v3/${path}`);
    Object.entries({...params,key:config.YOUTUBE_API_KEY}).forEach(([k,v])=>url.searchParams.set(k,v));
    for(let attempt=0;attempt<4;attempt++){
      const quotaDay=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      if(!await boundedLimit(`youtube:daily:${quotaDay}`,config.YOUTUBE_DAILY_SOFT_LIMIT,172800))throw new Error('YOUTUBE_SOFT_QUOTA_LIMIT');
      this.calls++;
      let response:Response;
      try{response=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(12000)});}
      catch(e){if(attempt===3)throw new Error('YouTube network request failed');await sleep(backoff(attempt));continue;}
      if(response.ok)return await response.json() as T;
      let reason='unknown';try{const body=await response.json() as any;reason=body?.error?.errors?.[0]?.reason??'unknown';}catch{}
      if(response.status===403 || response.status===400 || response.status===401)throw new Error(`YOUTUBE_${response.status}_${reason}`.slice(0,120));
      if(![429,500,502,503,504].includes(response.status) || attempt===3)throw new Error(`YOUTUBE_HTTP_${response.status}`);
      await sleep(backoff(attempt));
    }
    throw new Error('YOUTUBE_RETRIES_EXCEEDED');
  }
  async channels(ids:string[]):Promise<YoutubeChannel[]>{
    if(ids.length>50)throw new Error('channels batch exceeds 50');
    const d=await this.get<{items?:YoutubeChannel[]}>('channels',{part:'snippet,statistics,contentDetails',id:ids.join(','),maxResults:'50'});
    return d.items??[];
  }
  async uploads(playlistId:string,limit:number):Promise<string[]>{
    const d=await this.get<{items?:Array<{contentDetails?:{videoId?:string}}>}>( 'playlistItems',{part:'contentDetails',playlistId,maxResults:String(limit)});
    return (d.items??[]).map(x=>x.contentDetails?.videoId).filter((s):s is string=>typeof s==='string'&& /^[A-Za-z0-9_-]{11}$/.test(s));
  }
  async videos(ids:string[]):Promise<YoutubeVideo[]>{
    if(ids.length>50)throw new Error('videos batch exceeds 50');
    const d=await this.get<{items?:YoutubeVideo[]}>('videos',{part:'snippet,contentDetails,statistics',id:ids.join(',')});
    return d.items??[];
  }
}
const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
const backoff=(attempt:number)=>Math.min(8000,500*Math.pow(2,attempt))+Math.floor(Math.random()*300);
