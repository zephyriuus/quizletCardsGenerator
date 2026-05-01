(function() {

const extractBtn = document.getElementById('extractBtn');
const copyBtn = document.getElementById('copyBtn');
const htmlInput = document.getElementById('htmlInput');
const formattedOutput = document.getElementById('formattedOutput');
const previewCards = document.getElementById('previewCards');

function extractQnA(htmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    const content = doc.querySelector('.thecontent');
    if (!content) return [];

    const blocks = content.querySelectorAll('p, h1, h2, h3, h4');

    const qaList = [];

    for (let el of blocks) {
        const strong = el.querySelector('strong');
        if (!strong) continue;

        const questionRaw = strong.textContent.trim();

        if (!/^\s*\d+[\.\)]/.test(questionRaw)) continue;

        let answerText = "";

        // --- CASE 1: UL with correct_answer ---
        let next = el.nextElementSibling;
        while (next && next.tagName !== 'UL' && next.tagName !== 'P') {
            next = next.nextElementSibling;
        }

        if (next && next.tagName === 'UL') {
            const correct = next.querySelector('li.correct_answer, li.correct');
            if (correct) {
                answerText = correct.textContent.trim();
            }
        }

        // --- CASE 2: "Correct Answer:" fallback ---
        if (!answerText) {
            let scan = el.nextElementSibling;
            let limit = 0;

            while (scan && limit < 10) {
                const text = scan.textContent;

                const match = text.match(/Correct Answer[:\s]+(.+)/i);
                if (match) {
                    answerText = match[1].trim();
                    break;
                }

                scan = scan.nextElementSibling;
                limit++;
            }
        }

        if (!answerText) continue;

        // Cleanup
        const cleanQ = questionRaw.replace(/^\d+[\.\)]\s*/, '');
        const cleanA = answerText.replace(/^[A-Z]\.\s*/, '');

        qaList.push({
            question: cleanQ,
            answer: cleanA
        });
    }

    return qaList;
}

function formatOutput(list) {
    return list.map(q => `${q.question},${q.answer}`).join(';') + ';';
}

function renderPreview(list) {
    previewCards.innerHTML = '';

    list.slice(0, 3).forEach(item => {
        const div = document.createElement('div');
        div.className = 'preview-card';
        div.innerHTML = `<strong>${item.question}</strong><br>${item.answer}`;
        previewCards.appendChild(div);
    });
}

function runExtraction() {
    const raw = htmlInput.value.trim();
    if (!raw) return;

    const qa = extractQnA(raw);

    formattedOutput.value = formatOutput(qa);
    renderPreview(qa);
}

function copyText() {
    navigator.clipboard.writeText(formattedOutput.value);
}

extractBtn.addEventListener('click', runExtraction);
copyBtn.addEventListener('click', copyText);

})();