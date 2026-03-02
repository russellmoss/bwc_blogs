"use client";

import { signIn } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

function PasswordField({ id, value, onChange, placeholder, minLength }: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        required
        minLength={minLength}
        className="w-full px-3 py-2 pr-10 border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-stone-500 focus:border-transparent"
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
        tabIndex={-1}
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function SetupForm({ onComplete }: { onComplete: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password }),
      });
      const data = await res.json();

      if (data.success) {
        onComplete();
      } else {
        setError(data.error?.message || "Setup failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white p-8 rounded-lg shadow-sm border border-stone-200">
        <h1 className="text-2xl font-semibold text-stone-900 mb-1">
          BWC Content Engine
        </h1>
        <p className="text-sm text-stone-500 mb-6">
          Create your first account to get started
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="setup-email" className="block text-sm font-medium text-stone-700 mb-1">
              Email
            </label>
            <input
              id="setup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-stone-500 focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="setup-name" className="block text-sm font-medium text-stone-700 mb-1">
              Name
            </label>
            <input
              id="setup-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-stone-500 focus:border-transparent"
              placeholder="Your name"
            />
          </div>

          <div>
            <label htmlFor="setup-password" className="block text-sm font-medium text-stone-700 mb-1">
              Password
            </label>
            <PasswordField
              id="setup-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              placeholder="Min 8 characters"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-stone-900 text-white text-sm font-medium rounded-md hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white p-8 rounded-lg shadow-sm border border-stone-200">
        <h1 className="text-2xl font-semibold text-stone-900 mb-1">
          BWC Content Engine
        </h1>
        <p className="text-sm text-stone-500 mb-6">
          Sign in to manage content
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-stone-700 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-stone-500 focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-stone-700 mb-1"
            >
              Password
            </label>
            <PasswordField
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-stone-900 text-white text-sm font-medium rounded-md hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/setup")
      .then((res) => res.json())
      .then((data) => {
        setNeedsSetup(data.success ? data.data.needsSetup : false);
      })
      .catch(() => {
        setNeedsSetup(false);
      });
  }, []);

  // Still checking
  if (needsSetup === null) {
    return (
      <div className="w-full max-w-sm">
        <div className="bg-white p-8 rounded-lg shadow-sm border border-stone-200 text-center">
          <p className="text-sm text-stone-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (needsSetup) {
    return <SetupForm onComplete={() => setNeedsSetup(false)} />;
  }

  return <LoginForm />;
}
