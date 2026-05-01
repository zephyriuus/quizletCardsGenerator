(function() {
    const extractBtn = document.getElementById('extractBtn');
    const copyBtn = document.getElementById('copyBtn');
    const htmlInput = document.getElementById('htmlInput');
    const formattedOutput = document.getElementById('formattedOutput');
    const previewCards = document.getElementById('previewCards');

    // Extract Q&A array from HTML string
    function extractQnA(htmlString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        const qaList = [];
        const paragraphs = doc.querySelectorAll('p');

        for (let p of paragraphs) {
            const strong = p.querySelector('strong');
            if (!strong) continue;
            const questionRaw = strong.textContent.trim();
            // Check if starts with number and dot (simple but robust)
            if (!/^\d+\./.test(questionRaw) && !/^\d+\./.test(questionRaw.substring(0, 10))) {
                continue;
            }

            let nextUl = p.nextElementSibling;
            let attempts = 0;
            while (nextUl && nextUl.tagName !== 'UL' && attempts < 5) {
                nextUl = nextUl.nextElementSibling;
                attempts++;
            }
            if (!nextUl || nextUl.tagName !== 'UL') continue;

            const correctLi = nextUl.querySelector('li.correct_answer');
            if (!correctLi) continue;

            const answerText = correctLi.textContent.trim();
            if (answerText === "") continue;

            qaList.push({
                question: questionRaw,
                answer: answerText
            });
        }
        return qaList;
    }

    // Format as: question,answer;question,answer;
    function formatAsCsvStyle(qaList) {
        if (qaList.length === 0) return '';
        const pairs = qaList.map(item => `${item.question},${item.answer}`);
        return pairs.join(';') + ';';
    }

    // Escape HTML for safe preview
    function escapeHtml(str) {
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    // Render preview of first 3 pairs
    function renderPreview(qaList) {
        if (!qaList.length) {
            previewCards.innerHTML = '<div class="error">No questions/answers found.</div>';
            return;
        }
        const toShow = qaList.slice(0, 3);
        let html = '';
        toShow.forEach((item, idx) => {
            html += `
                <div class="preview-card">
                    <div class="badge">Q${idx + 1}</div>
                    <strong>📌 ${escapeHtml(item.question)}</strong><br>
                    <span style="color:#2c6e2c;">✔️ ${escapeHtml(item.answer)}</span>
                </div>
            `;
        });
        if (qaList.length > 3) {
            html += `<div class="preview-card" style="background:#e9ecef;">... and ${qaList.length - 3} more</div>`;
        }
        previewCards.innerHTML = html;
    }

    // Main extraction and display
    function runExtraction() {
        const rawHtml = htmlInput.value.trim();
        if (!rawHtml) {
            formattedOutput.value = '';
            previewCards.innerHTML = '<div class="error">❌ Please paste some HTML code first.</div>';
            return;
        }

        try {
            const qa = extractQnA(rawHtml);
            const formatted = formatAsCsvStyle(qa);
            formattedOutput.value = formatted;
            renderPreview(qa);
        } catch (err) {
            console.error(err);
            formattedOutput.value = '';
            previewCards.innerHTML = `<div class="error">🚫 Parsing error: ${err.message}. Make sure you pasted valid HTML.</div>`;
        }
    }

    // Copy to clipboard
    function copyToClipboard() {
        const text = formattedOutput.value;
        if (!text) {
            alert('Nothing to copy. Please extract first.');
            return;
        }
        navigator.clipboard.writeText(text).then(() => {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✅ Copied!';
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 1500);
        }).catch(() => {
            alert('Failed to copy. You can manually select and copy.');
        });
    }

    extractBtn.addEventListener('click', runExtraction);
    copyBtn.addEventListener('click', copyToClipboard);
})();