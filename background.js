// Обработка сообщений от popup и content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureFullPage') {
    captureFullPage(request.tabId)
      .then(dataUrl => {
        // Временно сохраняем скриншот
        chrome.storage.local.set({ 'lastScreenshot': dataUrl }, () => {
          sendResponse({ success: true });
        });
      })
      .catch(error => {
        console.error('Ошибка при создании скриншота:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Указываем, что ответ будет асинхронным
  }

  if (request.action === 'uploadToFigma') {
    uploadToFigma(request.imageData, request.fileName)
      .then(response => {
        sendResponse({ success: true, data: response });
      })
      .catch(error => {
        console.error('Ошибка при загрузке в Figma:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === 'getFigmaToken') {
    getFigmaToken(request.code)
      .then(response => {
        sendResponse({ success: true, data: response });
      })
      .catch(error => {
        console.error('Ошибка при получении токена Figma:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === 'getFigmaFiles') {
    getFigmaFiles().then(sendResponse);
    return true;
  }
});

// Создание скриншота всей страницы
async function captureFullPage(tabId) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'png',
      quality: 100
    });
    return dataUrl;
  } catch (error) {
    throw new Error(`Ошибка при создании скриншота: ${error.message}`);
  }
}

// Получение токена доступа Figma
async function getFigmaToken(code) {
  try {
    console.log('Getting Figma token for code:', code);
    
    const clientId = 'TiuveWsSWiUY46CFhwAUL7';
    // Получаем секретный ключ из storage
    const { figmaClientSecret } = await chrome.storage.local.get('figmaClientSecret');
    if (!figmaClientSecret) {
      throw new Error('Client Secret не найден. Пожалуйста, настройте расширение.');
    }
    
    const redirectUri = 'https://pgmarchenko.github.io/cjm-2-figma-chrome-extension/oauth.html';
    
    console.log('Making request to Figma OAuth endpoint...');
    const response = await fetch('https://www.figma.com/api/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: figmaClientSecret,
        redirect_uri: redirectUri,
        code: code,
        grant_type: 'authorization_code'
      })
    });

    console.log('Response status:', response.status);
    const responseText = await response.text();
    console.log('Response text:', responseText);

    if (!response.ok) {
      throw new Error(`Ошибка при получении токена: ${response.status} ${responseText}`);
    }

    const data = JSON.parse(responseText);
    console.log('Parsed response:', data);
    
    // Сохраняем токен
    console.log('Saving access token...');
    await chrome.storage.local.set({ 'figmaAccessToken': data.access_token });
    console.log('Access token saved successfully');
    
    return data;
  } catch (error) {
    console.error('Error in getFigmaToken:', error);
    throw new Error(`Ошибка при получении токена: ${error.message}`);
  }
}

// Загрузка изображения в Figma
async function uploadToFigma(imageData, fileName) {
  try {
    // Получаем токен доступа из storage
    const { figmaAccessToken } = await chrome.storage.local.get('figmaAccessToken');
    if (!figmaAccessToken) {
      throw new Error('Не найден токен доступа Figma');
    }

    // Создаем новый файл в Figma
    const createFileResponse = await fetch('https://api.figma.com/v1/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${figmaAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: fileName
      })
    });

    if (!createFileResponse.ok) {
      throw new Error('Ошибка при создании файла в Figma');
    }

    const fileData = await createFileResponse.json();
    const fileKey = fileData.key;

    // Конвертируем base64 в бинарные данные
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const binaryData = atob(base64Data);
    const byteArray = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      byteArray[i] = binaryData.charCodeAt(i);
    }

    // Загружаем изображение как ассет
    const formData = new FormData();
    const blob = new Blob([byteArray], { type: 'image/png' });
    formData.append('image', blob);

    const uploadResponse = await fetch(`https://api.figma.com/v1/files/${fileKey}/images`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${figmaAccessToken}`
      },
      body: formData
    });

    if (!uploadResponse.ok) {
      throw new Error('Ошибка при загрузке изображения в Figma');
    }

    const uploadData = await uploadResponse.json();
    const imageUrl = uploadData.url;

    // Создаем фрейм с изображением
    const createImageResponse = await fetch(`https://api.figma.com/v1/files/${fileKey}/nodes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${figmaAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        nodes: [{
          type: 'FRAME',
          size: { width: 800, height: 600 },
          fills: [{
            type: 'IMAGE',
            scaleMode: 'FIT',
            imageUrl: imageUrl
          }]
        }]
      })
    });

    if (!createImageResponse.ok) {
      throw new Error('Ошибка при создании изображения в Figma');
    }

    const createImageData = await createImageResponse.json();
    
    return {
      success: true,
      fileUrl: `https://www.figma.com/file/${fileKey}`,
      fileData: createImageData
    };
  } catch (error) {
    throw new Error(`Ошибка при работе с Figma API: ${error.message}`);
  }
}

// Получение списка файлов Figma
async function getFigmaFiles() {
  try {
    const { figmaAccessToken } = await chrome.storage.local.get('figmaAccessToken');
    if (!figmaAccessToken) {
      throw new Error('Не найден токен доступа Figma');
    }

    // Получаем список файлов через Figma API
    const response = await fetch('https://api.figma.com/v1/me/files', {
      headers: {
        'Authorization': `Bearer ${figmaAccessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Ошибка API Figma: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      files: data.files
    };
  } catch (error) {
    console.error('Ошибка при получении списка файлов:', error);
    return {
      success: false,
      error: error.message
    };
  }
} 