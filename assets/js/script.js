const documents = [];

const libraryAreas = [
  {
    title: 'Telecommunications',
    description: 'Research themes and references across the communications sector.'
  },
  {
    title: 'AI and data',
    description: 'Publicly cleared material on AI, analytics, and data-led services.'
  },
  {
    title: 'Strategy and transformation',
    description: 'General strategy, operating model, and transformation resources.'
  },
  {
    title: 'Digital products and networks',
    description: 'General digital product, platform, and network technology themes.'
  }
];
const searchInput = document.getElementById('searchInput');
const resultsContainer = document.getElementById('resultsContainer');
const resultCount = document.getElementById('resultCount');
const areaList = document.getElementById('areaList');
const suggestedTags = document.getElementById('suggestedTags');
const totalDocs = document.getElementById('totalDocs');
const totalCategories = document.getElementById('totalCategories');
const clearBtn = document.getElementById('clearBtn');
const searchBtn = document.getElementById('searchBtn');
const typeFilter = document.getElementById('typeFilter');
const sortSelect = document.getElementById('sortSelect');
const favoritesBtn = document.getElementById('favoritesBtn');
const favoritesCount = document.getElementById('favoritesCount');
const resetViewBtn = document.getElementById('resetViewBtn');
const detailModal = document.getElementById('detailModal');
const modalClose = document.getElementById('modalClose');
const modalTitle = document.getElementById('modalTitle');
const modalType = document.getElementById('modalType');
const modalSummary = document.getElementById('modalSummary');
const modalMeta = document.getElementById('modalMeta');
const modalOpen = document.getElementById('modalOpen');
const modalPdf = document.getElementById('modalPdf');
const modalShare = document.getElementById('modalShare');
const toast = document.getElementById('toast');
const toolTabs = document.querySelectorAll('.tool-tab');
const toolPanels = document.querySelectorAll('.tool-panel');
const slideSearchInput = document.getElementById('slideSearchInput');
const slideSearchBtn = document.getElementById('slideSearchBtn');
const slideResults = document.getElementById('slideResults');
const docFinderInput = document.getElementById('docFinderInput');
const docFinderBtn = document.getElementById('docFinderBtn');
const docFinderResults = document.getElementById('docFinderResults');
const uploadInput = document.getElementById('uploadInput');
const uploadBrowseBtn = document.getElementById('uploadBrowseBtn');
const uploadList = document.getElementById('uploadList');
const uploadStatus = document.getElementById('uploadStatus');
let selectedDocument = null;
let showingFavorites = false;
const favoriteIds = new Set(JSON.parse(localStorage.getItem('knowledge-library-favorites') || '[]'));
const uploadedReferences = JSON.parse(localStorage.getItem('knowledge-library-uploads') || '[]');
const uploadedDocuments = [];

function renderAreaList() {
  areaList.innerHTML = libraryAreas.map(area => `
    <li>
      <strong>${area.title}</strong>
      <span>${area.description}</span>
    </li>
  `).join('');
}

function renderSuggestedTags() {
  const tags = ['AI', 'TMT', 'telecommunications', 'data', 'digital transformation', 'networks', 'strategy', 'governance'];
  suggestedTags.innerHTML = tags.map(tag => `<button class="tag" type="button">${tag}</button>`).join('');

  suggestedTags.querySelectorAll('.tag').forEach((tag) => {
    tag.addEventListener('click', () => {
      searchInput.value = tag.textContent.trim();
      runSearch();
    });
  });
}

function renderTypeFilter() {
  [...new Set(documents.map((doc) => doc.type))].sort().forEach((type) => {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = type;
    typeFilter.appendChild(option);
  });
}

