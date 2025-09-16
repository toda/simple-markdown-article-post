import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, GithubAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  // TODO: Firebaseプロジェクトの設定情報をここに入力
  apiKey: "AIzaSyBJx09CTRsY69i6twPleobUxI80p_pW2gY",
  authDomain: "first-a8d80.firebaseapp.com",
  projectId: "first-a8d80",
  storageBucket: "first-a8d80.firebasestorage.app",
  messagingSenderId: "985235683664",
  appId: "1:985235683664:web:833fcd361d74600bd85455",
};

// Firebase初期化
const app = initializeApp(firebaseConfig);

// Auth設定
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();

// Firestore設定
export const db = getFirestore(app);

export default app;
