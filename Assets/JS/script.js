(function() {
    // DOM elements
    const htmlInput = document.getElementById('htmlInput');
    const formattedOutput = document.getElementById('formattedOutput');
    const qaSepInput = document.getElementById('qaSep');
    const pairSepInput = document.getElementById('pairSep');
    const cardsListContainer = document.getElementById('cardsListContainer');
    const cardsCounterSpan = document.getElementById('cardsCounter');
    const extractBtn = document.getElementById('extractBtn');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const deselectAllBtn = document.getElementById('deselectAllBtn');
    const toggleHideBtn = document.getElementById('toggleHideBtn');
    const hideStatusLabel = document.getElementById('hideStatusLabel');
    const copyAllBtn = document.getElementById('copyAllBtn');

    // State
    let currentCards = [];        // array of card objects { id, question, answer, type }
    let checkedState = [];        // boolean array parallel to currentCards
    let hideUncheckedActive = false;   // toggle state

    // Helper: generate unique id
    function generateId() {
        return Date.now() + '-' + Math.random().toString(36).substring(2, 8);
    }

    // Strip leading numbers from question
    function stripNumberFromQuestion(text) {
        if (!text) return text;
        return text.replace(/^\d+\.\s*/, '');
    }

    function formatMultipleAnswers(answerArray) {
        if (!answerArray.length) return '';
        if (answerArray.length === 1) return answerArray[0];
        return answerArray.map(ans => `- ${ans.trim()}`).join('; ');
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    // Extract cards from HTML (robust)
    function extractCardsFromHtml(htmlString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        const allCards = [];
        const paragraphs = doc.querySelectorAll('p');
        
        for (let p of paragraphs) {
            const strong = p.querySelector('strong');
            if (!strong) continue;
            let questionRaw = strong.textContent.trim();
            if (!/^\d+\./.test(questionRaw) && !/^\d+\./.test(questionRaw.substring(0, 10))) continue;
            
            const questionLower = questionRaw.toLowerCase();
            const isMatchQuestion = questionLower.includes('match the');
            
            if (isMatchQuestion) {
                let matchTable = null;
                let currentElem = p.nextElementSibling;
                let searchDepth = 0;
                while (currentElem && searchDepth < 15 && !matchTable) {
                    if (currentElem.tagName === 'TABLE') {
                        matchTable = currentElem;
                        break;
                    }
                    if (currentElem.querySelector) {
                        const tableInside = currentElem.querySelector('table');
                        if (tableInside) { matchTable = tableInside; break; }
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
                    const rows = matchTable.querySelectorAll('tbody tr');
                    let pairCount = 0;
                    for (let row of rows) {
                        const cells = row.querySelectorAll('td');
                        if (cells.length >= 2) {
                            const term = cells[0].textContent.trim();
                            const description = cells[1].textContent.trim();
                            if (term && description) {
                                allCards.push({
                                    question: description,
                                    answer: term,
                                    type: 'match'
                                });
                                pairCount++;
                            }
                        }
                    }
                    if (pairCount > 0) continue;
                }
                
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

    // Render cards based on hideUncheckedActive flag
    function renderCardsList() {
        if (!cardsListContainer) return;
        // Determine visible indices
        let visibleIndices = [];
        for (let i = 0; i < currentCards.length; i++) {
            if (hideUncheckedActive && !checkedState[i]) continue;
            visibleIndices.push(i);
        }
        
        if (visibleIndices.length === 0 && currentCards.length === 0) {
            cardsListContainer.innerHTML = '<div class="error">No cards found.</div>';
            cardsCounterSpan.innerText = `0 cards`;
            updateHideStatusLabel();
            return;
        }
        if (visibleIndices.length === 0 && currentCards.length > 0 && hideUncheckedActive) {
            cardsListContainer.innerHTML = '<div class="error">All cards hidden because "Hide unchecked" is ON. Check some cards to make them reappear.</div>';
            cardsCounterSpan.innerText = `${currentCards.length} total · 0 visible`;
            updateHideStatusLabel();
            return;
        }
        
        let html = '';
        for (let idx of visibleIndices) {
            const card = currentCards[idx];
            const isChecked = checkedState[idx];
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
                <div class="card-item" data-card-id="${card.id}">
                    <input type="checkbox" class="card-check" data-id="${card.id}" ${isChecked ? 'checked' : ''}>
                    <div class="card-content">
                        <h4>Front (Term / Question)</h4>
                        <div class="card-question">${escapeHtml(cleanQ)} ${typeBadge}</div>
                        <h4>Back (Definition / Answer)</h4>
                        <div class="card-answer">${answerHtml}</div>
                    </div>
                </div>
            `;
        }
        cardsListContainer.innerHTML = html;
        const total = currentCards.length;
        const visibleCount = visibleIndices.length;
        if (hideUncheckedActive && total !== visibleCount) {
            cardsCounterSpan.innerText = `${visibleCount} / ${total} card${total !== 1 ? 's' : ''} (unchecked hidden)`;
        } else {
            cardsCounterSpan.innerText = `${total} card${total !== 1 ? 's' : ''}`;
        }
        updateHideStatusLabel();
        attachCheckboxEvents();
    }
    
    function updateHideStatusLabel() {
        if (hideUncheckedActive) {
            toggleHideBtn.textContent = "Show all cards";
            toggleHideBtn.style.color = '#830000';
        } else {
            toggleHideBtn.textContent = "Hide unchecked cards";
            toggleHideBtn.style.color = '#078500';
        }
    }
    
    // Toggle hide/unchecked mode
    function toggleHideUnchecked() {
        // If no cards, just toggle (or do nothing)
        if (currentCards.length === 0) {
            hideUncheckedActive = !hideUncheckedActive;
            renderCardsList();
            return;
        }

        // Check if all cards are checked
        const allChecked = checkedState.every(checked => checked === true);

        if (allChecked) {
            alert("All cards are checked");
            // Do NOT toggle; just return (or you could still toggle, but user says else continues toggling)
            return;
        } else {
            // Continue to toggle visibility
            hideUncheckedActive = !hideUncheckedActive;
            renderCardsList();
        }
    }
    
    // Attach checkbox change listeners
    function attachCheckboxEvents() {
        cardsListContainer.removeEventListener('change', handleCheckboxChange);
        cardsListContainer.addEventListener('change', handleCheckboxChange);
    }
    
    function handleCheckboxChange(e) {
        if (e.target.classList && e.target.classList.contains('card-check')) {
            const cardId = e.target.getAttribute('data-id');
            if (!cardId) return;
            const idx = currentCards.findIndex(c => c.id === cardId);
            if (idx !== -1) {
                checkedState[idx] = e.target.checked;
                renderCardsList();      // re-render to apply hide logic
                generateSelectedOutput();
            }
        }
    }
    
    // Generate final Q&A string based on checked cards
    function generateSelectedOutput() {
        const qaSep = qaSepInput.value || '\t';
        let pairSepRaw = pairSepInput.value;
        let pairSep = pairSepRaw === '\\n' ? '\n' : (pairSepRaw || '\n');
        if (pairSep === '\\n') pairSep = '\n';
        
        const selectedCards = [];
        for (let i = 0; i < currentCards.length; i++) {
            if (checkedState[i]) {
                selectedCards.push(currentCards[i]);
            }
        }
        if (selectedCards.length === 0) {
            formattedOutput.value = '';
            return '';
        }
        const pairs = selectedCards.map(card => {
            let cleanQuestion = stripNumberFromQuestion(card.question);
            if (!cleanQuestion) cleanQuestion = card.question;
            return `${cleanQuestion}${qaSep}${card.answer}`;
        });
        const out = pairs.join(pairSep);
        formattedOutput.value = out;
        return out;
    }
    
    // Replace current deck with new extracted cards
    function setNewCards(cardsArray) {
        currentCards = cardsArray.map(card => ({
            id: generateId(),
            question: card.question,
            answer: card.answer,
            type: card.type || 'extracted'
        }));
        checkedState = new Array(currentCards.length).fill(true);
        renderCardsList();
        generateSelectedOutput();
    }
    
    // Extraction flow
    function runExtraction() {
        const rawHtml = htmlInput.value.trim();
        if (!rawHtml) {
            alert("Please paste HTML source from itexamanswers.net");
            return;
        }
        try {
            const extracted = extractCardsFromHtml(rawHtml);
            if (extracted.length === 0) {
                cardsListContainer.innerHTML = '<div class="error">No valid Q&A found. Verify HTML structure (numbered questions + correct_answer list / match tables).</div>';
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
    
    function selectAll() {
        for (let i = 0; i < checkedState.length; i++) checkedState[i] = true;
        renderCardsList();
        generateSelectedOutput();
    }
    
    function deselectAll() {
        for (let i = 0; i < checkedState.length; i++) checkedState[i] = false;
        renderCardsList();
        generateSelectedOutput();
    }
    
    function copyAllToClipboard() {
        const text = formattedOutput.value;
        if (!text || text.trim() === "") {
            alert("No content to copy. Please extract cards and select at least one card.");
            return;
        }
        navigator.clipboard.writeText(text).then(() => {
            const originalText = copyAllBtn.textContent;
            copyAllBtn.textContent = "Copied!";
            setTimeout(() => {
                copyAllBtn.textContent = originalText;
            }, 1500);
        }).catch(() => {
            alert("Failed to copy. Select the text manually.");
        });
    }
    
    // Bind events
    extractBtn.onclick = runExtraction;
    selectAllBtn.onclick = selectAll;
    deselectAllBtn.onclick = deselectAll;
    toggleHideBtn.onclick = toggleHideUnchecked;
    copyAllBtn.onclick = copyAllToClipboard;
    
    // Separators change -> update output
    qaSepInput.addEventListener('input', () => generateSelectedOutput());
    pairSepInput.addEventListener('input', () => generateSelectedOutput());
    
    // Initial state
    currentCards = [];
    checkedState = [];
    renderCardsList();
    formattedOutput.value = '';
    
    // Ensure pairSep handles newline default correctly
    if (pairSepInput.value === '\\n') pairSepInput.value = '\n';
})();