let isSelecting = false;
let startX, startY;
let selectionElement = null;

// Слушаем сообщения от popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startSelection') {
    startSelectionMode();
  }
});

function startSelectionMode() {
  if (isSelecting) return;
  isSelecting = true;

  // Создаем элемент выделения
  selectionElement = document.createElement('div');
  selectionElement.style.position = 'fixed';
  selectionElement.style.border = '2px solid #1a73e8';
  selectionElement.style.backgroundColor = 'rgba(26, 115, 232, 0.1)';
  selectionElement.style.pointerEvents = 'none';
  selectionElement.style.zIndex = '999999';
  document.body.appendChild(selectionElement);

  // Добавляем обработчики событий
  document.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  // Меняем курсор
  document.body.style.cursor = 'crosshair';
}

function handleMouseDown(e) {
  if (!isSelecting) return;
  startX = e.clientX;
  startY = e.clientY;
  updateSelectionElement(e.clientX, e.clientY, e.clientX, e.clientY);
}

function handleMouseMove(e) {
  if (!isSelecting || startX === undefined) return;
  updateSelectionElement(startX, startY, e.clientX, e.clientY);
}

function handleMouseUp(e) {
  if (!isSelecting) return;

  // Получаем координаты выделения
  const rect = selectionElement.getBoundingClientRect();
  
  // Создаем canvas для захвата выделенной области
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  // Устанавливаем размеры canvas
  canvas.width = rect.width;
  canvas.height = rect.height;
  
  // Захватываем выделенную область
  chrome.runtime.sendMessage({
    action: 'captureVisibleTab'
  }, (screenshotUrl) => {
    const img = new Image();
    img.onload = () => {
      context.drawImage(
        img,
        rect.left,
        rect.top,
        rect.width,
        rect.height,
        0,
        0,
        rect.width,
        rect.height
      );
      
      // Отправляем данные в background script
      const imageData = canvas.toDataURL('image/png');
      chrome.runtime.sendMessage({
        action: 'uploadToFigma',
        imageData: imageData,
        fileName: 'Screenshot ' + new Date().toISOString()
      });
    };
    img.src = screenshotUrl;
  });

  // Очищаем режим выделения
  cleanup();
}

function updateSelectionElement(startX, startY, endX, endY) {
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  selectionElement.style.left = left + 'px';
  selectionElement.style.top = top + 'px';
  selectionElement.style.width = width + 'px';
  selectionElement.style.height = height + 'px';
}

function cleanup() {
  isSelecting = false;
  startX = undefined;
  startY = undefined;
  
  if (selectionElement) {
    selectionElement.remove();
    selectionElement = null;
  }
  
  document.body.style.cursor = 'default';
  
  document.removeEventListener('mousedown', handleMouseDown);
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
} 