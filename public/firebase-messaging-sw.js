// This file must live in the /public folder so it's served at the root of your site.
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBJ7v2WgWy5b-kf26g9be-AV1lxwgUZ79k",
  authDomain: "chalkline-a2023.firebaseapp.com",
  projectId: "chalkline-a2023",
  storageBucket: "chalkline-a2023.firebasestorage.app",
  messagingSenderId: "277834389268",
  appId: "1:277834389268:web:e277162c9300af29929401",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "Chalkline";
  const options = {
    body: payload.notification?.body || "You have an assignment update.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
  };
  self.registration.showNotification(title, options);
});
