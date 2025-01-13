document.addEventListener('DOMContentLoaded', function() {
  const statusDiv = document.getElementById('status');
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  const error = urlParams.get('error');

  if (error) {
    statusDiv.textContent = `Ошибка авторизации: ${error}`;
    statusDiv.classList.add('error');
    return;
  }

  if (!code) {
    statusDiv.textContent = 'Ошибка: не получен код авторизации';
    statusDiv.classList.add('error');
    return;
  }

  // Сохраняем код авторизации
  chrome.storage.local.set({ 'figmaAuthCode': code }, () => {
    // Отправляем сообщение в background script для получения токена
    chrome.runtime.sendMessage({
      action: 'getFigmaToken',
      code: code
    }, (response) => {
      if (response && response.success) {
        statusDiv.textContent = 'Авторизация успешно завершена!';
        statusDiv.classList.add('success');
        
        // Закрываем окно через 2 секунды
        setTimeout(() => {
          window.close();
        }, 2000);
      } else {
        statusDiv.textContent = 'Ошибка при получении токена доступа';
        statusDiv.classList.add('error');
      }
    });
  });
}); 