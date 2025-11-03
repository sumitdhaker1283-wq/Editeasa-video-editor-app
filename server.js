const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { v4: uuidv4 } = require('uuid');
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(cors());
app.use(express.json({limit:'200mb'}));
app.use(express.urlencoded({extended:true, limit:'200mb'}));

const ROOT = __dirname;
const UPLOADS = path.join(ROOT, 'uploads');
const THUMBS = path.join(ROOT, 'thumbnails');
const SEGMENTS = path.join(ROOT, 'segments');
const OUTPUTS = path.join(ROOT, 'outputs');
const PUBLIC = path.join(ROOT, 'public');

[UPLOADS, THUMBS, SEGMENTS, OUTPUTS, PUBLIC].forEach(d=>{ if(!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const storage = multer.diskStorage({
  destination: (req,file,cb)=> cb(null, UPLOADS),
  filename: (req,file,cb)=> {
    const id = Date.now() + '_' + Math.floor(Math.random()*10000);
    const fname = id + path.extname(file.originalname);
    cb(null, fname);
  }
});
const upload = multer({ storage });

app.post('/upload', upload.single('file'), (req,res) => {
  if(!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ filename: req.file.filename, url: '/uploads/' + req.file.filename });
});

app.post('/thumbnails', async (req,res) => {
  try {
    const { filename, count } = req.body;
    if(!filename) return res.status(400).json({ error: 'filename required' });
    const infile = path.join(UPLOADS, filename);
    if(!fs.existsSync(infile)) return res.status(404).json({ error: 'file not found' });
    const folder = path.join(THUMBS, filename);
    if(!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    ffmpeg.ffprobe(infile, (err, metadata) => {
      if(err) return res.status(500).json({ error: 'ffprobe failed', detail: err.message });
      const dur = metadata.format.duration || 10;
      const n = Math.max(4, Math.min(120, parseInt(count) || 24));
      const step = dur / n;
      const promises = [];
      for(let i=0;i<n;i++){
        const t = Math.max(0, Math.min(dur - 0.01, i*step));
        const outName = path.join(folder, 'thumb_' + i + '.jpg');
        promises.push(new Promise((resolve, reject)=>{
          ffmpeg(infile)
            .screenshots({
              count: 1,
              timemarks: [t],
              filename: path.basename(outName),
              folder: folder,
              size: '320x?'
            })
            .on('end', ()=> resolve(outName))
            .on('error', (e)=> { console.error('thumb err', e); resolve(null); });
        }));
      }
      Promise.all(promises).then(results => {
        const thumbs = results.filter(Boolean).map(p => '/thumbs/' + filename + '/' + path.basename(p));
        res.json({ thumbs, folder: '/thumbs/' + filename });
      });
    });
  } catch(e){ console.error(e); res.status(500).json({ error: e.message }); }
});

app.post('/split', async (req,res) => {
  try {
    const { filename, times } = req.body;
    if(!filename) return res.status(400).json({ error: 'filename required' });
    const infile = path.join(UPLOADS, filename);
    if(!fs.existsSync(infile)) return res.status(404).json({ error: 'file not found' });
    const markers = (Array.isArray(times) ? times.map(Number) : []).sort((a,b)=>a-b);
    const ranges = [];
    let start = 0;
    for(const m of markers){ ranges.push({start, end: m}); start = m; }
    const ffprobe = await new Promise((resolve, reject)=> ffmpeg.ffprobe(infile, (err, md)=> err?reject(err):resolve(md)));
    const duration = ffprobe.format.duration || 0;
    ranges.push({start, end: duration});
    const outFiles = [];
    for(let i=0;i<ranges.length;i++){
      const r = ranges[i];
      const out = path.join(SEGMENTS, filename + '_part_' + i + path.extname(filename));
      await new Promise((resolve, reject)=>{
        ffmpeg(infile)
          .setStartTime(r.start)
          .setDuration(Math.max(0.01, r.end - r.start))
          .outputOptions('-c', 'copy')
          .output(out)
          .on('end', ()=> resolve())
          .on('error', (e)=> { console.error('split err', e); resolve(); })
          .run();
      });
      outFiles.push('/segments/' + path.basename(out));
    }
    res.json({ segments: outFiles });
  } catch(e){ console.error(e); res.status(500).json({ error: e.message }); }
});

app.post('/concat', async (req,res) => {
  try {
    const { files } = req.body;
    if(!Array.isArray(files) || files.length===0) return res.status(400).json({ error: 'files required' });
    const listFile = path.join(SEGMENTS, 'list_' + Date.now() + '.txt');
    const entries = files.map(f => {
      const name = f.replace(/^\//,'');
      const fp = path.join(__dirname, name);
      return "file '" + fp.replace(/'/g, "'\''") + "'";
    }).join('\n');
    fs.writeFileSync(listFile, entries);
    const outName = path.join(OUTPUTS, 'out_' + Date.now() + '.mp4');
    await new Promise((resolve, reject)=>{
      ffmpeg()
        .input(listFile)
        .inputOptions(['-f','concat','-safe','0'])
        .outputOptions(['-c','copy'])
        .output(outName)
        .on('end', ()=> resolve())
        .on('error', (e)=> { console.error('concat err', e); reject(e); })
        .run();
    });
    res.json({ output: '/outputs/' + path.basename(outName) });
  } catch(e){ console.error(e); res.status(500).json({ error: e.message }); }
});

app.use('/uploads', express.static(UPLOADS));
app.use('/thumbs', express.static(THUMBS));
app.use('/segments', express.static(SEGMENTS));
app.use('/outputs', express.static(OUTPUTS));
app.use(express.static(PUBLIC));

app.get('/health', (req,res)=> res.json({ ok:true, ts: Date.now() }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, ()=> console.log('Server running on port', PORT));
