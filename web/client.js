const form = document.querySelector('#chatForm');
const promptInput = document.querySelector('#prompt');
const sendButton = document.querySelector('#sendButton');
const messagesNode = document.querySelector('#messages');
const welcome = document.querySelector('#welcome');
const historyNode = document.querySelector('#history');
const tokenDialog = document.querySelector('#tokenDialog');
const tokenInput = document.querySelector('#tokenInput');
const tokenError = document.querySelector('#tokenError');
const settingsDialog = document.querySelector('#settingsDialog');
const documentsDialog = document.querySelector('#documentsDialog');
const messageDialog = document.querySelector('#messageDialog');
const attachmentPreview = document.querySelector('#attachmentPreview');
const imageInput = document.querySelector('#imageInput');
const chats = [];
let activeConversation = null;
let conversation = [];
let activeController = null;
let pendingImage = null;
let editTarget = null;
let mediaRecorder = null;
let recordedChunks = [];
let sessionInfo = null;
let activeRevisions = [];
let settings = loadSettings();

function loadSettings() {
  try {
    return { temperature: 0.7, top_p: 0.95, max_tokens: 1024, ...JSON.parse(localStorage.getItem('chat-settings') || '{}') };
  } catch {
    return { temperature: 0.7, top_p: 0.95, max_tokens: 1024 };
  }
}

function token() {
  return sessionStorage.getItem('gateway-token') || '';
}

function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (token()) headers.set('Authorization', `Bearer ${token()}`);
  return fetch(url, { ...options, headers, credentials: 'same-origin' });
}

function showTokenDialog() {
  tokenInput.value = token();
  tokenError.textContent = '';
  tokenDialog.showModal();
  tokenInput.focus();
}

function applySession(info) {
  sessionInfo = info;
  const simulated = info.provider === 'simulation';
  document.querySelector('#providerLabel').textContent = simulated ? 'Simülasyon' : 'llama.cpp';
  document.querySelector('.model-state').textContent = simulated ? 'SIM' : 'GPU';
  document.querySelector('.disclaimer').textContent = simulated
    ? 'Simülasyon modu açık. Yanıtlar test amaçlıdır.'
    : 'Yerel llama.cpp modeliyle çalışıyor.';
  const modelSelect = document.querySelector('#modelSelect');
  modelSelect.replaceChildren();
  for (const model of info.models || [info.settings.model]) {
    const option = document.createElement('option');
    option.value = model;
    option.textContent = model;
    modelSelect.append(option);
  }
  if (!settings.model) settings.model = info.settings.model;
  if (![...modelSelect.options].some((option) => option.value === settings.model)) settings.model = info.settings.model;
  modelSelect.value = settings.model;
  document.querySelector('#temperature').value = settings.temperature;
  document.querySelector('#temperatureValue').value = settings.temperature;
  document.querySelector('#topP').value = settings.top_p;
  document.querySelector('#maxTokens').value = settings.max_tokens;
  const voiceButton = document.querySelector('#voiceButton');
  voiceButton.disabled = !info.capabilities.audio;
  voiceButton.title = info.capabilities.audio ? 'Yerel sesle yazdır' : 'Yerel transcription servisi yapılandırılmamış';
  document.querySelector('#attachImage').disabled = !info.capabilities.vision;
  document.querySelector('#attachImage').title = info.capabilities.vision ? 'Görsel ekle' : 'Vision özellikli model yapılandırılmamış';
  void loadConversations();
}

function persistSettings() {
  settings.model = document.querySelector('#modelSelect').value || sessionInfo?.settings.model;
  settings.temperature = Number(document.querySelector('#temperature').value);
  settings.top_p = Number(document.querySelector('#topP').value);
  settings.max_tokens = Number(document.querySelector('#maxTokens').value);
  localStorage.setItem('chat-settings', JSON.stringify(settings));
}

function appendInline(parent, text) {
  const pattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*)/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    parent.append(document.createTextNode(text.slice(cursor, match.index)));
    const element = match[0].startsWith('`') ? document.createElement('code') : document.createElement('strong');
    const marker = match[0].startsWith('`') ? 1 : 2;
    element.textContent = match[0].slice(marker, -marker);
    parent.append(element);
    cursor = match.index + match[0].length;
  }
  parent.append(document.createTextNode(text.slice(cursor)));
}

