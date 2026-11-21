const { Filesystem, FilePicker } = Capacitor.Plugins;
const ClipCutNative = Capacitor.Plugins.ClipCutNative;

const statusBox = document.getElementById('statusBox');
const langSelect = document.getElementById('langSelect');
const progressFill = document.getElementById('progressFill');
const eqVisualizer = document.getElementById('eqVisualizer');
let progressTimer = null;

function startVisualProgress(text) {
    statusBox.textContent = text;
    if (eqVisualizer) eqVisualizer.classList.add('active');
    let pct = 20;
    if (progressFill) progressFill.style.width = pct + '%';
    clearInterval(progressTimer);
    progressTimer = setInterval(() => {
        if (pct < 92) {
            pct += 4;
            if (progressFill) progressFill.style.width = pct + '%';
            statusBox.textContent = `${text} (${pct}%)`;
        }
    }, 350);
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

function getSubFolder() {
    const savedFolder = localStorage.getItem('savedFolderName');
    return savedFolder ? savedFolder.split('/').pop().replace(/[^a-zA-Z0-9_-]/g, '') : 'ClipCut';
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',').pop());
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function copyFileToNativeCache(file, tempName) {
    const base64Data = await blobToBase64(file);
    const res = await Filesystem.writeFile({
        path: tempName,
        data: base64Data,
        directory: 'CACHE'
    });
    return res.uri.replace('file://', '');
}

async function cleanNativeCache(names) {
    for (const name of names) {
        try { await Filesystem.deleteFile({ path: name, directory: 'CACHE' }); } catch (e) {}
    }
}

function parseTimeToMs(val) {
    const str = val.trim();
    if (!str.includes(':')) return Math.round((parseFloat(str) || 0) * 1000);
    const parts = str.split(':').map(Number);
    if (parts.length === 3) return ((parts[0] * 3600) + (parts[1] * 60) + parts[2]) * 1000;
    if (parts.length === 2) return ((parts[0] * 60) + parts[1]) * 1000;
    return 0;
}

// --- NAVIGARE TAB-URI & LIMBA ---
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.getAttribute('data-tab')).classList.add('active');
    });
});

langSelect.addEventListener('change', (e) => {
    updateLanguage(e.target.value);
});

