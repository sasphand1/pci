@echo off
cd /d "%~dp0Module_1_Adapter"
if not exist .env (
  echo Missing Module 1 .env. Read README.md and configure credentials first.
  exit /b 1
)
docker compose up -d --build
if errorlevel 1 exit /b 1
docker compose ps
