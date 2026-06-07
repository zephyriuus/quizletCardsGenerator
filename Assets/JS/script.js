(function() {
    const extractBtn = document.getElementById('extractBtn');
    const htmlInput = document.getElementById('htmlInput');
    const formattedOutput = document.getElementById('formattedOutput');
    const previewCards = document.getElementById('previewCards');
    const qaSepInput = document.getElementById('qaSep');
    const pairSepInput = document.getElementById('pairSep');

    qaSepInput.value = "\t";
    pairSepInput.value = "\n";

    // Core extraction: returns array of {question, answer}
    function extractQnA(htmlString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        const qaList = [];
        const paragraphs = doc.querySelectorAll('p');

        for (let p of paragraphs) {
            const strong = p.querySelector('strong');
            if (!strong) continue;
            const questionRaw = strong.textContent.trim();
            // Must start with a number and a dot (e.g., "1.", "2.")
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

    // Format with custom separators (no trailing separator)
    function formatCustom(qaList, qaSep, pairSep) {
        if (qaList.length === 0) return '';
        const pairs = qaList.map(item => `${item.question}${qaSep}${item.answer}`);
        return pairs.join(pairSep);   // ← FIXED: added return
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

    // Show preview of first 3 Q&A pairs
    function renderPreview(qaList) {
        if (!qaList.length) {
            previewCards.innerHTML = '<div class="error">No questions/answers found. Make sure you pasted HTML with questions and correct_answer class.</div>';
            return;
        }
        const toShow = qaList.slice(0, 3);
        let html = '';
        toShow.forEach((item, idx) => {
            html += `
                <div class="preview-card">
                    <div class="badge">Q${idx + 1}</div>
                    <strong>${escapeHtml(item.question)}</strong><br>
                    <span style="color:#2c6e2c;">${escapeHtml(item.answer)}</span>
                </div>
            `;
        });
        if (qaList.length > 3) {
            html += `<div class="preview-card" style="background:#e9ecef;">... and ${qaList.length - 3} more pairs</div>`;
        }
        previewCards.innerHTML = html;
    }

    // Main extraction and display
    function runExtraction() {
        const rawHtml = htmlInput.value.trim();
        if (!rawHtml) {
            formattedOutput.value = '';
            previewCards.innerHTML = '<div class="error">Please paste some HTML code first.</div>';
            return;
        }

        try {
            const qa = extractQnA(rawHtml);
            const qaSep = qaSepInput.value || ',';
            const pairSep = pairSepInput.value || ';';
            const formatted = formatCustom(qa, qaSep, pairSep);
            formattedOutput.value = formatted;
            renderPreview(qa);
        } catch (err) {
            console.error(err);
            formattedOutput.value = '';
            previewCards.innerHTML = `<div class="error">Parsing error: ${err.message}. Make sure you pasted valid HTML.</div>`;
        }
    }

    extractBtn.addEventListener('click', runExtraction);
})();