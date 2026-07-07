"use client";

import { createContext, useContext, useEffect, useState } from "react"
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth"
import { auth, googleProvider } from "@/lib/firebase"

interface AuthContextValue {
  user: User | null
  loading: boolean
  signIn: () => Promise<void>
  signOutUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signIn: async () => {},
  signOutUser: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u)
        setLoading(false)
      }),
    []
  )

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err: any) {
      if (err?.code !== "auth/popup-closed-by-user") {
        console.error("Google sign-in failed:", err)
        throw err
      }
    }
  }

  const signOutUser = async () => {
    await signOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOutUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
