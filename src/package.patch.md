# package.json patch

Add these dependencies in Keynu:

```powershell
npm install googleapis google-auth-library
npm install -D tsx
```

Optional scripts:

```json
{
  "scripts": {
    "youtube:auth-url": "tsx examples/youtube-auth-url.ts",
    "youtube:exchange-code": "tsx examples/youtube-exchange-code.ts",
    "youtube:upload-example": "tsx examples/youtube-upload-example.ts"
  }
}
```
