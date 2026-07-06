import { initializeApp, getApps } from "firebase/app"
import { getAuth, GoogleAuthProvider } from "firebase/auth"

// Firebase web config is public by design (security comes from Firebase rules
// and backend token verification, not from hiding these values).
const firebaseConfig = {
  apiKey: "AIzaSyCwHNrr5_EiYdNQLzwHTDyAJvJYZc98-Tk",
  authDomain: "hackathon-501607.firebaseapp.com",
  projectId: "hackathon-501607",
  storageBucket: "hackathon-501607.firebasestorage.app",
  messagingSenderId: "859933805639",
  appId: "1:859933805639:web:cd0e6b059990353bfc7562",
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