function categorizeUpload(fileName) {
  const name = normalize(fileName);
  if (/rfp|rfi|rfs|response|proposal/.test(name)) return 'Proposal & Response Solution';
  if (/ai|genai|machine learning|ml/.test(name)) return 'AI & Data Solutions';
  if (/data|analytics|monetization|insight/.test(name)) return 'Data, Analytics & Monetization';
  if (/sales|crm|cpq|commercial|customer/.test(name)) return 'Sales & Customer Transformation';
  if (/network|telecom|mobile|oss|bss/.test(name)) return 'Telecom & Network Transformation';
  if (/architecture|technical|engineering|technology/.test(name)) return 'Architecture & Technology';
  if (/process|operating|operation|transformation/.test(name)) return 'Operating Model & Process Transformation';
  return 'General Business Transformation';
}

async function hashFile(file) {
  try {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    return `${normalize(file.name)}-${file.size}-${file.lastModified}`;
  }
}

function isDuplicateUpload(file, hash) {
  const normalizedName = normalize(file.name);
  const knownNames = documents.map((doc) => normalize(doc.title + ' ' + doc.path));
  return uploadedReferences.some((item) => item.hash === hash || normalize(item.name) === normalizedName) || knownNames.some((name) => name.includes(normalizedName) || normalizedName.includes(name));
}

function addUploadedTypeFilter() {
  if ([...typeFilter.options].some((option) => option.value === 'Uploaded Document')) return;
  const option = document.createElement('option');
  option.value = 'Uploaded Document';
  option.textContent = 'Uploaded Document';
  typeFilter.appendChild(option);
}

function searchableText(doc) {
  return [doc.title, doc.type, doc.category, doc.summary, doc.overview, doc.keywords.join(' '), doc.poc, doc.contact].join(' ').toLowerCase();
}

function findDocuments(query, types = []) {
  const normalizedQuery = normalize(query);
  return documents.filter((doc) => (!normalizedQuery || searchableText(doc).includes(normalizedQuery)) && (!types.length || types.includes(doc.fileType)));
}

function getMatchedKeyword(doc, query) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return doc.keywords[0] || doc.category;
  return [doc.title, doc.category, ...doc.keywords].find((value) => normalize(value).includes(normalizedQuery)) || query;
}

function getSlideReference(doc, query) {
  const keywordIndex = Math.max(0, doc.keywords.findIndex((keyword) => normalize(keyword).includes(normalize(query))));
  return String(keywordIndex + 1).padStart(2, '0');
}

function renderToolResults(container, items, emptyMessage) {
  container.innerHTML = items.length ? items.slice(0, 8).map((doc) => `
    <article class="tool-result"><div><strong>${doc.title}</strong><span>${doc.type} Â· ${doc.category}</span></div><button class="text-btn" type="button" data-tool-doc="${doc.id}">Open</button></article>
  `).join('') : `<div class="tool-empty">${emptyMessage}</div>`;
  container.querySelectorAll('[data-tool-doc]').forEach((button) => button.addEventListener('click', () => openDocument(documents.find((doc) => doc.id === button.dataset.toolDoc))));
}

function searchSlides() {
  const query = slideSearchInput.value.trim();
  const matches = findDocuments(query);
  if (!matches.length) {
    slideResults.innerHTML = `<div class="tool-empty">No public documents are included yet. Add cleared documents using Upload Docs.</div>`;
    return;
  }

  slideResults.innerHTML = matches.slice(0, 12).map((doc) => {
    const keyword = getMatchedKeyword(doc, query);
    const slideReference = getSlideReference(doc, query);
    return `
      <article class="slide-result" data-tool-doc="${doc.id}" tabindex="0" role="button" aria-label="Open ${doc.title}">
        <div class="slide-snapshot">
          <div class="snapshot-topline"><span>INVENT INDIA TMT LIBRARY</span><span>SLIDE ${slideReference}</span></div>
          <div class="snapshot-rule"></div>
          <div class="snapshot-kicker">${doc.type}</div>
          <strong>${doc.title}</strong>
          <p>${doc.summary}</p>
          <div class="snapshot-keyword">MATCH Â· ${keyword}</div>
        </div>
        <div class="slide-result-info"><strong>${doc.title}</strong><span>${doc.category} Â· ${doc.fileType.toUpperCase()}</span><button class="text-btn" type="button">Open complete file &rarr;</button></div>
      </article>
    `;
  }).join('');

  slideResults.querySelectorAll('[data-tool-doc]').forEach((preview) => {
    const open = () => openDocument(documents.find((doc) => doc.id === preview.dataset.toolDoc));
    preview.addEventListener('click', open);
    preview.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
    });
  });
}

