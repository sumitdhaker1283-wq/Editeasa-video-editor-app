const srvStatus = document.getElementById('srvStatus');
fetch('/health').then(r=>r.json()).then(j=> srvStatus.textContent = 'Server: OK').catch(e=> srvStatus.textContent = 'Server: Offline');

const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const thumbBtn = document.getElementById('thumbBtn');
const thumbCount = document.getElementById('thumbCount');
const video = document.getElementById('video');
const thumbs = document.getElementById('thumbs');
const segmentsList = document.getElementById('segmentsList');
const splitList = document.getElementById('splitList');
const tracksEl = document.getElementById('tracks');
const addTrackBtn = document.getElementById('addTrackBtn');

let uploadedFilename = null;
let splitTimes = [];
let trackCount = 0;

uploadBtn.addEventListener('click', async ()=>{
  const f = fileInput.files[0];
  if(!f) return alert('Choose a file first');
  const fd = new FormData(); fd.append('file', f);
  uploadBtn.textContent = 'Uploading...';
  try{
    const res = await fetch('/upload', { method:'POST', body: fd });
    const j = await res.json();
    if(j.error) return alert('Upload error: '+j.error);
    uploadedFilename = j.filename;
    video.src = j.url;
    video.load();
    uploadBtn.textContent = 'Upload';
    alert('Uploaded: ' + uploadedFilename);
  }catch(e){ uploadBtn.textContent='Upload'; alert('Upload failed: '+e.message); }
});

thumbBtn.addEventListener('click', async ()=>{
  if(!uploadedFilename) return alert('Upload first');
  thumbs.innerHTML='Generating...';
  try{
    const res = await fetch('/thumbnails', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ filename: uploadedFilename, count: parseInt(thumbCount.value||16) }) });
    const j = await res.json();
    if(j.error) return alert('Thumbs error: '+j.error);
    thumbs.innerHTML='';
    for(const t of j.thumbs || []){
      const img = document.createElement('img'); img.src = t; img.className='thumb'; thumbs.appendChild(img);
    }
  }catch(e){ thumbs.innerHTML=''; alert('Thumbs failed: '+e.message); }
});

addTrackBtn.addEventListener('click', ()=>{
  trackCount++;
  const div = document.createElement('div');
  div.className='track';
  div.innerHTML = `<div>Track ${trackCount}</div><div><button class="btn small" onclick="removeTrack(this)">Remove</button></div>`;
  tracksEl.appendChild(div);
});
window.removeTrack = function(btn){ btn.closest('.track').remove(); };

document.getElementById('video').addEventListener('timeupdate', ()=>{
  const cur = Math.floor(video.currentTime);
  const tot = Math.floor(video.duration||0);
  document.getElementById('timeInfo').textContent = cur + ':' + ('0'+(Math.floor(video.currentTime)%60)).slice(-2) + ' / ' + tot + ':' + ('0'+(Math.floor(video.duration||0)%60)).slice(-2);
});

window.addEventListener('keydown', (e)=>{
  if(e.key===' '){ if(video.paused) video.play(); else video.pause(); e.preventDefault(); }
});
