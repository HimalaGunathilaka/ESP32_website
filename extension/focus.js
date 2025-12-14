 // Retrieve and display total focus time
        chrome.storage.local.get(['totalFocusTime'], (result) => {
            const totalSeconds = result.totalFocusTime || 0;
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            const timeString = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
            document.getElementById('totalTime').textContent = timeString;
        });