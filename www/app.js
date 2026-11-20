const { createFFmpeg } = FFmpeg;
const baseUrl = window.location.origin;
const ffmpeg = createFFmpeg({
    log: true,
    mainName: 'main',
    corePath: `${baseUrl}/libs/ffmpeg-core.js`,
    wasmPath: `${baseUrl}/libs/ffmpeg-core.wasm`
});

const statusBox = document.getElementById('statusBox');
const langSelect = document.getElementById('langSelect');
const progressFill = document.getElementById('progressFill');
const eqVisualizer = document.getElementById('eqVisualizer');
let progressTimer = null;

function startVisualProgress(text) {
    statusBox.textContent = text;
    if (eqVisualizer) eqVisualizer.classList.add('active');
    let pct = 15;
    if (progressFill) progressFill.style.width = pct + '%';
    clearInterval(progressTimer);
    progressTimer = setInterval(() => {
        if (pct < 90) {
            pct += Math.floor(Math.random() * 6) + 2;
            if (pct > 90) pct = 90;
            if (progressFill) progressFill.style.width = pct + '%';
            statusBox.textContent = `${text} (${pct}%)`;
        }
    }, 500);
}
function stopVisualProgress(finalText) {
    clearInterval(progressTimer);
    if (progressFill) progressFill.style.width = '100%';
    if (eqVisualizer) eqVisualizer.classList.remove('active');
    statusBox.textContent = finalText;
    setTimeout(() => {
        if (progressFill) progressFill.style.width = '0%';
    }, 2500);
}
// --- NAVIGARE TAB-URI ---
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.getAttribute('data-tab')).classList.add('active');
    });
});
// --- SCHIMBARE LIMBA ---
langSelect.addEventListener('change', (e) => {
    updateLanguage(e.target.value);
});
async function ensureFFmpeg() {
    statusBox.textContent = translations[currentLang].loadingEngine;
    if (!ffmpeg.isLoaded()) await ffmpeg.load();
    startVisualProgress(translations[currentLang].processing);
}
// --- TAB 1: TAIE ---
const fileInput = document.getElementById('fileInput');
const fileNameDisplay = document.getElementById('fileName');
const mediaPlayer = document.getElementById('mediaPlayer');
const startTimeInput = document.getElementById('startTime');
const endTimeInput = document.getElementById('endTime');
const outputNameInput = document.getElementById('outputNameInput');
const cutBtn = document.getElementById('cutBtn');
let selectedFile = null;

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        selectedFile = e.target.files.item(0);
        const baseName = selectedFile.name.replace(/\.[^/.]+$/, "");
        outputNameInput.value = `cut_${baseName}`;
        fileNameDisplay.textContent = translations[currentLang].selected + selectedFile.name;
        mediaPlayer.src = URL.createObjectURL(selectedFile);
        mediaPlayer.style.display = 'block';
        cutBtn.disabled = false;
        statusBox.textContent = translations[currentLang].ready;
    }
});

function formatTime(sec) {
    const h = Math.floor(sec / 3600).toString().padStart(2, '0');
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

document.getElementById('setStartBtn').addEventListener('click', () => { startTimeInput.value = formatTime(mediaPlayer.currentTime); });
document.getElementById('setEndBtn').addEventListener('click', () => { endTimeInput.value = formatTime(mediaPlayer.currentTime); });

cutBtn.addEventListener('click', async () => {
    if (!selectedFile) return;
    const start = startTimeInput.value.trim();
    const end = endTimeInput.value.trim();
    if (!start || !end) { alert(translations[currentLang].alertTime); return; }

    try {
        cutBtn.disabled = true;
        await ensureFFmpeg();
        const ext = selectedFile.name.split('.').pop().toLowerCase();
        const inputName = `input.${ext}`;
        const customName = outputNameInput.value.trim() || `cut_${Date.now()}`;
        const outputName = `${customName}.${ext}`;

        const arrayBuffer = await selectedFile.arrayBuffer();
        ffmpeg.FS('writeFile', inputName, new Uint8Array(arrayBuffer));

        if (ext === 'mp3') {
            await ffmpeg.run('-ss', start, '-to', end, '-i', inputName, '-c', 'copy', outputName);
        } else {
            await ffmpeg.run('-ss', start, '-to', end, '-i', inputName, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-c:a', 'aac', outputName);
        }

        const data = ffmpeg.FS('readFile', outputName);
        if (data.byteLength === 0) throw new Error("Fișier gol (0 bytes).");
        const blob = new Blob([data], { type: ext === 'mp3' ? 'audio/mpeg' : 'video/mp4' });

        await saveOutputFile(blob, outputName);
        ffmpeg.FS('unlink', inputName);
        ffmpeg.FS('unlink', outputName);
       stopVisualProgress(translations[currentLang].done);
    } catch (err) {
        statusBox.textContent = "Eroare: " + (err.message || err);
    } finally {
        cutBtn.disabled = false;
    }
});
// --- TAB 2: LIPESTE ---
let mergeFile1 = null, mergeFile2 = null;
document.getElementById('mergeFile1').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        mergeFile1 = e.target.files.item(0);
        document.getElementById('mergeName1').textContent = translations[currentLang].selected + mergeFile1.name;
    }
});
document.getElementById('mergeFile2').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        mergeFile2 = e.target.files.item(0);
        document.getElementById('mergeName2').textContent = translations[currentLang].selected + mergeFile2.name;
    }
});

