@echo off
cd /d "%~dp0Module_3_Admin_Panel"
if not exist .env.local (
  echo Missing Module 3 .env.local. Copy the example first.
  exit /b 1
)
if not exist node_modules (
  echo Missing node_modules. Run npm install first.
  exit /b 1
)
npm run dev
