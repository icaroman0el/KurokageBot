@echo off
setlocal
cd /d "%~dp0"

if not exist ".env" (
  echo Primeira inicializacao do Kurokage.
  echo.
  set /p DISCORD_TOKEN_INPUT=Cole o token novo do bot e pressione Enter: 
  > ".env" echo DISCORD_TOKEN=%DISCORD_TOKEN_INPUT%
  >> ".env" echo DISCORD_CLIENT_ID=1550503125000126574
  >> ".env" echo DISCORD_GUILD_ID=1485808592522317886
  echo.
  echo Arquivo .env criado.
  echo.
)

echo Iniciando Kurokage...
echo Feche esta janela para desligar o bot.
echo.
"%~dp0kurokage-bot.exe"

echo.
echo O bot parou. Pressione qualquer tecla para fechar.
pause >nul
