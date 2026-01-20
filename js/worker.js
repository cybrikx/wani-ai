
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// Skip local model checks for browser
env.allowLocalModels = false;
env.useBrowserCache = true;

let generator = null;
let currentAbortController = null;

self.addEventListener('message', async (event) => {
    const { type, data } = event.data;

    if (type === 'load') {
        try {
            self.postMessage({ status: 'loading' });
            // Using the quantized model for performance
            generator = await pipeline('text-generation', 'Xenova/Qwen1.5-0.5B-Chat');
            self.postMessage({ status: 'ready' });
        } catch (e) {
            console.error(e);
            self.postMessage({ status: 'error', error: e.message });
        }
    }

    if (type === 'generate') {
        if (!generator) {
            self.postMessage({ status: 'error', error: 'Model not loaded' });
            return;
        }

        const { prompt, chatContext, userText } = data;
        let stopping = false;

        // Helper to handle "Stop" signal
        // We can't interrupt the await easily, but we can check inside the callback
        self.onmessage = (e) => {
            if (e.data.type === 'stop') stopping = true;
        };

        try {
            // ChatML Construction
            const systemMsg = "You are Wani AI, a helpful and smart assistant created by Waqar Ahmad.";
            const fullPrompt = `<|im_start|>system\n${systemMsg}<|im_end|>\n${chatContext.slice(-3).map(m => `<|im_start|>user\n${m}<|im_end|>`).join('\n')}\n<|im_start|>user\n${userText}<|im_end|>\n<|im_start|>assistant\n`;

            const output = await generator(fullPrompt, {
                max_new_tokens: 150,
                temperature: 0.7,
                do_sample: true,
                return_full_text: false,
                callback_function: (beams) => {
                    const decodedText = generator.tokenizer.decode(beams[0].output_token_ids, { skip_special_tokens: true });

                    if (stopping) {
                        throw new Error("Aborted");
                    }

                    // Send partial updates
                    // Robust stripping logic
                    let cleanText = decodedText;
                    const lastAssistantIdx = cleanText.toLowerCase().lastIndexOf("assistant");
                    if (lastAssistantIdx !== -1) {
                        cleanText = cleanText.substring(lastAssistantIdx + 9).trimStart();
                    } else if (cleanText.includes(systemMsg)) {
                        cleanText = cleanText.split(userText).pop() || "";
                    }

                    self.postMessage({ status: 'update', token: cleanText });
                }
            });

            // Final message
            let reply = output[0]?.generated_text;

            // Clean final
            const lastAssistantIdx = reply.toLowerCase().lastIndexOf("assistant");
            if (lastAssistantIdx !== -1) {
                reply = reply.substring(lastAssistantIdx + 9).trim();
            } else {
                reply = reply.replace(fullPrompt, "").replace(systemMsg, "").replace(userText, "").replace(/system|user|assistant/gi, "").trim();
            }

            self.postMessage({ status: 'complete', output: reply });

        } catch (e) {
            if (e.message === "Aborted") {
                self.postMessage({ status: 'aborted' });
            } else {
                self.postMessage({ status: 'error', error: e.message });
            }
        }
    }
});
