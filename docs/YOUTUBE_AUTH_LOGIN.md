# YouTube OAuth Login Flow

1. Create Google Cloud project: Keynu
2. Enable YouTube Data API v3
3. Configure Google Auth Platform branding and add your Gmail as test user
4. Create OAuth Client ID: Desktop app
5. Copy `config/youtube.example.json` to `config/youtube.json`
6. Paste client ID and secret
7. Run `node dist/drivers/youtube/cli.js auth-login`
8. Approve in browser
9. Confirm `refreshToken` exists in `config/youtube.json`

Never commit `config/youtube.json` to GitHub.