function highlightCode(code) {
  const pattern = /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:async|await|break|class|const|continue|def|else|export|false|for|from|function|if|import|in|let|new|null|return|self|True|try|var|while|with|yield)\b|\b\d+(?:\.\d+)?\b)/g;
  let cursor = 0;
  for (const match of code.matchAll(pattern)) {
    code.append(document.createTextNode(match.input.slice(cursor, match.index)));
    const span = document.createElement('span');
    span.className = match[0].startsWith('//') || match[0].startsWith('#') || match[0].startsWith('/*')
      ? 'syntax-comment'
      : /^['"`]/.test(match[0]) ? 'syntax-string'
        : /^\d/.test(match[0]) ? 'syntax-number' : 'syntax-keyword';
    span.textContent = match[0];
    code.append(span);
    cursor = match.index + match[0].length;
  }
  code.append(document.createTextNode(code.dataset.source.slice(cursor)));
}

function appendTextBlock(parent, text) {
  for (const line of text.split('\n')) {
    if (!line) {
      parent.append(document.createElement('br'));
      continue;
    }
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    const element = heading ? document.createElement('h3') : document.createElement('p');
    appendInline(element, heading ? heading[1] : line);
    parent.append(element);
  }
}

function renderMarkdown(body, text) {
  body.replaceChildren();
  const codeBlocks = /```([^\n]*)\n([\s\S]*?)```/g;
  let cursor = 0;
  for (const match of text.matchAll(codeBlocks)) {
    appendTextBlock(body, text.slice(cursor, match.index));
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.dataset.source = match[2];
    highlightCode(code);
    pre.append(code);
    body.append(pre);
    cursor = match.index + match[0].length;
  }
  appendTextBlock(body, text.slice(cursor));
}

function addMessage(message, persist = true) {
  const article = document.createElement('article');
  article.className = `message ${message.role}`;
  article.dataset.messageId = message.id || '';
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = message.role === 'user' ? 'D' : 'Y';
  const column = document.createElement('div');
  column.className = 'message-content';
  const label = document.createElement('div');
  label.className = 'message-label';
  label.textContent = message.role === 'user' ? 'Sen' : 'Yerel Asistan';
  const body = document.createElement('div');
  body.className = 'message-body';
  if (message.content) renderMarkdown(body, message.content);
  column.append(label, body);
  article.append(avatar, column);
  messagesNode.append(article);
  article.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  welcome.hidden = true;
  messagesNode.classList.add('visible');
  if (persist) conversation.push(message);
  for (const attachment of message.attachments || []) void showAttachment(body, attachment);
  return { article, body, message };
}

async function showAttachment(body, attachment) {
  try {
    const response = await apiFetch(attachment.url);
    if (!response.ok) return;
    const image = document.createElement('img');
    image.alt = attachment.name;
    image.src = URL.createObjectURL(await response.blob());
    image.style.maxWidth = '240px';
    image.style.maxHeight = '180px';
    image.style.borderRadius = '6px';
    body.append(image);
  } catch { /* An unavailable preview does not affect the saved message. */ }
}

function addMessageActions(view) {
  const tools = document.createElement('div');
  tools.className = 'message-tools';
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.textContent = 'Kopyala';
  copy.addEventListener('click', async () => {
    await navigator.clipboard.writeText(view.message.content);
    copy.textContent = 'Kopyalandı';
    setTimeout(() => { copy.textContent = 'Kopyala'; }, 1200);
  });
  tools.append(copy);
  if (view.message.role === 'user' && view.message.id && activeConversation) {
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = 'Düzenle';
    edit.addEventListener('click', () => {
      editTarget = view.message;
      document.querySelector('#editMessageInput').value = view.message.content;
      messageDialog.showModal();
    });
    tools.append(edit);
  }
  if (view.message.role === 'assistant' && view.message.id && view.message === conversation.at(-1)) {
    if (activeRevisions.length) {
      const diff = document.createElement('button');
      diff.type = 'button';
      diff.textContent = 'Diff';
      diff.addEventListener('click', () => showDiff(activeRevisions[0].content, view.message.content));
      tools.append(diff);
    }
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Yeniden üret';
    retry.addEventListener('click', () => void sendMessage('', { regenerate: true }));
    tools.append(retry);
  }
  view.article.querySelector('.message-content').append(tools);
}

