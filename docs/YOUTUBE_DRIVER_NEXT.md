# Keynu YouTube Driver v0.3

This patch adds a Keynu-style job runner on top of the existing YouTube driver.

## New files

- `src/drivers/youtube/jobTypes.ts`
- `src/drivers/youtube/jobRunner.ts`
- `src/drivers/youtube/cli.ts`
- `examples/youtube/upload-job.example.json`

## Run after build

```powershell
npm run build
node dist/drivers/youtube/cli.js examples/youtube/upload-job.example.json youtube-report.json
```

## Job fields

- `videoPath`: required local mp4/webm/mov path
- `thumbnailPath`: optional png/jpg path
- `title`: required
- `description`: optional
- `tags`: string or string[] without hashtags
- `categoryId`: default `28` Science & Technology
- `privacyStatus`: `private`, `unlisted`, or `public`
- `madeForKids`: default false
- `playlistId`: optional
- `notifySubscribers`: default false

## Notes

YouTube end screens are not supported by the public YouTube Data API. The safe replacement is adding the uploaded video to a playlist and linking recent/related videos inside the description.
