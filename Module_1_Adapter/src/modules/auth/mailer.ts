import nodemailer from 'nodemailer';
import { config } from '../../lib/config.js';
export async function sendVerificationMail(email:string,token:string){
  const link=`${config.APP_PUBLIC_URL.replace(/\/$/,'')}/verify-email?token=${encodeURIComponent(token)}`;
  if(!config.SMTP_HOST){
    if(config.NODE_ENV==='production')throw new Error('SMTP required in production');
    console.info(`[DEV EMAIL OUTBOX] ${email}: ${link}`);return;
  }
  const transporter=nodemailer.createTransport({host:config.SMTP_HOST,port:config.SMTP_PORT,secure:config.SMTP_PORT===465,auth:config.SMTP_USER?{user:config.SMTP_USER,pass:config.SMTP_PASS}:undefined});
  await transporter.sendMail({from:config.SMTP_FROM,to:email,subject:'Verify your Pakistan Creator Index account',text:`Verify your email using this link (expires in 24 hours):\n${link}`});
}

export async function sendPasswordResetMail(email:string,token:string){
 const link=`${config.APP_PUBLIC_URL.replace(/\/$/,'')}/reset-password?token=${encodeURIComponent(token)}`;
 if(!config.SMTP_HOST){
   if(config.NODE_ENV==='production')throw new Error('SMTP required in production');
   console.info(`[DEV PASSWORD RESET OUTBOX] ${email}: ${link}`);return;
 }
 const transporter=nodemailer.createTransport({host:config.SMTP_HOST,port:config.SMTP_PORT,secure:config.SMTP_PORT===465,auth:config.SMTP_USER?{user:config.SMTP_USER,pass:config.SMTP_PASS}:undefined});
 await transporter.sendMail({from:config.SMTP_FROM,to:email,subject:'Reset your Pakistan Creator Index password',text:`Reset your password using this link (expires in 30 minutes):\n${link}`});
}
