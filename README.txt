EditEase — Full Backend + Frontend (Render-ready)
================================================

Contents:
- server.js       -> Express backend with upload, thumbnails, split, concat
- package.json    -> dependencies and start script
- public/         -> frontend (index.html, styles.css, app.js)

How to run locally:
1. npm install
2. npm start
3. Open http://localhost:4000

Deploy to Render:
- Push this project to GitHub (all files)
- Create new Web Service on Render, link to repo
- Build command: npm install
- Start command: npm start
- Render will serve the frontend from /public and backend via Express

Notes:
- Uploaded videos and outputs are stored on instance disk.
- For production, use S3 for storage and worker pattern for heavy ffmpeg tasks.
