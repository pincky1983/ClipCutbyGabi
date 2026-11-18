const translations = {
    ro: {
        chooseFile: "1. Alege MP3 sau MP4",
        noFile: "Niciun fișier selectat",
        selected: "Selectat: ",
        intervalLabel: "2. Interval (secunde sau HH:MM:SS)",
        getTime: "Ia timp curent",
        cutSave: "3. Taie și Salvează",
        waiting: "Așteptare fișier...",
        ready: "Fișier pregătit. Apasă butonul verde.",
        loadingEngine: "Se încarcă motorul offline...",
        processing: "Se taie fișierul...",
        done: "Gata! Fișierul a fost salvat.",
        error: "Eroare la procesare. Verifică timpul.",
        alertTime: "Introdu timpul de început și de final!"
    },
    es: {
        chooseFile: "1. Elegir MP3 o MP4",
        noFile: "Ningún archivo seleccionado",
        selected: "Seleccionado: ",
        intervalLabel: "2. Intervalo (segundos o HH:MM:SS)",
        getTime: "Tomar tiempo",
        cutSave: "3. Cortar y Guardar",
        waiting: "Esperando archivo...",
        ready: "Archivo listo. Pulsa el botón verde.",
        loadingEngine: "Cargando motor offline...",
        processing: "Cortando archivo...",
        done: "¡Listo! Archivo guardado.",
        error: "Error al procesar. Revisa el tiempo.",
        alertTime: "¡Introduce el tiempo de inicio y fin!"
    },
    en: {
        chooseFile: "1. Choose MP3 or MP4",
        noFile: "No file selected",
        selected: "Selected: ",
        intervalLabel: "2. Interval (seconds or HH:MM:SS)",
        getTime: "Get current time",
        cutSave: "3. Cut and Save",
        waiting: "Waiting for file...",
        ready: "File ready. Press the green button.",
        loadingEngine: "Loading offline engine...",
        processing: "Cutting file...",
        done: "Done! File saved.",
        error: "Processing error. Check the time format.",
        alertTime: "Please enter start and end times!"
    }
};

let currentLang = 'ro';

function updateLanguage(lang) {
    currentLang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang][key]) {
            el.textContent = translations[lang][key];
        }
    });
}