document.getElementById('mergeBtn').addEventListener('click', async () => {
    if (!mergeFile1 || !mergeFile2) { alert(translations[currentLang].alertFiles); return; }
    const btn = document.getElementById('mergeBtn');
    try {
        btn.disabled = true;
        await ensureFFmpeg();
        const ext = mergeFile1.name.split('.').pop().toLowerCase();
        const in1 = `part1.${ext}`, in2 = `part2.${ext}`;
        const customName = document.getElementById('mergeOutputName').value.trim() || `unit_${Date.now()}`;
        const outName = `${customName}.${ext}`;

        ffmpeg.FS('writeFile', in1, new Uint8Array(await mergeFile1.arrayBuffer()));
        ffmpeg.FS('writeFile', in2, new Uint8Array(await mergeFile2.arrayBuffer()));
        ffmpeg.FS('writeFile', 'list.txt', `file '${in1}'\nfile '${in2}'`);

        await ffmpeg.run('-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', outName);

        const data = ffmpeg.FS('readFile', outName);
        const blob = new Blob([data], { type: ext === 'mp3' ? 'audio/mpeg' : 'video/mp4' });
        await saveOutputFile(blob, outName);

        ffmpeg.FS('unlink', in1); ffmpeg.FS('unlink', in2); ffmpeg.FS('unlink', 'list.txt'); ffmpeg.FS('unlink', outName);
        stopVisualProgress(translations[currentLang].done);
    } catch (err) {
        statusBox.textContent = "Eroare lipire: " + (err.message || err);
    } finally {
        btn.disabled = false;
    }
});

// --- TAB 3: EXTRAGE MP3 ---
let extractFile = null;
document.getElementById('extractFile').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        extractFile = e.target.files.item(0);
        document.getElementById('extractName').textContent = translations[currentLang].selected + extractFile.name;
        document.getElementById('extractOutputName').value = extractFile.name.replace(/\.[^/.]+$/, "") + "_audio";
    }
});

document.getElementById('extractBtn').addEventListener('click', async () => {
    if (!extractFile) { alert(translations[currentLang].alertFiles); return; }
    const btn = document.getElementById('extractBtn');
    try {
        btn.disabled = true;
        await ensureFFmpeg();
        const customName = document.getElementById('extractOutputName').value.trim() || `audio_${Date.now()}`;
        const outName = `${customName}.mp3`;

        ffmpeg.FS('writeFile', 'vid_in.mp4', new Uint8Array(await extractFile.arrayBuffer()));
        await ffmpeg.run('-i', 'vid_in.mp4', '-vn', '-acodec', 'libmp3lame', '-q:a', '2', outName);

        const data = ffmpeg.FS('readFile', outName);
        const blob = new Blob([data], { type: 'audio/mpeg' });
        await saveOutputFile(blob, outName);

        ffmpeg.FS('unlink', 'vid_in.mp4'); ffmpeg.FS('unlink', outName);
        stopVisualProgress(translations[currentLang].done);
    } catch (err) {
        statusBox.textContent = "Eroare extragere MP3: " + (err.message || err);
    } finally {
        btn.disabled = false;
    }
});
// --- TAB 4: VIDEO + AUDIO ---
let muxVideo = null, muxAudio = null;
document.getElementById('muxVideoFile').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        muxVideo = e.target.files.item(0);
        document.getElementById('muxVideoName').textContent = translations[currentLang].selected + muxVideo.name;
    }
});
document.getElementById('muxAudioFile').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        muxAudio = e.target.files.item(0);
        document.getElementById('muxAudioName').textContent = translations[currentLang].selected + muxAudio.name;
    }
});