function searchDocs() {
  renderToolResults(docFinderResults, findDocuments(docFinderInput.value), 'No public documents are included yet. Add cleared documents using Upload Docs.');
}

function activateTool(tool) {
  toolTabs.forEach((tab) => {
    const active = tab.dataset.tool === tool;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  toolPanels.forEach((panel) => {
    panel.hidden = panel.dataset.panel !== tool;
    panel.classList.toggle('is-active', panel.dataset.panel === tool);
  });
}

function updateFavoritesCount() {
  favoritesCount.textContent = favoriteIds.size;
  favoritesBtn.classList.toggle('is-active', showingFavorites);
  favoritesBtn.setAttribute('aria-pressed', String(showingFavorites));
}

function normalize(value) {
  return String(value || '').toLowerCase();
}

function documentUrl(path) {
  return path.split('/').map((part) => encodeURIComponent(part)).join('/');
}

function runSearch() {
  const query = normalize(searchInput.value.trim());
  let filtered = !query
    ? documents
    : documents.filter((doc) => {
        const haystack = [
          doc.title,
          doc.type,
          doc.category,
          doc.summary,
          doc.overview,
          doc.keywords.join(' '),
          doc.poc,
          doc.contact
        ].join(' ').toLowerCase();

        return haystack.includes(query);
      });

  if (typeFilter.value !== 'all') filtered = filtered.filter((doc) => doc.type === typeFilter.value);
  if (showingFavorites) filtered = filtered.filter((doc) => favoriteIds.has(doc.id));
  if (sortSelect.value === 'title') filtered.sort((a, b) => a.title.localeCompare(b.title));
  if (sortSelect.value === 'category') filtered.sort((a, b) => a.category.localeCompare(b.category));

  renderResults(filtered);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove('is-visible'), 2400);
}

function openDetails(doc) {
  selectedDocument = doc;
  modalTitle.textContent = doc.title;
  modalType.textContent = `${doc.type} / ${doc.category}`;
  modalSummary.textContent = `${doc.summary} ${doc.overview}`;
  modalMeta.innerHTML = `<strong>Point of contact</strong><span>${doc.poc}<br>${doc.contact}</span><strong>Keywords</strong><span>${doc.keywords.join(' Â· ')}</span>`;
  detailModal.hidden = false;
  document.body.classList.add('modal-open');
}

function closeDetails() {
  detailModal.hidden = true;
  document.body.classList.remove('modal-open');
  selectedDocument = null;
}

function toggleFavorite(docId) {
  if (favoriteIds.has(docId)) favoriteIds.delete(docId);
  else favoriteIds.add(docId);
  localStorage.setItem('knowledge-library-favorites', JSON.stringify([...favoriteIds]));
  updateFavoritesCount();
  runSearch();
}

function openDocument(doc) {
  const url = doc.path.startsWith('http') ? doc.path : documentUrl(doc.path);
  window.open(url, '_blank', 'noopener,noreferrer');
}

function downloadPdfBrief(doc) {
  const pdfTarget = doc.fileType === 'pdf' ? doc.path : null;

  if (pdfTarget) {
    const link = document.createElement('a');
    link.href = documentUrl(pdfTarget);
    link.download = `${doc.title}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }

  const printWindow = window.open('', '_blank', 'width=900,height=700');
  const html = `
    <html>
      <head>
        <title>${doc.title} â€” PDF brief</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 32px; color: #172033; }
          h1 { margin-bottom: 6px; }
          .meta { color: #5d6b82; margin-bottom: 18px; }
          p { line-height: 1.7; }
          .tag { display: inline-block; background: #eef4ff; color: #234fd6; padding: 6px 10px; margin: 2px 8px 2px 0; border-radius: 999px; font-size: 12px; }
          .box { border: 1px solid #dfe8f4; border-radius: 12px; padding: 16px; margin-top: 18px; }
        </style>
      </head>
      <body>
        <h1>${doc.title}</h1>
        <div class="meta">${doc.type} â€¢ ${doc.category}</div>
        <p>${doc.summary}</p>
        <div class="box">
          <strong>Point of contact</strong>
          <p>${doc.poc}<br>${doc.contact}</p>
        </div>
        <div class="box">
          <strong>Keywords</strong><br>
          ${doc.keywords.map((k) => `<span class="tag">${k}</span>`).join('')}
        </div>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function renderResults(items) {
  if (!items.length) {
    resultsContainer.innerHTML = `
      <div class="empty-state">
        <h3>No matching documents found</h3>
        <p>Add a publicly cleared document to begin searching this library.</p>
      </div>
    `;
    resultCount.textContent = '0 matches';
    return;
  }

  resultsContainer.innerHTML = items.map((doc) => `
    <article class="result-card">
      <div class="result-top">
        <h4>${doc.title}</h4>
        <div class="result-actions"><span class="badge">${doc.type}</span><button class="favorite-btn ${favoriteIds.has(doc.id) ? 'is-favorite' : ''}" type="button" data-action="favorite" data-id="${doc.id}" aria-label="Save ${doc.title}">${favoriteIds.has(doc.id) ? 'â˜…' : 'â˜†'}</button></div>
      </div>

      <p>${doc.summary}</p>

      <div class="meta-row">
        <div class="meta-block">
          <span class="meta-label">Solution focus</span>
          <div class="meta-value">${doc.category}</div>
        </div>
        <div class="meta-block">
          <span class="meta-label">Point of contact</span>
          <div class="meta-value">${doc.poc}<br>${doc.contact}</div>
        </div>
      </div>

      <ul class="keywords">
        ${doc.keywords.map((keyword) => `<li>${keyword}</li>`).join('')}
      </ul>

      <div class="actions-row">
        <button class="secondary-btn" type="button" data-action="details" data-id="${doc.id}">View details</button>
        <button class="secondary-btn" type="button" data-action="open" data-id="${doc.id}">Open source</button>
        <button class="link-btn" type="button" data-action="pdf" data-id="${doc.id}">Download PDF</button>
      </div>
    </article>
  `).join('');

  resultCount.textContent = `${items.length} match${items.length === 1 ? '' : 'es'}`;

  resultsContainer.querySelectorAll('[data-action="open"]').forEach((button) => {
    button.addEventListener('click', () => {
      const doc = documents.find((item) => item.id === button.dataset.id);
      if (doc) openDocument(doc);
    });
  });

  resultsContainer.querySelectorAll('[data-action="details"]').forEach((button) => {
    button.addEventListener('click', () => openDetails(documents.find((item) => item.id === button.dataset.id)));
  });

  resultsContainer.querySelectorAll('[data-action="favorite"]').forEach((button) => {
    button.addEventListener('click', () => toggleFavorite(button.dataset.id));
  });

  resultsContainer.querySelectorAll('[data-action="pdf"]').forEach((button) => {
    button.addEventListener('click', () => {
      const doc = documents.find((item) => item.id === button.dataset.id);
      if (doc) downloadPdfBrief(doc);
    });
  });
}

toolTabs.forEach((tab) => tab.addEventListener('click', () => activateTool(tab.dataset.tool)));
slideSearchBtn.addEventListener('click', searchSlides);
slideSearchInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') searchSlides(); });
docFinderBtn.addEventListener('click', searchDocs);
docFinderInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') searchDocs(); });
uploadBrowseBtn.addEventListener('click', (event) => {
  event.preventDefault();
  if (typeof uploadInput.showPicker === 'function') uploadInput.showPicker();
  else uploadInput.click();
});
uploadInput.addEventListener('change', async () => {
  const files = [...uploadInput.files];
  if (!files.length) return;
  uploadStatus.className = 'upload-status';
  uploadStatus.textContent = 'Checking files and categorizing solution focus...';
  let added = 0;
  const errors = [];

  for (const file of files) {
    const hash = await hashFile(file);
    if (isDuplicateUpload(file, hash)) {
      errors.push(`${file.name}: already in the library`);
      continue;
    }

    const objectUrl = URL.createObjectURL(file);
    const category = categorizeUpload(file.name);
    const record = {
      id: `upload-${hash.slice(0, 12)}`,
      title: file.name.replace(/\.[^/.]+$/, ''),
      type: 'Uploaded Document',
      category,
      path: objectUrl,
      fileType: file.name.split('.').pop().toLowerCase(),
      summary: `User-uploaded reference categorized under ${category}. The file is available for this browser session and searchable across its filename and solution focus.`,
      overview: `Uploaded document with automatically assigned solution focus: ${category}.`,
      keywords: [category, file.name.replace(/\.[^/.]+$/, '')],
      poc: 'User-uploaded library reference',
      contact: 'Review the source document for contact details'
    };

    documents.push(record);
    uploadedDocuments.push(record);
    uploadedReferences.unshift({ name: file.name, size: file.size, hash, created: new Date().toLocaleDateString(), id: record.id });
    added += 1;
  }

  localStorage.setItem('knowledge-library-uploads', JSON.stringify(uploadedReferences));
  if (added) {
    addUploadedTypeFilter();
    totalDocs.textContent = documents.length;
    renderUploads();
    runSearch();
  }
  uploadStatus.className = errors.length ? 'upload-status has-error' : 'upload-status has-success';
  uploadStatus.innerHTML = `${added ? `<strong>${added} file${added === 1 ? '' : 's'} added to the library.</strong>` : ''}${errors.length ? `<span>${errors.join('<br>')}</span>` : ''}`;
  showToast(errors.length ? 'Upload completed with duplicate warnings' : `${added} document${added === 1 ? '' : 's'} added to the library`);
  uploadInput.value = '';
});

function renderUploads() {
  uploadList.innerHTML = uploadedReferences.length ? uploadedReferences.slice(0, 12).map((file) => `<article class="project-item"><strong>${file.name}</strong><span>${Math.ceil(file.size / 1024)} KB Â· added ${file.created}</span></article>`).join('') : '<div class="tool-empty">Uploaded file references will appear here for this browser session.</div>';
}

searchBtn.addEventListener('click', runSearch);
searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') runSearch();
});
clearBtn.addEventListener('click', () => {
  searchInput.value = '';
  runSearch();
  searchInput.focus();
});
typeFilter.addEventListener('change', runSearch);
sortSelect.addEventListener('change', runSearch);
favoritesBtn.addEventListener('click', () => {
  showingFavorites = !showingFavorites;
  updateFavoritesCount();
  runSearch();
});
resetViewBtn.addEventListener('click', () => {
  searchInput.value = '';
  typeFilter.value = 'all';
  sortSelect.value = 'relevance';
  showingFavorites = false;
  updateFavoritesCount();
  runSearch();
});
modalClose.addEventListener('click', closeDetails);
detailModal.addEventListener('click', (event) => {
  if (event.target === detailModal) closeDetails();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !detailModal.hidden) closeDetails();
});
modalOpen.addEventListener('click', () => selectedDocument && openDocument(selectedDocument));
modalPdf.addEventListener('click', () => selectedDocument && downloadPdfBrief(selectedDocument));
modalShare.addEventListener('click', async () => {
  if (!selectedDocument) return;
  const shareUrl = `${window.location.href.split('#')[0]}#${selectedDocument.id}`;
  try {
    await navigator.clipboard.writeText(shareUrl);
    showToast('Document link copied');
  } catch {
    showToast('Copy unavailable in this browser');
  }
});

renderAreaList();
renderTypeFilter();
renderSuggestedTags();
updateFavoritesCount();
searchSlides();
searchDocs();
renderUploads();
totalDocs.textContent = documents.length;
totalCategories.textContent = libraryAreas.length;
runSearch();