document.getElementById('changeFolderBtn').addEventListener('click', async () => {
    try {
        const result = await FilePicker.pickDirectory();
        const decoded = decodeURIComponent(result.path);
        const folderName = decoded.includes("primary:") ? decoded.split("primary:").pop() : "ClipCut";
        localStorage.setItem('savedFolderName', folderName);
        alert("Noua locație memorată: Documents/ClipCut/" + folderName.split('/').pop());
    } catch (err) {
        alert("Selecție anulată.");
    }
});
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
    const startMs = parseTimeToMs(startTimeInput.value);
    const endMs = parseTimeToMs(endTimeInput.value);
    if (endMs <= startMs) { alert(translations[currentLang].alertTime); return; }

    const ext = selectedFile.name.split('.').pop().toLowerCase();
    const outExt = (ext === 'mp3') ? 'm4a' : ext;
    const tempIn = `temp_cut_in.${ext}`;

    try {
        cutBtn.disabled = true;
        startVisualProgress(translations[currentLang].processing);
        const inputPath = await copyFileToNativeCache(selectedFile, tempIn);
        const customName = (outputNameInput.value.trim() || `cut_${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_');
        const outName = `${customName}.${outExt}`;

        const res = await ClipCutNative.cutMedia({
            inputPath, startMs, endMs, outputName: outName, subFolder: getSubFolder()
        });

        stopVisualProgress(translations[currentLang].done);
        alert(`✅ Salvat nativ în:\n${res.path}`);
    } catch (err) {
        stopVisualProgress("Eroare: " + (err.message || err));
    } finally {
        await cleanNativeCache([tempIn]);
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
    const ext = mergeFile1.name.split('.').pop().toLowerCase();
    const outExt = (ext === 'mp3') ? 'm4a' : ext;
    const t1 = `temp_m1.${ext}`, t2 = `temp_m2.${ext}`;

    try {
        btn.disabled = true;
        startVisualProgress(translations[currentLang].processing);
        const path1 = await copyFileToNativeCache(mergeFile1, t1);
        const path2 = await copyFileToNativeCache(mergeFile2, t2);
        const customName = (document.getElementById('mergeOutputName').value.trim() || `unit_${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_');
        const outName = `${customName}.${outExt}`;

        const res = await ClipCutNative.mergeMedia({
            path1, path2, outputName: outName, subFolder: getSubFolder()
        });

        stopVisualProgress(translations[currentLang].done);
        alert(`✅ Salvat nativ în:\n${res.path}`);
    } catch (err) {
        stopVisualProgress("Eroare lipire: " + (err.message || err));
    } finally {
        await cleanNativeCache([t1, t2]);
        btn.disabled = false;
    }
});
// --- TAB 3: EXTRAGE AUDIO ---
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
    const tempIn = 'temp_ext_in.mp4';

    try {
        btn.disabled = true;
        startVisualProgress(translations[currentLang].processing);
        const inputPath = await copyFileToNativeCache(extractFile, tempIn);
        const customName = (document.getElementById('extractOutputName').value.trim() || `audio_${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_');
        const outName = `${customName}.m4a`;

        const res = await ClipCutNative.extractAudio({
            inputPath, outputName: outName, subFolder: getSubFolder()
        });

        stopVisualProgress(translations[currentLang].done);
        alert(`✅ Salvat nativ în:\n${res.path}`);
    } catch (err) {
        stopVisualProgress("Eroare extragere: " + (err.message || err));
    } finally {
        await cleanNativeCache([tempIn]);
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
    const aExt = muxAudio.name.split('.').pop().toLowerCase();
    const tVid = 'temp_mux_v.mp4', tAud = `temp_mux_a.${aExt}`;

    try {
        btn.disabled = true;
        startVisualProgress(translations[currentLang].processing);
        const videoPath = await copyFileToNativeCache(muxVideo, tVid);
        const audioPath = await copyFileToNativeCache(muxAudio, tAud);
        const customName = (document.getElementById('muxOutputName').value.trim() || `video_nou_${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_');
        const outName = `${customName}.mp4`;

        const res = await ClipCutNative.muxVideoAudio({
            videoPath, audioPath, outputName: outName, subFolder: getSubFolder()
        });

        stopVisualProgress(translations[currentLang].done);
        alert(`✅ Salvat nativ în:\n${res.path}`);
    } catch (err) {
        stopVisualProgress("Eroare combinare: " + (err.message || err));
    } finally {
        await cleanNativeCache([tVid, tAud]);
        btn.disabled = false;
    }
});

// --- TAB 5: SLIDESHOW NATIV FOTO + MUZICA ---
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

document.getElementById('slideBtn').addEventListener('click', async () => {
    if (slideFiles.length === 0) { alert(translations[currentLang].alertFiles); return; }
    const btn = document.getElementById('slideBtn');
    const secPerPhoto = Math.max(1, parseFloat(document.getElementById('slideDuration').value) || 3);
    const durationPerPhotoMs = Math.round(secPerPhoto * 1000);
    let tempNames = [];

    try {
        btn.disabled = true;
        startVisualProgress(translations[currentLang].processing);
        let imagePaths = [];

        for (let i = 0; i < slideFiles.length; i++) {
            const ext = slideFiles[i].name.split('.').pop().toLowerCase() || 'jpg';
            const tName = `temp_slide_${i}.${ext}`;
            tempNames.push(tName);
            const path = await copyFileToNativeCache(slideFiles[i], tName);
            imagePaths.push(path);
        }

        let audioPath = "";
        if (slideAudioFile) {
            const aExt = slideAudioFile.name.split('.').pop().toLowerCase() || 'mp3';
            const tAudio = `temp_slide_audio.${aExt}`;
            tempNames.push(tAudio);
            audioPath = await copyFileToNativeCache(slideAudioFile, tAudio);
        }

        const customName = (document.getElementById('slideOutputName').value.trim() || `colaj_${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_');
        const outName = `${customName}.mp4`;

        const res = await ClipCutNative.createSlideshow({
            imagePaths, audioPath, durationPerPhotoMs, outputName: outName, subFolder: getSubFolder()
        });

        stopVisualProgress(translations[currentLang].done);
        alert(`✅ Slideshow salvat nativ în:\n${res.path}`);
    } catch (err) {
        stopVisualProgress("Eroare slideshow: " + (err.message || err));
    } finally {
        await cleanNativeCache(tempNames);
        btn.disabled = false;
    }
});