document.getElementById('muxBtn').addEventListener('click', async () => {
    if (!muxVideo || !muxAudio) { alert(translations[currentLang].alertFiles); return; }
    const btn = document.getElementById('muxBtn');
    try {
        btn.disabled = true;
        await ensureFFmpeg();
        const customName = document.getElementById('muxOutputName').value.trim() || `video_nou_${Date.now()}`;
        const outName = `${customName}.mp4`;

        ffmpeg.FS('writeFile', 'v_in.mp4', new Uint8Array(await muxVideo.arrayBuffer()));
        ffmpeg.FS('writeFile', 'a_in.mp3', new Uint8Array(await muxAudio.arrayBuffer()));
        await ffmpeg.run('-i', 'v_in.mp4', '-i', 'a_in.mp3', '-c:v', 'copy', '-c:a', 'aac', '-map', '0:v:0', '-map', '1:a:0', '-shortest', outName);

        const data = ffmpeg.FS('readFile', outName);
        const blob = new Blob([data], { type: 'video/mp4' });
        await saveOutputFile(blob, outName);

        ffmpeg.FS('unlink', 'v_in.mp4'); ffmpeg.FS('unlink', 'a_in.mp3'); ffmpeg.FS('unlink', outName);
        stopVisualProgress(translations[currentLang].done);
    } catch (err) {
        statusBox.textContent = "Eroare combinare: " + (err.message || err);
    } finally {
        btn.disabled = false;
    }
});

// --- SALVARE FISIER & FOLDER ---
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',').pop());
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

document.getElementById('changeFolderBtn').addEventListener('click', async () => {
    try {
        const { FilePicker } = Capacitor.Plugins;
        const result = await FilePicker.pickDirectory();
        const decoded = decodeURIComponent(result.path);
        const folderName = decoded.includes("primary:") ? decoded.split("primary:").pop() : "ClipCut";
        localStorage.setItem('savedFolderName', folderName);
        alert("Noua locație memorată: Documents/ClipCut/" + folderName.split('/').pop());
    } catch (err) {
        alert("Selecție anulată.");
    }
});

