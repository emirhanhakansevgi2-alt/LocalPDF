@echo off
REM LocalPDF - yerel sunucu ile calistir (onerilen: Worker + DOCX icin http gerekli olabilir)
cd /d "%~dp0"
echo ======================================
echo  LocalPDF yerel sunucu baslatiliyor
echo  Adres: http://localhost:8000
echo  Durdurmak icin: Ctrl+C
echo ======================================
python -m http.server 8000
if errorlevel 1 (
  echo Python bulunamadi, npx deneniyor...
  npx -y http-server -p 8000 .
)
pause
