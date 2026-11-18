import { createCipheriv,createDecipheriv,createHash,createHmac,randomBytes,timingSafeEqual } from 'node:crypto';
import argon2 from 'argon2';
import { config } from './config.js';
export const opaqueToken=()=>randomBytes(32).toString('base64url');
export const sha256=(s:string)=>createHash('sha256').update(s).digest('hex');
export const hashPassword=(p:string)=>argon2.hash(p,{type:argon2.argon2id,memoryCost:19456,timeCost:3,parallelism:1});
export const verifyPassword=(hash:string,p:string)=>argon2.verify(hash,p);
export const pseudonym=(s:string)=>createHmac('sha256',Buffer.from(config.LOG_HMAC_KEY,'hex')).update(s).digest('hex').slice(0,24);
const encKey=Buffer.from(config.MFA_ENCRYPTION_KEY,'hex');
export function encryptSecret(s:string) {const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',encKey,iv);const ct=Buffer.concat([cipher.update(s,'utf8'),cipher.final()]);return [iv.toString('hex'),cipher.getAuthTag().toString('hex'),ct.toString('hex')].join('.');}
export function decryptSecret(s:string) { const [iv,tag,ct]=s.split('.');const d=createDecipheriv('aes-256-gcm',encKey,Buffer.from(iv,'hex'));d.setAuthTag(Buffer.from(tag,'hex'));return Buffer.concat([d.update(Buffer.from(ct,'hex')),d.final()]).toString('utf8');}
export function newTotpSecret():string { return randomBytes(20).toString('hex'); }
function totp(secret:string,step:number):string {const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(step));const digest=createHmac('sha1',Buffer.from(secret,'hex')).update(b).digest();const offset=digest[digest.length-1]&0x0f;return ((digest.readUInt32BE(offset)&0x7fffffff)%1_000_000).toString().padStart(6,'0');}
export function validTotp(secret:string,code:string,now=Date.now()):boolean {if(!/^\d{6}$/.test(code))return false;const step=Math.floor(now/30_000);for(const shift of [-1,0,1]){const candidate=Buffer.from(totp(secret,step+shift));const supplied=Buffer.from(code);if(timingSafeEqual(candidate,supplied))return true;}return false;}
export function totpUri(email:string,secret:string) {return `otpauth://totp/PakistanCreatorIndex:${encodeURIComponent(email)}?secret=${Buffer.from(secret,'hex').toString('base64').replace(/=+$/,'')}&issuer=PakistanCreatorIndex&algorithm=SHA1&digits=6&period=30`;}
// Authenticator QR URI expects RFC4648 base32. This converter is defined here to avoid depending on proprietary MFA services.
export function toBase32(bytes:Buffer) {const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=0,value=0,result='';for(const c of bytes){value=(value<<8)|c;bits+=8;while(bits>=5){result+=alphabet[(value>>>(bits-=5))&31];}}if(bits>0)result+=alphabet[(value<<(5-bits))&31];return result;}
export function authTotpUri(email:string,secret:string){return `otpauth://totp/${encodeURIComponent('PakistanCreatorIndex:'+email)}?secret=${toBase32(Buffer.from(secret,'hex'))}&issuer=PakistanCreatorIndex&algorithm=SHA1&digits=6&period=30`;}
