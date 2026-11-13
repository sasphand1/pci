import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { randomUUID } from 'node:crypto';
import pino from 'pino';
export const logger=pino({level:process.env.LOG_LEVEL || 'info', redact: {paths:['req.headers.authorization','req.headers.cookie','password','token','totp','apiKey','secret'],remove:true}});
export class HttpError extends Error {constructor(public status:number,public code:string,message:string){super(message);}}
export function handler<T>(f:(req:Request,res:Response,next:NextFunction)=>Promise<T>) {
  return (req:Request,res:Response,next:NextFunction) => Promise.resolve(f(req,res,next)).catch(next);
}
export function errorMiddleware(err:unknown,req:Request,res:Response,_next:NextFunction) {
  const rid=String(res.locals.requestId ?? 'unknown');
  if (err instanceof SyntaxError && 'status' in err && (err as any).status===400) return res.status(400).json({error:{code:'INVALID_JSON',message:'Invalid JSON body'},requestId:rid});
  if (err instanceof ZodError) return res.status(400).json({error:{code:'VALIDATION_ERROR',message:'Invalid request',details:err.flatten().fieldErrors},requestId:rid});
  if (err instanceof HttpError) return res.status(err.status).json({error:{code:err.code,message:err.message},requestId:rid});
  logger.error({err,requestId:rid,route:req.path},'request failed');
  return res.status(500).json({error:{code:'INTERNAL_ERROR',message:'Internal server error'},requestId:rid});
}
export function requestId(req:Request,res:Response,next:NextFunction) { const id=randomUUID(); res.locals.requestId=id;res.setHeader('X-Request-ID',id);next(); }