function showDiff(previousText, currentText) {
  const previous = previousText.split('\n').slice(0, 250);
  const current = currentText.split('\n').slice(0, 250);
  const table = Array.from({ length: previous.length + 1 }, () => new Uint16Array(current.length + 1));
  for (let left = previous.length - 1; left >= 0; left--) {
    for (let right = current.length - 1; right >= 0; right--) {
      table[left][right] = previous[left] === current[right]
        ? table[left + 1][right + 1] + 1
        : Math.max(table[left + 1][right], table[left][right + 1]);
    }
  }
  const output = document.querySelector('#diffContent');
  output.replaceChildren();
  let left = 0;
  let right = 0;
  while (left < previous.length || right < current.length) {
    const line = document.createElement('span');
    line.className = 'diff-line';
    if (left < previous.length && right < current.length && previous[left] === current[right]) {
      line.textContent = `  ${previous[left++]}`;
      right++;
    } else if (left < previous.length && (right >= current.length || table[left + 1][right] >= table[left][right + 1])) {
      line.classList.add('diff-removed');
      line.textContent = `- ${previous[left++]}`;
    } else {
      line.classList.add('diff-added');
      line.textContent = `+ ${current[right++]}`;
    }
    output.append(line);
  }
  document.querySelector('#diffDialog').showModal();
}

