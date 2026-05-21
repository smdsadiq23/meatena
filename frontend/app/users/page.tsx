"use client";

import { startTransition, useEffect, useEffectEvent, useState } from "react";
import { apiFetch, fetchJson, getAuthUser } from "../../lib/auth";

type User = {
  id: number;
  username: string;
  role: "admin" | "staff";
};

const emptyForm = {
  username: "",
  password: "",
  role: "staff" as "admin" | "staff",
};

export default function UsersPage() {
  const authUser = getAuthUser();
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const loadUsersInternal = async () => {
    try {
      const data = await fetchJson<User[]>("/users");
      startTransition(() => {
        setUsers(Array.isArray(data) ? data : []);
      });
    } catch {
      startTransition(() => {
        setStatus("Could not load users.");
      });
    }
  };

  const loadUsersEffect = useEffectEvent(() => {
    void loadUsersInternal();
  });

  useEffect(() => {
    if (authUser?.role === "admin") {
      loadUsersEffect();
    }
  }, [authUser?.role]);

  if (authUser?.role !== "admin") {
    return (
      <div className="panel p-8">
        <p className="soft-label">Restricted</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          Admin access required
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Only admin users can create staff accounts and review role assignments.
        </p>
      </div>
    );
  }

  const createUser = async () => {
    if (!form.username.trim() || form.password.length < 6) {
      setStatus("Username and a 6 character password are required.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const response = await apiFetch("/users", {
        method: "POST",
        body: JSON.stringify({
          username: form.username.trim(),
          password: form.password,
          role: form.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus(data.message ?? "Could not create user.");
        return;
      }

      setForm(emptyForm);
      setStatus(`User ${data.username} created successfully.`);
      await loadUsersInternal();
    } catch {
      setStatus("Could not create user.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="panel p-6 md:p-8">
        <p className="soft-label">User Management</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          Create staff and admin accounts
        </h1>

        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void createUser();
          }}
        >
          <input
            className="field"
            placeholder="Username"
            value={form.username}
            onChange={(e) => setForm((current) => ({ ...current, username: e.target.value }))}
            autoComplete="username"
          />
          <input
            type="password"
            className="field"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))}
            autoComplete="new-password"
          />
          <select
            className="field"
            value={form.role}
            onChange={(e) =>
              setForm((current) => ({
                ...current,
                role: e.target.value as "admin" | "staff",
              }))
            }
          >
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>

          {status ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {status}
            </div>
          ) : null}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Saving..." : "Create User"}
          </button>
        </form>
      </section>

      <section className="panel p-6 md:p-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-950">Current Users</h2>
          <div className="status-pill bg-black/5 text-slate-700">
            {users.length} user{users.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="space-y-3">
          {users.map((user) => (
            <div key={user.id} className="rounded-3xl border border-black/8 bg-white px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-bold text-slate-950">{user.username}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                    User #{user.id}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-700">
                  {user.role}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
