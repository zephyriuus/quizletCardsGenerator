(function() {
    const htmlInput = document.getElementById('htmlInput');
    const previewCards = document.getElementById('previewCards');
    const qaSepInput = document.getElementById('qaSep');
    const pairSepInput = document.getElementById('pairSep');
    const cardsListContainer = document.getElementById('cardsListContainer');
    const cardsCounterSpan = document.getElementById('cardsCounter');

    qaSepInput.value = "\t";
    pairSepInput.value = "\n";

    let currentCards = [];
    let checkedState = [];

    // strips leading numbers from text
    function stripNumberFromQuestion(text) {
        if (!text) return text;
        return text.replace(/^\d+\.\s*/, '');
    }

    // formats multiple answers
    function formatMultipleAnswers(answerArray) {
        if (!answerArray.length) return '';
        if (answerArray.length === 1) return answerArray[0];
        return answerArray.map(ans => `- ${ans.trim()}`).join('\n');
    }

    // transforms the q&as into decks
    function extractCardsFromHtml(htmlString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        const allCards = [];
        const paragraphs = doc.querySelectorAll('p');
        
        for (let p of paragraphs) {
            const strong = p.querySelector('strong');
            if (!strong) continue;
            let questionRaw = strong.textContent.trim();
            // detects questions by checking the number
            if (!/^\d+\./.test(questionRaw) && !/^\d+\./.test(questionRaw.substring(0, 10))) continue;
            
            const questionLower = questionRaw.toLowerCase();
            const isMatchQuestion = questionLower.includes('match the');
            
            if (isMatchQuestion) {
                // locates matching type questions and divides cards by table column in html code
                let matchTable = null;
                let currentElem = p.nextElementSibling;
                let searchDepth = 0;
                const maxDepth = 15;
                while (currentElem && searchDepth < maxDepth && !matchTable) {
                    //looks for a table
                    if (currentElem.tagName === 'TABLE') {
                        matchTable = currentElem;
                        break;
                    }
                    if (currentElem.querySelector) {
                        const tableInside = currentElem.querySelector('table');
                        if (tableInside) {
                            matchTable = tableInside;
                            break;
                        }
                        
                        const msgBox = currentElem.classList && (currentElem.classList.contains('message_box') || currentElem.classList.contains('success'));
                        if (msgBox) {
                            const tbl = currentElem.querySelector('table');
                            if (tbl) { matchTable = tbl; break; }
                        }
                    }
                    currentElem = currentElem.nextElementSibling;
                    searchDepth++;
                }
                
                if (matchTable) {
                    //extracts rows from the table
                    const rows = matchTable.querySelectorAll('tbody tr');
                    let pairCount = 0;
                    for (let row of rows) {
                        const cells = row.querySelectorAll('td');
                        if (cells.length >= 2) {
                            const term = cells[0].textContent.trim();
                            const description = cells[1].textContent.trim();
                            if (term && description) {
                                // creates the card
                                allCards.push({
                                    question: description,   // front
                                    answer: term,            // back
                                    type: 'match'
                                });
                                pairCount++;
                            }
                        }
                    }
                    //continues if there are more rows found
                    if (pairCount > 0) continue;
                }
                
                //if no tables found
                let fallbackText = "";
                let sibling = p.nextElementSibling;
                let fallbackDepth = 0;
                while (sibling && fallbackDepth < 8) {
                    if (sibling.textContent) fallbackText += " " + sibling.textContent;
                    sibling = sibling.nextElementSibling;
                    fallbackDepth++;
                }
                if (fallbackText.trim()) {
                    const lines = fallbackText.split(/\r?\n/);
                    for (let line of lines) {
                        if (line.includes('\t')) {
                            const parts = line.split('\t');
                            if (parts.length >= 2) {
                                allCards.push({ question: parts[1].trim(), answer: parts[0].trim(), type: 'match' });
                            }
                        }
                    }
                }
                if (allCards.length === 0) {
                    allCards.push({ question: questionRaw, answer: "(Match table not detected) " + fallbackText.substring(0, 200), type: 'extracted' });
                }
            }
            else {
                let nextUl = p.nextElementSibling;
                let attempts = 0;
                while (nextUl && nextUl.tagName !== 'UL' && attempts < 6) {
                    nextUl = nextUl.nextElementSibling;
                    attempts++;
                }
                if (!nextUl || nextUl.tagName !== 'UL') continue;
                
                const correctItems = nextUl.querySelectorAll('li.correct_answer');
                if (correctItems.length === 0) continue;
                
                const answerTexts = [];
                for (let li of correctItems) {
                    let ans = li.textContent.trim();
                    if (ans) answerTexts.push(ans);
                }
                if (answerTexts.length === 0) continue;
                
                let finalAnswer = answerTexts.length === 1 ? answerTexts[0] : formatMultipleAnswers(answerTexts);
                allCards.push({
                    question: questionRaw,
                    answer: finalAnswer,
                    type: 'extracted'
                });
            }
        }
        return allCards;
    }

    function renderCardsList() {
        if (!cardsListContainer) return;
        if (!currentCards.length) {
            cardsListContainer.innerHTML = '<div class="error" style="margin:10px;">No cards found</div>';
            cardsCounterSpan.innerText = `0 cards`;
            return;
        }
        let html = '';
        currentCards.forEach((card, idx) => {
            const isChecked = checkedState[idx] === true;
            const cleanQ = stripNumberFromQuestion(card.question);
            let typeBadge = '';
            if (card.type === 'match') typeBadge = '<span class="badge-match">matching type</span>';
            
            let answerHtml = '';
            if (card.answer.includes('\n-')) {
                const lines = card.answer.split('\n').filter(l => l.trim().startsWith('-'));
                if (lines.length) {
                    answerHtml = '<ul style="margin:4px 0 0 18px; padding-left:0;">';
                    lines.forEach(line => {
                        let text = line.replace(/^-\s*/, '');
                        answerHtml += `<li style="margin:2px 0;">${escapeHtml(text)}</li>`;
                    });
                    answerHtml += '</ul>';
                } else {
                    answerHtml = `<div>${escapeHtml(card.answer)}</div>`;
                }
            } else {
                answerHtml = `<div>${escapeHtml(card.answer)}</div>`;
            }
            
            html += `
                <div class="card-item">
                    <input type="checkbox" class="card-check" data-idx="${idx}" ${isChecked ? 'checked' : ''}>
                    <div class="card-content">
                        <h4>Front: </h4>
                        <div class="card-question">${escapeHtml(cleanQ)} ${typeBadge}</div>
                        <h4>Back: </h4>
                        <div class="card-answer">${answerHtml}</div>
                    </div>
                </div>
            `;
        });
        cardsListContainer.innerHTML = html;
        cardsCounterSpan.innerText = `${currentCards.length} card${currentCards.length !== 1 ? 's' : ''}`;
    }
    
    function setNewCards(cardsArray) {
        currentCards = cardsArray.map((card, idx) => ({
            id: idx + Date.now() + Math.random(),
            question: card.question,
            answer: card.answer,
            type: card.type || 'extracted'
        }));
        checkedState = new Array(currentCards.length).fill(true);
        renderCardsList();
        generateSelectedOutput();
    }
    
    function generateSelectedOutput() {
        const qaSep = qaSepInput.value || ',';
        const pairSep = pairSepInput.value || ';';
        const selected = [];
        for (let i = 0; i < currentCards.length; i++) {
            if (checkedState[i]) selected.push(currentCards[i]);
        }
        if (selected.length === 0) {
            formattedOutput.value = '';
            return '';
        }
        const pairs = selected.map(card => {
            let cleanQuestion = stripNumberFromQuestion(card.question);
            if (!cleanQuestion) cleanQuestion = card.question;
            return `${cleanQuestion}${qaSep}${card.answer}`;
        });
        const out = pairs.join(pairSep);
        formattedOutput.value = out;
        return out;
    }
    
    function runExtraction() {
        const rawHtml = htmlInput.value.trim();
        if (!rawHtml) {
            alert("Please paste HTML source code.");
            return;
        }
        try {
            const extracted = extractCardsFromHtml(rawHtml);
            if (extracted.length === 0) {
                cardsListContainer.innerHTML = '<div class="error">No valid Q&A found. Ensure HTML contains numbered questions</div>';
                formattedOutput.value = '';
                currentCards = [];
                checkedState = [];
                renderCardsList();
                return;
            }
            setNewCards(extracted);
        } catch (err) {
            console.error(err);
            cardsListContainer.innerHTML = `<div class="error">Parsing error: ${escapeHtml(err.message)}</div>`;
        }
    }
    
    
    function selectAll() { for (let i=0;i<checkedState.length;i++) checkedState[i]=true; renderCardsList(); generateSelectedOutput(); }
    function deselectAll() { for (let i=0;i<checkedState.length;i++) checkedState[i]=false; renderCardsList(); generateSelectedOutput(); }
    
    function attachCheckboxListener() {
        cardsListContainer.addEventListener('change', (e) => {
            if (e.target.classList.contains('card-check')) {
                const idx = parseInt(e.target.getAttribute('data-idx'), 10);
                if (!isNaN(idx) && checkedState[idx] !== undefined) {
                    checkedState[idx] = e.target.checked;
                    generateSelectedOutput();
                }
            }
        });
    }

    extractBtn.onclick = runExtraction;
    resetExtractOnly.onclick = resetToExtracted;
    exportSelectedBtn.onclick = () => { const out = generateSelectedOutput(); if(!out) alert("No cards selected."); };
    selectAllBtn.onclick = selectAll;
    deselectAllBtn.onclick = deselectAll;
    addCustomCardBtn.onclick = addCustom;
    attachCheckboxListener();
    
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }
    
    currentCards = [];
    checkedState = [];
    renderCardsList();
    formattedOutput.value = '';

})();