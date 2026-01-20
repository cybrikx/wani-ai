import { initialResponses, synonyms } from './data.js';

// --- State ---
let aiWorker = null;
let isAIReady = false;
let currentResolve = null;
let currentReject = null;
let currentStream = null;

let chatContext = loadData('chatContext', []);
let unmatchedInputs = loadData('unmatchedInputs', []);
let mode = 'chat'; // 'chat' or 'convert'
let shouldStop = false;

// --- Helpers ---

function soundex(str) {
    if (!str) return '0000';
    str = str.toLowerCase().replace(/[^a-z]/g, '');
    if (!str) return '0000';
    const charToCode = { b: '1', f: '1', p: '1', v: '1', c: '2', g: '2', j: '2', k: '2', q: '2', s: '2', x: '2', z: '2', d: '3', t: '3', l: '4', m: '5', n: '5', r: '6' };
    let soundexCode = str[0].toUpperCase();
    let previousCode = charToCode[str[0]] || '';
    for (let i = 1; i < str.length && soundexCode.length < 4; i++) {
        const currentChar = str[i];
        const currentCode = charToCode[currentChar] || '0';
        if (currentCode !== '0' && currentCode !== previousCode) {
            soundexCode += currentCode;
        }
        previousCode = currentCode;
    }
    return soundexCode.padEnd(4, '0');
}

function levenshtein(a, b) {
    const matrix = Array(b.length + 1).fill().map(() => Array(a.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
    for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
            const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + indicator);
        }
    }
    return matrix[b.length][a.length];
}

function loadData(key, defaultValue) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
        console.error(`Error loading ${key}:`, e);
        return defaultValue;
    }
}

function saveData(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error(`Error saving ${key}:`, e);
    }
}

// --- AI Initialization ---
// --- AI Initialization (Web Worker) ---
function initAI() {
    if (window.Worker) {
        aiWorker = new Worker('js/worker.js', { type: 'module' });

        aiWorker.onmessage = (e) => {
            const { status, token, output, error } = e.data;

            if (status === 'loading') console.log("Worker: Loading AI...");
            if (status === 'ready') {
                console.log("Worker: AI Ready");
                isAIReady = true;
                const indicator = document.querySelector('.typing-dot');
                if (indicator) indicator.style.background = '#00ddeb';
            }
            if (status === 'update' && currentStream) {
                currentStream(token);
            }
            if (status === 'complete' && currentResolve) {
                currentResolve(output);
                cleanupRequest();
            }
            if ((status === 'error' || status === 'aborted') && currentReject) {
                currentReject(new Error(status === 'aborted' ? "Aborted" : error));
                cleanupRequest();
            }
        };

        aiWorker.postMessage({ type: 'load' });
    } else {
        console.error("Web Workers not supported");
    }
}

function cleanupRequest() {
    currentResolve = null;
    currentReject = null;
    currentStream = null;
}

// Start loading immediately
initAI();

// --- Core Logic ---

async function getChatResponse(userText, onStream) {
    // 1. Pre-process text
    const cleaning = userText.replace(/[^\w\s?]/g, '').toLowerCase().trim();
    if (!cleaning) return "I didn't catch that.";

    let normalizedText = cleaning;

    // 2. Synonyms substitution
    for (const [key, syns] of Object.entries(synonyms)) {
        const patterns = syns.map(s => `\\b${s}\\b`).join('|');
        if (new RegExp(patterns, 'i').test(normalizedText)) {
            normalizedText = normalizedText.replace(new RegExp(patterns, 'gi'), key);
        }
    }

    const normalizedTokens = normalizedText.split(/\s+/).filter(t => t.length > 1);

    // 3. Check Hardcoded Responses
    // IMPORANT: If the user types a long sentence (more than 5 tokens), we assume they want the AI, 
    // unless it's a specific long exact match.
    // If input is long, we skip the hardcoded check to avoid false positives (e.g. "write email about okay")

    let bestTrigger = null;
    let maxScore = 0;

    if (normalizedTokens.length <= 5 || !isAIReady) {
        const soundexCache = {};
        const inputSoundex = soundex(normalizedText);

        Object.keys(initialResponses).forEach(pattern => {
            if (pattern === 'default') return;

            let score = 0;
            const patternWords = pattern.split(' ');

            const isExactMatch = normalizedText === pattern;
            if (isExactMatch) score += 10;

            const isWordMatch = new RegExp(`\\b${pattern}\\b`, 'i').test(normalizedText);
            if (isWordMatch) score += 5;

            const distance = levenshtein(normalizedText, pattern);
            if (distance <= 2 && pattern.length > 3) score += 3;

            if (chatContext.slice(-3).some(ctx => ctx.includes(pattern))) score += 1;

            // Boost score for short slang if exact match to prevent AI fallback
            if (normalizedText.length <= 5 && isExactMatch) score += 20;

            if (score > maxScore) {
                maxScore = score;
                bestTrigger = pattern;
            }
        });
    }

    // 4. Return Hardcoded
    if (bestTrigger && maxScore >= 5) {
        const options = initialResponses[bestTrigger];
        const reply = options[Math.floor(Math.random() * options.length)];
        // Simulate streaming for hardcoded response
        if (onStream) {
            const chunks = reply.split(' ');
            for (let i = 0; i < chunks.length; i++) {
                onStream(chunks.slice(0, i + 1).join(' '));
                await new Promise(r => setTimeout(r, 50)); // typing effect
            }
        }
        return reply;
    }

    // 5. AI Fallback with Real "Thinking" (Streaming)
    // 5. AI Fallback (Web Worker)
    if (isAIReady && aiWorker) {
        return new Promise((resolve, reject) => {
            currentResolve = resolve;
            currentReject = reject;
            currentStream = onStream;

            aiWorker.postMessage({
                type: 'generate',
                data: { userText, chatContext }
            });
        });
    } else {
        return "Thinking... (AI is warming up)";
    }
}

