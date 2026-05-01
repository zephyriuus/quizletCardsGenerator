(function() {
    const extractBtn = document.getElementById('extractBtn');
    const htmlInput = document.getElementById('htmlInput');
    const resultsContainer = document.getElementById('resultsContainer');

    // Simple algorithm to extract questions + red answers
    function extractQnA(htmlString) {
        // Parse HTML string into a DOM document
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');

        const qaList = [];

        // Find all <p> elements that contain a <strong> tag (potential questions)
        const paragraphs = doc.querySelectorAll('p');

        for (let p of paragraphs) {
            const strong = p.querySelector('strong');
            if (!strong) continue;

            const questionRaw = strong.textContent.trim();
            // Heuristic: a real question usually starts with a number + dot, or at least contains a digit + dot.
            // Example: "1. What is ..." or "2. Which ..."
            if (!/^\d+\./.test(questionRaw) && !/^\d+\./.test(questionRaw.substring(0, 10))) {
                continue;
            }

            // Get next sibling element that is a <ul> (options container)
            let nextUl = p.nextElementSibling;
            // Sometimes there might be a div or spacing, but options are typically the immediate next UL
            // If not, keep looking a couple steps
            let attempts = 0;
            while (nextUl && nextUl.tagName !== 'UL' && attempts < 5) {
                nextUl = nextUl.nextElementSibling;
                attempts++;
            }
            if (!nextUl || nextUl.tagName !== 'UL') continue;

            // Find the correct answer inside this UL: class="correct_answer"
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

    // Render results in a nice div structure
    function renderResults(qaArray) {
        if (!qaArray.length) {
            resultsContainer.innerHTML = `<div class="error">⚠️ No questions found. Make sure the HTML contains <code>&lt;p&gt;&lt;strong&gt;1. ...&lt;/strong&gt;&lt;/p&gt;</code> followed by <code>&lt;ul&gt;&lt;li class="correct_answer"&gt;...&lt;/li&gt;&lt;/ul&gt;</code>.</div>`;
            return;
        }

        let html = '';
        qaArray.forEach((item, idx) => {
            html += `
                <div class="qa-card">
                    <div class="badge">Q${idx+1}</div>
                    <div class="question">📌 ${escapeHtml(item.question)}</div>
                    <div class="answer">✔️ ${escapeHtml(item.answer)}</div>
                </div>
            `;
        });
        resultsContainer.innerHTML = html;
    }

    // Helper to avoid XSS (even though we trust parsed content)
    function escapeHtml(str) {
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        }).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, function(c) {
            return c;
        });
    }

    extractBtn.addEventListener('click', () => {
        const rawHtml = htmlInput.value.trim();
        if (!rawHtml) {
            resultsContainer.innerHTML = `<div class="error">❌ Please paste some HTML code first.</div>`;
            return;
        }

        try {
            const qa = extractQnA(rawHtml);
            renderResults(qa);
        } catch (err) {
            console.error(err);
            resultsContainer.innerHTML = `<div class="error">🚫 Parsing error: ${err.message}. Make sure you pasted valid HTML.</div>`;
        }
    });

    // Optional: preload with example snippet from the given page? Not necessary, but user can paste.
})();