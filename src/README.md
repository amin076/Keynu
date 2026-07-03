# Keynu YouTube Driver v0.1

A first YouTube Data API v3 driver for Keynu.

## Features

- OAuth2 auth URL and refresh token flow
- Upload video with title, description, tags, category, privacy status
- Set `selfDeclaredMadeForKids`
- Set custom thumbnail
- Add uploaded video to a playlist
- Defaults for Science & Technology category (`28`)

## Install dependency

From Keynu root:

```powershell
npm install googleapis google-auth-library
npm install -D tsx
```

## Environment

```powershell
$env:YOUTUBE_CLIENT_ID="your-client-id"
$env:YOUTUBE_CLIENT_SECRET="your-client-secret"
$env:YOUTUBE_REDIRECT_URI="http://localhost:7777/oauth2callback"
$env:YOUTUBE_REFRESH_TOKEN="your-refresh-token"
$env:YOUTUBE_PLAYLIST_ID="your-playlist-id"
```

## First OAuth token

```powershell
npx tsx examples/youtube-auth-url.ts
```

Open the URL, approve YouTube access, copy the returned `code`, then:

```powershell
npx tsx examples/youtube-exchange-code.ts "PASTE_CODE_HERE"
```

Save `refresh_token` into `YOUTUBE_REFRESH_TOKEN`.

## Test upload

Edit paths in `examples/youtube-upload-example.ts`, then:

```powershell
npx tsx examples/youtube-upload-example.ts
```

## Important limitation

YouTube Data API does not provide a normal public endpoint for adding End Screen elements to an uploaded video. This driver can add playlist, title, description, tags, thumbnail, privacy and made-for-kids status, but not End Screen cards/elements.
