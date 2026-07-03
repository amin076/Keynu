# Keynu YouTube Driver v0.4

Adds local OAuth login and `config/youtube.json` credential storage.

## Install

```powershell
npm install googleapis
npm uninstall google-auth-library
npm run build
```

## Setup config

Copy:

```powershell
copy config\youtube.example.json config\youtube.json
```

Edit `config/youtube.json` and paste your Google OAuth Desktop app `clientId` and `clientSecret`.

## Login

```powershell
npm run build
node dist/drivers/youtube/cli.js auth-login
```

Browser opens. Approve YouTube access. The driver saves `refreshToken` into `config/youtube.json`.

## Upload

Edit `examples/youtube/upload-job.example.json`, then run:

```powershell
node dist/drivers/youtube/cli.js upload examples/youtube/upload-job.example.json youtube-report.json
```

Default privacy is `private` for safety. Change job privacy to `public` only when you are ready.