function renderHistory() {
  historyNode.replaceChildren();
  for (const chat of chats) {
    const row = document.createElement('div');
    row.className = 'history-row';
    const select = document.createElement('button');
    select.className = `history-item${chat.id === activeConversation?.id ? ' active' : ''}`;
    select.textContent = chat.title;
    select.addEventListener('click', () => void loadConversation(chat.id));
    select.addEventListener('dblclick', async () => {
      const title = window.prompt('Sohbet adı', chat.title);
      if (!title?.trim()) return;
      await apiFetch(`/api/conversations/${chat.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim() }),
      });
      await loadConversations();
    });
    const remove = document.createElement('button');
    remove.className = 'history-action';
    remove.type = 'button';
    remove.textContent = '×';
    remove.title = 'Sohbeti sil';
    remove.setAttribute('aria-label', `${chat.title} sohbetini sil`);
    remove.addEventListener('click', async () => {
      if (!window.confirm('Bu sohbet ve mesajları silinsin mi?')) return;
      await apiFetch(`/api/conversations/${chat.id}`, { method: 'DELETE' });
      if (activeConversation?.id === chat.id) startNewChat();
      await loadConversations();
    });
    row.append(select, remove);
    historyNode.append(row);
  }
}

async function loadConversations() {
  const query = document.querySelector('#conversationSearch').value.trim();
  const response = await apiFetch(`/api/conversations?q=${encodeURIComponent(query)}`);
  if (!response.ok) return;
  chats.splice(0, chats.length, ...await response.json());
  renderHistory();
}

async function loadConversation(id) {
  const response = await apiFetch(`/api/conversations/${id}`);
  if (!response.ok) return;
  const result = await response.json();
  activeConversation = result.conversation;
  conversation = result.messages;
  const revisionResponse = await apiFetch(`/api/conversations/${id}/revisions`);
  activeRevisions = revisionResponse.ok ? await revisionResponse.json() : [];
  messagesNode.replaceChildren();
  messagesNode.classList.toggle('visible', conversation.length > 0);
  welcome.hidden = conversation.length > 0;
  for (const message of conversation) {
    const view = addMessage(message, false);
    addMessageActions(view);
  }
  renderHistory();
  document.querySelector('#sidebar').classList.remove('open');
}

function startNewChat() {
  if (activeController) activeController.abort();
  activeConversation = null;
  conversation = [];
  messagesNode.replaceChildren();
  welcome.hidden = false;
  messagesNode.classList.remove('visible');
  renderHistory();
  promptInput.focus();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function sendMessage(text, options = {}) {
  const cleanText = text.trim();
  if ((!cleanText && !options.regenerate) || activeController) return;
  persistSettings();
  if (options.regenerate && conversation.at(-1)?.role === 'assistant') {
    conversation.pop();
    messagesNode.lastElementChild?.remove();
  }
  if (!options.regenerate) {
    const userMessage = { role: 'user', content: cleanText };
    if (pendingImage) userMessage.content = `${cleanText}${cleanText ? '\n' : ''}[Görsel: ${pendingImage.name}]`;
    const userView = addMessage(userMessage);
    if (pendingImage) {
      const preview = document.createElement('img');
      preview.src = pendingImage.dataUrl;
      preview.alt = pendingImage.name;
      preview.style.maxWidth = '240px';
      preview.style.maxHeight = '180px';
      userView.body.append(preview);
    }
  }
  const assistantView = addMessage({ role: 'assistant', content: '' });
  const typing = document.createElement('span');
  typing.className = 'typing';
  typing.textContent = 'Düşünüyor...';
  assistantView.body.append(typing);
  const payload = {
    conversation_id: activeConversation?.id || null,
    message: options.regenerate ? null : cleanText || (pendingImage ? 'Bu görseli açıkla.' : ''),
    regenerate: Boolean(options.regenerate),
    settings: { ...settings },
    use_documents: document.querySelector('#useDocuments').checked,
    include_repository: document.querySelector('#useRepository').checked,
    image_data_url: pendingImage?.dataUrl || null,
    image_name: pendingImage?.name || null,
  };
  pendingImage = null;
  attachmentPreview.hidden = true;
  attachmentPreview.replaceChildren();
  promptInput.value = '';
  promptInput.style.height = 'auto';
  document.querySelector('#charCount').textContent = '';
  activeController = new AbortController();
  sendButton.textContent = '■';
  sendButton.title = 'Yanıtı durdur';
  sendButton.setAttribute('aria-label', 'Yanıtı durdur');

  try {
    const response = await apiFetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: activeController.signal,
    });
    if (response.status === 401) {
      sessionStorage.removeItem('gateway-token');
      throw new Error('Token reddedildi. Yeniden bağlan.');
    }
    if (!response.ok || !response.body) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || `Sunucu hatası (${response.status})`);
    }
    const newId = response.headers.get('X-Conversation-ID');
    if (newId) {
      activeConversation = { id: newId };
      await loadConversations();
    }
    typing.remove();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';
      for (const currentEvent of events) {
        const line = currentEvent.split('\n').find((part) => part.startsWith('data:'));
        if (!line) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const result = JSON.parse(data);
          if (result.error) throw new Error(result.error);
          assistantView.message.content += result.delta || '';
          assistantView.body.textContent = assistantView.message.content;
          messagesNode.scrollTop = messagesNode.scrollHeight;
        } catch (error) {
          if (error instanceof SyntaxError) continue;
          throw error;
        }
      }
    }
    renderMarkdown(assistantView.body, assistantView.message.content);
    await loadConversation(activeConversation.id);
  } catch (error) {
    typing.remove();
    assistantView.message.content = error.name === 'AbortError' ? 'Yanıt durduruldu.' : error.message;
    assistantView.body.textContent = assistantView.message.content;
    addMessageActions(assistantView);
  } finally {
    activeController = null;
    sendButton.textContent = '↑';
    sendButton.title = 'Gönder';
    sendButton.setAttribute('aria-label', 'Mesajı gönder');
  }
}

async function loadDocuments() {
  const list = document.querySelector('#documentList');
  list.replaceChildren();
  const response = await apiFetch('/api/documents');
  if (!response.ok) return;
  const documents = await response.json();
  if (!documents.length) {
    const empty = document.createElement('p');
    empty.className = 'dialog-note';
    empty.textContent = 'Henüz belge eklenmedi.';
    list.append(empty);
  }
  for (const documentInfo of documents) {
    const row = document.createElement('div');
    row.className = 'document-row';
    const name = document.createElement('span');
    name.textContent = documentInfo.name;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Sil';
    remove.addEventListener('click', async () => {
      await apiFetch(`/api/documents/${documentInfo.id}`, { method: 'DELETE' });
      await loadDocuments();
    });
    row.append(name, remove);
    list.append(row);
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (activeController) {
    activeController.abort();
    return;
  }
  void sendMessage(promptInput.value);
});

promptInput.addEventListener('input', () => {
  promptInput.style.height = 'auto';
  promptInput.style.height = `${Math.min(promptInput.scrollHeight, 150)}px`;
  document.querySelector('#charCount').textContent = promptInput.value.length ? `${promptInput.value.length}/12000` : '';
});

promptInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

document.querySelectorAll('.suggestion').forEach((button) => {
  button.addEventListener('click', () => {
    promptInput.value = button.dataset.prompt;
    promptInput.focus();
    promptInput.dispatchEvent(new Event('input'));
  });
});

document.querySelector('#newChat').addEventListener('click', startNewChat);
let searchTimer = null;
document.querySelector('#conversationSearch').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => void loadConversations(), 180);
});
document.querySelector('#tokenButton').addEventListener('click', showTokenDialog);
document.querySelector('#topTokenButton').addEventListener('click', showTokenDialog);
document.querySelector('#openSidebar').addEventListener('click', () => document.querySelector('#sidebar').classList.add('open'));
document.querySelector('#closeSidebar').addEventListener('click', () => document.querySelector('#sidebar').classList.remove('open'));
document.querySelector('#openSettings').addEventListener('click', () => settingsDialog.showModal());
document.querySelector('#openDocuments').addEventListener('click', () => {
  void loadDocuments();
  documentsDialog.showModal();
});
document.querySelectorAll('[data-close]').forEach((button) => {
  button.addEventListener('click', () => document.querySelector(`#${button.dataset.close}`).close());
});
document.querySelector('#temperature').addEventListener('input', (event) => {
  document.querySelector('#temperatureValue').value = event.target.value;
});
document.querySelector('#modelSelect').addEventListener('change', persistSettings);
document.querySelector('#maxTokens').addEventListener('change', (event) => {
  event.target.value = Math.max(16, Math.min(8192, Number(event.target.value) || 1024));
});

imageInput.addEventListener('change', async () => {
  const file = imageInput.files?.[0];
  imageInput.value = '';
  if (!file) return;
  if (file.size > 5_000_000) {
    window.alert('Görsel 5 MB sınırını aşıyor.');
    return;
  }
  pendingImage = { name: file.name, dataUrl: await readFileAsDataUrl(file) };
  attachmentPreview.replaceChildren();
  const image = document.createElement('img');
  image.src = pendingImage.dataUrl;
  image.alt = file.name;
  const name = document.createElement('span');
  name.textContent = file.name;
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = 'Kaldır';
  remove.addEventListener('click', () => {
    pendingImage = null;
    attachmentPreview.hidden = true;
  });
  attachmentPreview.append(image, name, remove);
  attachmentPreview.hidden = false;
});
document.querySelector('#attachImage').addEventListener('click', () => imageInput.click());

document.querySelector('#documentForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const file = document.querySelector('#documentFile').files?.[0];
  if (!file) return;
  const data = new FormData();
  data.append('file', file);
  const response = await apiFetch('/api/documents', { method: 'POST', body: data });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    window.alert(result.detail || 'Belge yüklenemedi.');
    return;
  }
  document.querySelector('#documentFile').value = '';
  await loadDocuments();
});

document.querySelector('#saveMessageEdit').addEventListener('click', async () => {
  if (!editTarget || !activeConversation) return;
  const content = document.querySelector('#editMessageInput').value.trim();
  const response = await apiFetch(`/api/conversations/${activeConversation.id}/messages/${editTarget.id}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }),
  });
  if (!response.ok) return;
  messageDialog.close();
  await loadConversation(activeConversation.id);
  await sendMessage('', { regenerate: true });
  editTarget = null;
});

document.querySelector('#voiceButton').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  if (mediaRecorder?.state === 'recording') {
    mediaRecorder.stop();
    button.classList.remove('recording');
    button.textContent = '●';
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    recordedChunks = [];
    mediaRecorder.addEventListener('dataavailable', (eventData) => recordedChunks.push(eventData.data));
    mediaRecorder.addEventListener('stop', async () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
      const dataUrl = await readFileAsDataUrl(new File([blob], 'voice.webm', { type: blob.type }));
      const response = await apiFetch('/api/transcribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audio_data_url: dataUrl }),
      });
      if (!response.ok) {
        window.alert('Yerel transcription servisi yanıt vermedi.');
        return;
      }
      const result = await response.json();
      promptInput.value = `${promptInput.value}${promptInput.value ? ' ' : ''}${result.text}`;
      promptInput.dispatchEvent(new Event('input'));
      promptInput.focus();
    });
    mediaRecorder.start();
    button.classList.add('recording');
    button.textContent = '■';
  } catch {
    window.alert('Mikrofon izni alınamadı.');
  }
});

document.querySelector('#tokenForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const value = tokenInput.value.trim();
  if (!value) return;
  try {
    const response = await fetch('/api/session', { headers: { Authorization: `Bearer ${value}` } });
    if (!response.ok) throw new Error(response.status === 401 ? 'Token geçersiz.' : 'Gateway erişilemiyor.');
    sessionStorage.setItem('gateway-token', value);
    applySession(await response.json());
    tokenDialog.close();
  } catch (error) {
    tokenError.textContent = error.message;
  }
});

const sessionHeaders = token() ? { Authorization: `Bearer ${token()}` } : {};
fetch('/api/session', { headers: sessionHeaders, credentials: 'same-origin' })
  .then((response) => {
    if (!response.ok) throw new Error('Oturum doğrulanamadı.');
    return response.json();
  })
  .then(applySession)
  .catch(() => {
    sessionStorage.removeItem('gateway-token');
    document.querySelector('#providerLabel').textContent = 'Bağlantı yok';
    document.querySelector('.disclaimer').textContent = 'Oturum doğrulanamadı. Yerel simülasyon için yeniden dene.';
  });