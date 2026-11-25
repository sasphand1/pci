import { randomBytes } from 'node:crypto';
import { pool,query } from '../lib/db.js';
import { hashPassword,newTotpSecret,encryptSecret,authTotpUri } from '../lib/security.js';
// Recovery for an existing owner: keeps the email, sets a new random password and a new authenticator secret.
// The secret is encrypted with the MFA_ENCRYPTION_KEY of THIS process, so it must equal the key the live API uses.
async function main(){
 const email=process.argv[2]?.trim().toLowerCase();if(!email||!/^\S+@\S+\.\S+$/.test(email))throw new Error('Usage: npm run reset:owner -- owner@example.com');
 const found=await query("SELECT id FROM admin_users WHERE lower(email)=$1 AND role='owner'",[email]);
 if(found.rowCount!==1)throw new Error('No owner account with that email.');
 const chosen=process.env.NEW_OWNER_PASSWORD;
 if(chosen!==undefined&&chosen.length<12)throw new Error('NEW_OWNER_PASSWORD must be at least 12 characters.');
 const password=chosen??randomBytes(24).toString('base64url'),secret=newTotpSecret();
 await query("UPDATE admin_users SET password_hash=$2,totp_secret_enc=$3,active=true,session_version=session_version+1 WHERE id=$1",[found.rows[0].id,await hashPassword(password),encryptSecret(secret)]);
 console.log('\nOWNER RECOVERED (shown once; save it in a password manager)');
 console.log('Email:',email);console.log(chosen?'Password: the one you chose':'New password: '+password);console.log('Authenticator URI (add to your app, remove the old entry):',authTotpUri(email,secret));
}
main().catch(e=>{console.error(e.message||e);process.exitCode=1;}).finally(()=>pool.end());
