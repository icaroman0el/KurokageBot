# Kurokage Discord Bot

Discord bot for the Kurokage server.

## Commands

- `/ping`
- `/status`
- `/serverinfo`
- `/anunciar`
- `/limpar`
- `/organizar-servidor`

`/organizar-servidor confirmar:false` previews the base structure. It does not delete or rename anything.

## Local Development

```powershell
npm install
npm start
```

Use a local `.env` file:

```env
DISCORD_TOKEN=your_new_bot_token
DISCORD_CLIENT_ID=1550503125000126574
DISCORD_GUILD_ID=1485808592522317886
```

Do not commit `.env`.

## Windows Executable

Build a portable Windows executable:

```powershell
npm run build:win
```

The generated executable is ignored by Git and can be copied to:

```text
C:\Users\Ultra cursos\KurokageBot\app\kurokage-bot.exe
```

## Remote Layout

The old Windows machine uses this layout:

```text
KurokageBot/
  app/
  logs/
  scripts/
  source/
  backups/
  data/
```

Operational scripts live in `ops/` and are copied to `KurokageBot/scripts` on the remote machine.
