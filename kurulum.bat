@echo off
REM LocalPDF kurulum kontrolu (kurulum gerekmez, statik site)
cd /d "%~dp0"
echo [1/2] Dosyalar kontrol ediliyor...
if not exist index.html (echo HATA: index.html yok! & pause & exit /b 1)
echo [2/2] Python kontrolu (yerel sunucu icin, opsiyonel)...
python --version 2>nul || echo UYARI: Python yok, calistir.bat ile file:// olarak da acabilirsiniz.
echo.
echo KURULUM TAMAM. calistir.bat veya sunucu.bat kullanin.
pause
