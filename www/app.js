const { createFFmpeg } = FFmpeg;
const baseUrl = window.location.origin;
const ffmpeg = createFFmpeg({
    log: true,
    mainName: 'main',
    corePath: `${baseUrl}/libs/ffmpeg-core.js`,
    wasmPath: `${baseUrl}/libs/ffmpeg-core.wasm`
});
const fileInput = document.getElementById('fileInput');
const fileNameDisplay = document.getElementById('fileName');
const mediaPlayer = document.getElementById('mediaPlayer');
const startTimeInput = document.getElementById('startTime');
const outputNameInput = document.getElementById('outputNameInput');
const endTimeInput = document.getElementById('endTime');
const cutBtn = document.getElementById('cutBtn');
const statusBox = document.getElementById('statusBox');
const langSelect = document.getElementById('langSelect');

let selectedFile = null;

// Schimbarea limbii
langSelect.addEventListener('change', (e) => {
    updateLanguage(e.target.value);
    if (selectedFile) {
        fileNameDisplay.textContent = translations[currentLang].selected + selectedFile.name;
    }
});

// Selectarea fisierului si incarcarea in player
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
                const baseName = selectedFile.name.replace(/\.[^/.]+$/, "");
        outputNameInput.value = `cut_${baseName}`;
        selectedFile = e.target.files.item(0);
        fileNameDisplay.textContent = translations[currentLang].selected + selectedFile.name;
        
        const fileURL = URL.createObjectURL(selectedFile);
        mediaPlayer.src = fileURL;
        mediaPlayer.style.display = 'block';
        
        cutBtn.disabled = false;
        statusBox.textContent = translations[currentLang].ready;
    }
});

// Preluarea timpului curent din player
function formatTime(sec) {
    const h = Math.floor(sec / 3600).toString().padStart(2, '0');
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

document.getElementById('setStartBtn').addEventListener('click', () => {
    startTimeInput.value = formatTime(mediaPlayer.currentTime);
});

document.getElementById('setEndBtn').addEventListener('click', () => {
    endTimeInput.value = formatTime(mediaPlayer.currentTime);
});

// Procesul de taiere
cutBtn.addEventListener('click', async () => {
    if (!selectedFile) return;
    const start = startTimeInput.value.trim();
    const end = endTimeInput.value.trim();

    if (!start || !end) {
        alert(translations[currentLang].alertTime);
        return;
    }

    try {
        cutBtn.disabled = true;
        statusBox.textContent = translations[currentLang].loadingEngine;

        if (!ffmpeg.isLoaded()) {
            await ffmpeg.load();
        }

        statusBox.textContent = translations[currentLang].processing;
        const ext = selectedFile.name.split('.').pop().toLowerCase();
        const inputName = `input.${ext}`;
                const customName = outputNameInput.value.trim() || `cut_${Date.now()}`;
        const outputName = `${customName}.${ext}`;
        const arrayBuffer = await selectedFile.arrayBuffer();
ffmpeg.FS('writeFile', inputName, new Uint8Array(arrayBuffer));
        await ffmpeg.run('-i', inputName, '-ss', start, '-to', end, '-c', 'copy', outputName);

                const data = ffmpeg.FS('readFile', outputName);
        if (data.byteLength === 0) {
            throw new Error("Fișier gol (0 bytes). Verifică intervalul!");
        }
        const mime = ext === 'mp3' ? 'audio/mpeg' : 'video/mp4';
        const blob = new Blob([data], { type: mime });
        await saveOutputFile(blob, outputName);
        ffmpeg.FS('unlink', inputName);
        ffmpeg.FS('unlink', outputName);
        statusBox.textContent = translations[currentLang].done;
    } catch (err) {
        console.error(err);
        statusBox.textContent = "Eroare: " + (err.message || err);
    } finally {
        cutBtn.disabled = false;
    }
});

// Transforma fisierul in Base64 pentru scriere nativa pe Android
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Functia de salvare in locatia aleasa de utilizator (Android APK + Fallback Web)
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
            
            // Curata numele fisierului de caractere speciale care pot bloca Android
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
