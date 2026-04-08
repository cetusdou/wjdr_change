<script type="module">
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyDhHs7kZ7KXpBvKZOEMd3zK1Es2ruI2c_0",
    authDomain: "wjdr-change.firebaseapp.com",
    projectId: "wjdr-change",
    storageBucket: "wjdr-change.firebasestorage.app",
    messagingSenderId: "618241342586",
    appId: "1:618241342586:web:93e1ac94ed8dac096f4fc3",
    measurementId: "G-F263PF0VKP"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
</script>