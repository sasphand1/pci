import { randomBytes } from 'node:crypto';
import { pool,query } from '../lib/db.js';
import { hashPassword,newTotpSecret,encryptSecret,authTotpUri } from '../lib/security.js';
async function main(){
 const email=process.argv[2]?.trim().toLowerCase();if(!email||!/^\S+@\S+\.\S+$/.test(email))throw new Error('Usage: npm run create:owner -- owner@example.com');
 const existing=await query("SELECT COUNT(*)::int AS n FROM admin_users WHERE role='owner'");if(existing.rows[0].n>0)throw new Error('Owner already exists. Use admin API for additional accounts.');
 const password=randomBytes(24).toString('base64url'),secret=newTotpSecret();
 await query("INSERT INTO admin_users(email,password_hash,role,totp_secret_enc) VALUES($1,$2,'owner',$3)",[email,await hashPassword(password),encryptSecret(secret)]);
 console.log('\nONE-TIME OWNER CREDENTIALS (save securely, not in source code)');
 console.log('Email:',email);console.log('Password:',password);console.log('MFA authenticator URI:',authTotpUri(email,secret));
 console.log('Use a TOTP app to add the URI. Store backup securely and delete shell logs.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>pool.end());
