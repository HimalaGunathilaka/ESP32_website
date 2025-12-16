let focusMode = false;

function focus() {
    const btn = document.getElementById('focusBtn');
    if (focusMode) {
        focusMode = false;
        console.log("Deactivate from popup.js")
        btn.classList.remove('active');
        chrome.storage.local.set({ focusMode: false })
    } else {
        focusMode = true;
        console.log("Activate from popup.js")
        btn.classList.add('active');
        chrome.storage.local.set({ focusMode: true })
    }
}

document.getElementById('focusBtn').addEventListener('click', focus);