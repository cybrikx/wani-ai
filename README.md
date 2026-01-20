# Wani AI 🌐

**Wani AI** is a cutting-edge, **Serverless AI Chatbot** that runs entirely inside your web browser. 
It combines instant hardcoded knowledge with a real **Large Language Model (LLM)** for deep reasoning—all without sending your data to any cloud server.

`👉 Live Demo:` [cybrikx.github.io/wani-ai](https://cybrikx.github.io/wani-ai/)

---

## 🧠 How It Works (The "Magic")

1.  **Hybrid Intelligence**:
    *   **Tier 1 (Instant):** For common questions ("What is TCP?", "Hi", "hhh"), it uses a lightning-fast local database (`js/data.js`).
    *   **Tier 2 (Deep AI):** For complex tasks ("Write a poem", "Explain quantum physics"), it loads a real AI Brain (`Qwen1.5-0.5B-Chat`) directly into your browser using **WebAssembly**.

2.  **Where is the Data?** 
    *   The model weights (approx 300MB) are downloaded **from Hugging Face** the first time you visit.
    *   After that, they are **cached** in your browser. You can go offline and it will still work!
    *   **Privacy:** No messages leave your device. You are the server.

3.  **Why is it Slow?** 🐢 vs 🐇
    *   **ChatGPT**: Sends your text to a Supercomputer ($10,000 GPUs) in a datacenter. Fast, but relies on internet.
    *   **Wani AI**: Runs on **YOUR Device's CPU**. It requires billions of calculations per second. It's slower because it's doing heavy math right on your laptop/phone, but it's **100% Free, Private, and Offline-Capable**.

---

## Features ✨

*   **🎙️ Voice Interaction**: Talk to Wani and hear it speak back (Iron Man style).
*   **⏹️ Smart Controls**: Stop generation anytime. Prevents freezing using **Web Workers**.
*   **📡 IP Converter**: Professional tool to convert IPs to Binary and back.
*   **📱 PWA Ready**: Install it as a native app on iOS/Android/PC.
*   **🔌 Offline Mode**: Works without WiFi (Service Worker enabled).
*   **🎨 Glassmorphism UI**: Beautiful, modern dark UI with neon accents.

## Installation 🚀

Run it locally in seconds:

1.  **Clone the Repo**:
    ```bash
    git clone https://github.com/cybrikx/wani-ai.git
    cd wani-ai
    ```

2.  **Run a Local Server** (Browsers block Workers on file://):
    *   VS Code: Right-click `index.html` -> **Open with Live Server**.
    *   Python: `python3 -m http.server`
    *   Node: `npx serve`

3.  **Open Browser**: Go to `http://localhost:8000` (or displayed port).

## Project Structure 📂

*   `index.html`: The main UI.
*   `css/style.css`: All the fancy styling.
*   `js/script.js`: UI logic (buttons, voice, chat handling).
*   `js/worker.js`: **The AI Brain**. Runs in a background thread to keep valid UI.
*   `js/data.js`: Instant answers & synonyms.

## Contributing 🤝

We love upgrading the brain! 
*   **Add Knowledge**: Edit `js/data.js` to add more instant answers.
*   **Improve UI**: CSS PRs are welcome.

## License 📜

Released under the **MIT License**. Free for everyone.

## Credit 🌟

Created with passion by **Waqar Ahmad** (`@waqarro1`).
Powered by [Transformers.js](https://huggingface.co/docs/transformers.js) & [Xenova](https://github.com/xenova).