// --- IP Converter Logic ---
function convertIP(inputValue) {
    const value = inputValue.trim();
    if (/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(value)) {
        // IP to Binary
        return value.split('.').map(octet => parseInt(octet).toString(2).padStart(8, '0')).join('.');
    } else if (/^([0-1]{8}\.){3}[0-1]{8}$/.test(value)) {
        // Binary to IP
        return value.split('.').map(octet => parseInt(octet, 2)).join('.');
    } else {
        return "That doesn't look like a valid IP or Binary IP string to me.";
    }
}

// --- UI Interaction ---

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('input');
    const sendBtn = document.getElementById('sendBtn');
    const outputArea = document.getElementById('outputArea');
    const typingIndicator = document.getElementById('typingIndicator');
    const chatModeBtn = document.getElementById('chatModeBtn');
    const convertModeBtn = document.getElementById('convertModeBtn');
    const menuBtn = document.getElementById('menuBtn');
    const menu = document.getElementById('menu');

    const micBtn = document.getElementById('micBtn');

    // Init History
    loadChatHistory();

    // Event Listeners
    sendBtn.addEventListener('click', handleInput);
    input.addEventListener('keypress', (e) => {
        // Prevent sending (or accidentally stopping) via Enter key if already active
        if (e.key === 'Enter' && !isGenerating) handleInput();
    });

    chatModeBtn.addEventListener('click', () => setMode('chat'));
    convertModeBtn.addEventListener('click', () => setMode('convert'));

    menuBtn.addEventListener('click', toggleMenu);

    // Voice Logic
    setupVoice();

    // Service Worker Registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW registered', reg))
            .catch(err => console.error('SW failed', err));
    }

    function setupVoice() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            micBtn.style.display = 'none';
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;

        micBtn.addEventListener('click', () => {
            if (micBtn.classList.contains('listening')) {
                recognition.stop();
            } else {
                recognition.start();
                micBtn.classList.add('listening');
                input.placeholder = "Listening...";
            }
        });

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            input.value = transcript;
            micBtn.classList.remove('listening');
            input.placeholder = "Ask me anything...";
            handleInput(); // Auto send
        };

        recognition.onerror = () => {
            micBtn.classList.remove('listening');
            input.placeholder = "Ask me anything...";
        };

        recognition.onend = () => {
            micBtn.classList.remove('listening');
            input.placeholder = "Ask me anything...";
        };
    }

    function speak(text) {
        if (!window.speechSynthesis) return;
        const utterance = new SpeechSynthesisUtterance(text);
        // Find a decent voice
        const voices = speechSynthesis.getVoices();
        const preferred = voices.find(v => v.name.includes('Google') || v.name.includes('Samantha'));
        if (preferred) utterance.voice = preferred;
        utterance.rate = 1.1;
        speechSynthesis.speak(utterance);
    }

    // Global functions for menu links (which use onclick in HTML)
    window.clearChatHistory = (e) => {
        e.preventDefault();
        saveData('chatHistory', []);
        outputArea.innerHTML = '';
        toggleMenu();
    };

    window.downloadWebsite = (e) => {
        // ... (Keep existing download logic or simplify it) ... 
        // For now, let's keep it simple or remove it if user didn't ask explicitly. 
        // User asked for "more", so keeping "Download" is good.
        e.preventDefault();
        alert("Download feature coming soon in the new modular version!");
        toggleMenu();
    };

    function setMode(newMode) {
        mode = newMode;
        if (mode === 'chat') {
            chatModeBtn.classList.add('active');
            convertModeBtn.classList.remove('active');
            input.placeholder = "Ask me anything...";
        } else {
            convertModeBtn.classList.add('active');
            chatModeBtn.classList.remove('active');
            input.placeholder = "Enter IP (192.168...) or Binary (110000...)";
        }
    }

    function toggleMenu() {
        menuBtn.classList.toggle('active');
        menu.classList.toggle('active');
    }

    let isGenerating = false;

    function updateButtonState(state) {
        if (state === 'stop') {
            // Square Stop Icon
            sendBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="7" width="10" height="10" rx="1.5"></rect></svg>';
            sendBtn.classList.add('stop-btn');
        } else {
            // Paper Plane Send Icon
            sendBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>';
            sendBtn.classList.remove('stop-btn');
        }
    }

    async function handleInput() {
        // Safety: If UI shows "Send" (no stop-btn) but state is stuck on "Generating", force reset.
        if (isGenerating && !sendBtn.classList.contains('stop-btn')) {
            isGenerating = false;
        }

        // If already generating, this click acts as a "Stop" signal
        if (isGenerating) {
            shouldStop = true;
            if (aiWorker) aiWorker.postMessage({ type: 'stop' }); // Send stop signal to worker
            return;
        }

        const text = input.value.trim();
        if (!text) return;

        isGenerating = true;
        shouldStop = false;
        updateButtonState('stop');

        // Add User Message
        addMessage(text, 'user');
        input.value = '';
        saveChatHistory('user', text, mode);

        try {
            if (mode === 'chat') {
                // Show Typing Indicator
                typingIndicator.classList.add('active');
                scrollToBottom();

                // Yield to UI (Wait for paint) to prevent "stuck" feeling
                await new Promise(r => setTimeout(r, 100));

                // Prepare unique ID for bot message to update it
                const msgDiv = document.createElement('div');
                msgDiv.className = `message bot-message`;
                msgDiv.innerHTML = `
                    <div class="message-content">
                        <div class="bot-avatar"></div>
                        <div class="message-text">...</div>
                    </div>
                `;
                outputArea.appendChild(msgDiv);
                const msgText = msgDiv.querySelector('.message-text');

                // Get Response with Streaming
                let fullResponse = "";
                try {
                    fullResponse = await getChatResponse(text, (chunk) => {
                        msgText.innerHTML = marked.parse(chunk || "...");
                        scrollToBottom();
                    });
                } catch (err) {
                    if (err.message === "Aborted") {
                        fullResponse = msgText.innerText; // Keep whatever we have
                        // Optional: Add a [Stopped] indicator
                    } else {
                        throw err;
                    }
                }

                // Final Polish
                msgText.innerHTML = marked.parse(fullResponse || "I am silent.");
                saveChatHistory('bot', fullResponse, mode);

                // Speak response (if brief and not stopped halfway)
                if (!shouldStop && fullResponse.length < 200) speak(fullResponse);

                // Context Update
                chatContext.push(text.toLowerCase());
                if (chatContext.length > 5) chatContext.shift();
                saveData('chatContext', chatContext);

            } else {
                // Converter Mode (Instant)
                const result = convertIP(text);
                addMessage(result, 'bot');
                saveChatHistory('bot', result, mode);
            }
        } catch (e) {
            if (e.message !== "Aborted") {
                console.error("Chat Error", e);
                addMessage("Error: Something went wrong.", 'bot');
            }
        } finally {
            // RELEASE THE LOCK FIRST
            isGenerating = false;
            shouldStop = false;

            // Then update UI
            try { typingIndicator.classList.remove('active'); } catch (e) { }
            try { updateButtonState('send'); } catch (e) { }
            try { scrollToBottom(); } catch (e) { }
            try { input.focus(); } catch (e) { }
        }
    }

    function addMessage(text, sender) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}-message`;

        if (sender === 'bot') {
            msgDiv.innerHTML = `
                <div class="message-content">
                    <div class="bot-avatar"></div>
                    <div class="message-text">${text}</div>
                </div>
            `;
        } else {
            msgDiv.textContent = text;
        }

        outputArea.appendChild(msgDiv);
    }

    function scrollToBottom() {
        outputArea.scrollTop = outputArea.scrollHeight;
    }

    function loadChatHistory() {
        const history = loadData('chatHistory', []);
        history.forEach(item => addMessage(item.content, item.type));
        scrollToBottom();
    }

    function saveChatHistory(type, content, currentMode) {
        const history = loadData('chatHistory', []);
        history.push({ type, content, mode: currentMode, timestamp: new Date().toISOString() });
        saveData('chatHistory', history);
    }
});