async function saveOutputFile(blob, fileName) {
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        try {
            const { Filesystem } = Capacitor.Plugins;
            const base64Data = await blobToBase64(blob);
            const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
            const savedFolder = localStorage.getItem('savedFolderName');
            const subFolder = savedFolder ? savedFolder.split('/').pop().replace(/[^a-zA-Z0-9_-]/g, '') : 'ClipCut';
            const finalPath = subFolder ? `ClipCut/${subFolder}/${cleanName}` : `ClipCut/${cleanName}`;

            await Filesystem.writeFile({
                path: finalPath,
                data: base64Data,
                directory: 'DOCUMENTS',
                recursive: true
            });

            alert(`✅ Salvat cu succes în:\nDocuments/${finalPath}`);
            return;
        } catch (err) {
            alert("Eroare salvare: " + (err.message || err));
            return;
        }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
// --- TAB 5: SLIDESHOW ANIMAT FOTO + MP3 ---
let slideFiles = [], slideAudioFile = null, slideAudioDuration = 0;

function updateAutoSlideDuration() {
    if (slideFiles.length > 0 && slideAudioDuration > 0) {
        const autoSec = (slideAudioDuration / slideFiles.length).toFixed(1);
        document.getElementById('slideDuration').value = autoSec;
    }
}

document.getElementById('slideImages').addEventListener('change', (e) => {
    slideFiles = Array.from(e.target.files);
    if (slideFiles.length > 0) {
        document.getElementById('slideImagesName').textContent = slideFiles.length + (translations[currentLang].photosSelected || " poze selectate");
        updateAutoSlideDuration();
    }
});

document.getElementById('slideAudio').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        slideAudioFile = e.target.files.item(0);
        document.getElementById('slideAudioName').textContent = translations[currentLang].selected + slideAudioFile.name;
        const tempAudio = new Audio(URL.createObjectURL(slideAudioFile));
        tempAudio.addEventListener('loadedmetadata', () => {
            slideAudioDuration = tempAudio.duration;
            updateAutoSlideDuration();
        });
    }
});
function resizeImageToJpegBytes(file) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 1280;
            canvas.height = 720;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, 1280, 720);
            const scale = Math.min(1280 / img.width, 720 / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            ctx.drawImage(img, (1280 - w) / 2, (720 - h) / 2, w, h);
                        canvas.toBlob(async (blob) => {
                resolve(new Uint8Array(await blob.arrayBuffer()));
            }, 'image/jpeg', 0.92);
        };
        img.src = URL.createObjectURL(file);
    });
}
document.getElementById('slideBtn').addEventListener('click', async () => {
    if (slideFiles.length === 0) { alert(translations[currentLang].alertFiles); return; }
    const btn = document.getElementById('slideBtn');
    const secPerPhoto = Math.max(0.5, parseFloat(document.getElementById('slideDuration').value) || 3);
    const frames = Math.round(secPerPhoto * 12);

    try {
        btn.disabled = true;
        statusBox.textContent = translations[currentLang].loadingEngine;
        if (!ffmpeg.isLoaded()) await ffmpeg.load();
        if (eqVisualizer) eqVisualizer.classList.add('active');

        const customName = document.getElementById('slideOutputName').value.trim() || `colaj_${Date.now()}`;
        const outName = `${customName}.mp4`;
                let renderedClips = [];

        for (let i = 0; i < slideFiles.length; i++) {
            if (i > 0 && i % 2 === 0) {
                try { ffmpeg.exit(); } catch (e) {}
                await ffmpeg.load();
            }
            const pct = Math.round(((i + 1) / (slideFiles.length + 1)) * 100);
            if (progressFill) progressFill.style.width = pct + '%';
            statusBox.textContent = `Poza ${i + 1} / ${slideFiles.length} (${pct}%)`;

            const imgName = `img_${i}.jpg`;
            const clipName = `clip_${i}.mp4`;
            const resizedBytes = await resizeImageToJpegBytes(slideFiles[i]);
            ffmpeg.FS('writeFile', imgName, resizedBytes);

            const zoomExpr = (i % 2 === 0)
                ? `1.0+0.20*on/${frames}`
                : `1.20-0.20*on/${frames}`;

            await ffmpeg.run(
                '-i', imgName,
                '-vf', `zoompan=z='${zoomExpr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1280x720:fps=12`,
                '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '22', '-pix_fmt', 'yuv420p', clipName
            );

            renderedClips.push(ffmpeg.FS('readFile', clipName));
            ffmpeg.FS('unlink', imgName);
            ffmpeg.FS('unlink', clipName);
        }

        statusBox.textContent = "Finalizare video & audio (95%)...";
        if (progressFill) progressFill.style.width = '95%';
        try { ffmpeg.exit(); } catch (e) {}
        await ffmpeg.load();

        let listContent = "";
        for (let i = 0; i < renderedClips.length; i++) {
            ffmpeg.FS('writeFile', `clip_${i}.mp4`, renderedClips[i]);
            listContent += `file 'clip_${i}.mp4'\n`;
        }
        ffmpeg.FS('writeFile', 'slides_list.txt', listContent);

        if (slideAudioFile) {
            ffmpeg.FS('writeFile', 'slide_bg.mp3', new Uint8Array(await slideAudioFile.arrayBuffer()));
            await ffmpeg.run('-f', 'concat', '-safe', '0', '-i', 'slides_list.txt', '-i', 'slide_bg.mp3', '-c:v', 'copy', '-c:a', 'aac', '-shortest', outName);
            ffmpeg.FS('unlink', 'slide_bg.mp3');
        } else {
            await ffmpeg.run('-f', 'concat', '-safe', '0', '-i', 'slides_list.txt', '-c:v', 'copy', outName);
        }

        const data = ffmpeg.FS('readFile', outName);
        const blob = new Blob([data], { type: 'video/mp4' });
        await saveOutputFile(blob, outName);

        for (let i = 0; i < renderedClips.length; i++) ffmpeg.FS('unlink', `clip_${i}.mp4`);
        ffmpeg.FS('unlink', 'slides_list.txt');
        ffmpeg.FS('unlink', outName);
        stopVisualProgress(translations[currentLang].done);
        stopVisualProgress("Eroare slideshow: " + (err.message || err));
    } finally {
        btn.disabled = false;
    }
});
