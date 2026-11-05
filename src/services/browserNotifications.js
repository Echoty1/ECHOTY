// src/services/browserNotifications.js

export const requestBrowserNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.log('This browser does not support desktop notification');
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

export const sendBrowserNotification = (senderName, messageText, chatId) => {
  if (Notification.permission === 'granted') {
    const notif = new Notification(senderName || 'New Message', {
      body: messageText || 'You received a new message',
      icon: '/favicon-96x96.png', // Your app icon
      tag: chatId, // Groups notifications from the same chat
    });

    // When the user clicks the notification, focus the window and open the chat
    notif.onclick = function(event) {
      event.preventDefault(); 
      window.focus(); 
      window.location.href = `/chat/${chatId}`; 
      notif.close();
    };
  }
};
