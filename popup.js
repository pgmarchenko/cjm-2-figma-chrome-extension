document.addEventListener('DOMContentLoaded', async function() {
  const captureFullPageBtn = document.getElementById('captureFullPage');
  const captureSelectionBtn = document.getElementById('captureSelection');
  const connectFigmaBtn = document.getElementById('connectFigma');
  const statusDiv = document.getElementById('status');
  const versionSpan = document.getElementById('version');
  const authStatusDiv = document.getElementById('authStatus');

  // Показываем версию расширения
  const manifest = chrome.runtime.getManifest();
  versionSpan.textContent = manifest.version;

  // Проверяем наличие Client Secret
  async function checkClientSecret() {
    const { figmaClientSecret } = await chrome.storage.local.get('figmaClientSecret');
    if (!figmaClientSecret) {
      // Сохраняем Client Secret
      await chrome.storage.local.set({
        'figmaClientSecret': 'NgYheGl1Gqa7ZWk28zyChuAV9a1Z9z'
      });
      console.log('Client Secret сохранен');
    }
  }

  // Проверяем Client Secret при запуске
  await checkClientSecret();

  // Проверяем статус авторизации
  async function checkAuthStatus() {
    try {
      const { figmaAccessToken } = await chrome.storage.local.get('figmaAccessToken');
      if (figmaAccessToken) {
        authStatusDiv.textContent = 'Подключено к Figma';
        authStatusDiv.classList.add('authorized');
        authStatusDiv.classList.remove('unauthorized');
        connectFigmaBtn.textContent = 'Переподключить Figma';
      } else {
        authStatusDiv.textContent = 'Требуется подключение к Figma';
        authStatusDiv.classList.add('unauthorized');
        authStatusDiv.classList.remove('authorized');
        connectFigmaBtn.textContent = 'Подключить Figma';
      }
    } catch (error) {
      console.error('Ошибка при проверке статуса авторизации:', error);
    }
  }

  // Проверяем статус при открытии
  await checkAuthStatus();

  // Захват всей страницы
  captureFullPageBtn.addEventListener('click', async () => {
    try {
      statusDiv.textContent = 'Создание скриншота...';
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      
      // Отправляем сообщение в background script для создания скриншота
      chrome.runtime.sendMessage({
        action: 'captureFullPage',
        tabId: tab.id
      }, async (response) => {
        if (response.success) {
          statusDiv.textContent = 'Загрузка в Figma...';
          
          // Получаем сохраненный скриншот
          const { lastScreenshot } = await chrome.storage.local.get('lastScreenshot');
          
          // Загружаем в Figma
          chrome.runtime.sendMessage({
            action: 'uploadToFigma',
            imageData: lastScreenshot,
            fileName: 'Screenshot ' + new Date().toLocaleString()
          }, (uploadResponse) => {
            if (uploadResponse.success) {
              statusDiv.innerHTML = `Скриншот загружен в Figma!<br><a href="${uploadResponse.fileUrl}" target="_blank">Открыть в Figma</a>`;
            } else {
              statusDiv.textContent = 'Ошибка при загрузке в Figma: ' + uploadResponse.error;
            }
          });
        } else {
          statusDiv.textContent = 'Ошибка при создании скриншота: ' + response.error;
        }
      });
    } catch (error) {
      statusDiv.textContent = `Ошибка: ${error.message}`;
    }
  });

  // Выбор области для скриншота
  captureSelectionBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      
      // Инжектируем скрипт выбора области в текущую страницу
      chrome.tabs.sendMessage(tab.id, {
        action: 'startSelection'
      });
      
      // Закрываем popup, чтобы не мешать выбору области
      window.close();
    } catch (error) {
      statusDiv.textContent = `Ошибка: ${error.message}`;
    }
  });

  // Подключение к Figma
  connectFigmaBtn.addEventListener('click', async () => {
    try {
      statusDiv.textContent = 'Подключение к Figma...';
      
      const clientId = 'TiuveWsSWiUY46CFhwAUL7';
      const redirectUri = 'https://pgmarchenko.github.io/cjm-2-figma-chrome-extension/oauth.html';
      const state = generateState();
      
      // Сохраняем state для последующей проверки
      await chrome.storage.local.set({ 'oauth_state': state });
      
      const authUrl = `https://www.figma.com/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=files&response_type=code&state=${state}`;

      // Открываем окно авторизации
      window.open(authUrl, 'figma_auth', 'width=800,height=600');
    } catch (error) {
      statusDiv.textContent = `Ошибка подключения к Figma: ${error.message}`;
    }
  });
});

// Генерация случайного state для OAuth
function generateState() {
  return Math.random().toString(36).substring(2, 15);
} 