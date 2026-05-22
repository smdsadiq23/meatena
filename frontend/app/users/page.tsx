"use client";

import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";
import { apiFetch, clearToken, fetchJson, getAuthUser } from "../../lib/auth";

type UserRole = "admin" | "staff";

type User = {
  id: number;
  username: string;
  role: UserRole;
};

type UpdateUserResponse = User & {
  requiresRelogin?: boolean;
};

const emptyCreateForm = {
  username: "",
  password: "",
  role: "staff" as UserRole,
};

const emptyEditForm = {
  username: "",
  password: "",
  role: "staff" as UserRole,
};

export default function UsersPage() {
  const authUser = getAuthUser();
  const [users, setUsers] = useState<User[]>([]);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(false);

  const selectedUser = users.find((user) => user.id === editingUserId) ?? null;
  const adminCount = useMemo(
    () => users.filter((user) => user.role === "admin").length,
    [users],
  );

  const showStatus = (message: string, tone: "success" | "error" = "success") => {
    setStatus(message);
    setStatusTone(tone);
  };

  const loadUsersInternal = async () => {
    try {
      const data = await fetchJson<User[]>("/users");
      startTransition(() => {
        setUsers(Array.isArray(data) ? data : []);
      });
    } catch {
      startTransition(() => {
        showStatus("Could not load users.", "error");
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
        <h1 className="mt-2 text-3xl font-black tracking-normal text-slate-950">
          Admin access required
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Only admin users can create staff accounts and review role assignments.
        </p>
      </div>
    );
  }

  const createUser = async () => {
    if (!createForm.username.trim() || createForm.password.length < 6) {
      showStatus("Username and a 6 character password are required.", "error");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const response = await apiFetch("/users", {
        method: "POST",
        body: JSON.stringify({
          username: createForm.username.trim(),
          password: createForm.password,
          role: createForm.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        showStatus(data.message ?? "Could not create user.", "error");
        return;
      }

      setCreateForm(emptyCreateForm);
      showStatus(`User ${data.username} created successfully.`);
      await loadUsersInternal();
    } catch {
      showStatus("Could not create user.", "error");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (user: User) => {
    setEditingUserId(user.id);
    setEditForm({
      username: user.username,
      password: "",
      role: user.role,
    });
    setStatus("");
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setEditForm(emptyEditForm);
  };

  const updateUser = async () => {
    if (!selectedUser) {
      return;
    }

    if (!editForm.username.trim()) {
      showStatus("Username is required.", "error");
      return;
    }

    if (editForm.password && editForm.password.length < 6) {
      showStatus("New password must be at least 6 characters.", "error");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const payload: {
        username: string;
        role: UserRole;
        password?: string;
      } = {
        username: editForm.username.trim(),
        role: editForm.role,
      };

      if (editForm.password) {
        payload.password = editForm.password;
      }

      const response = await apiFetch(`/users/${selectedUser.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as UpdateUserResponse & { message?: string };

      if (!response.ok) {
        showStatus(data.message ?? "Could not update user.", "error");
        return;
      }

      cancelEdit();
      await loadUsersInternal();

      if (data.requiresRelogin) {
        clearToken();
        window.location.href = "/login";
        return;
      }

      showStatus(`User ${data.username} updated successfully.`);
    } catch {
      showStatus("Could not update user.", "error");
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (user: User) => {
    if (authUser?.sub === user.id) {
      showStatus("You cannot delete your own account.", "error");
      return;
    }

    if (user.role === "admin" && adminCount <= 1) {
      showStatus("At least one admin user is required.", "error");
      return;
    }

    const confirmed = window.confirm(`Delete user ${user.username}? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const response = await apiFetch(`/users/${user.id}`, { method: "DELETE" });
      const data = await response.json();

      if (!response.ok) {
        showStatus(data.message ?? "Could not delete user.", "error");
        return;
      }

      if (editingUserId === user.id) {
        cancelEdit();
      }

      showStatus(`User ${user.username} deleted.`);
      await loadUsersInternal();
    } catch {
      showStatus("Could not delete user.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="panel p-6 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="soft-label">User Management</p>
            <h1 className="mt-2 text-3xl font-black tracking-normal text-slate-950 md:text-4xl">
              Manage staff and admin access
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              Create accounts, change roles, reset passwords, and remove users from one place.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:w-[320px]">
            <div className="rounded-3xl bg-slate-950 px-5 py-4 text-white">
              <p className="soft-label text-white/55">Users</p>
              <p className="mt-2 text-3xl font-black">{users.length}</p>
            </div>
            <div className="rounded-3xl bg-red-50 px-5 py-4 text-red-700">
              <p className="soft-label text-red-500">Admins</p>
              <p className="mt-2 text-3xl font-black">{adminCount}</p>
            </div>
          </div>
        </div>

        {status ? (
          <div
            className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-semibold ${
              statusTone === "success"
                ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                : "border-red-100 bg-red-50 text-red-700"
            }`}
          >
            {status}
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="panel p-6 md:p-8">
          <p className="soft-label">Create Account</p>
          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void createUser();
            }}
          >
            <input
              className="field"
              placeholder="Username"
              value={createForm.username}
              onChange={(e) =>
                setCreateForm((current) => ({ ...current, username: e.target.value }))
              }
              autoComplete="username"
            />
            <input
              type="password"
              className="field"
              placeholder="Temporary password"
              value={createForm.password}
              onChange={(e) =>
                setCreateForm((current) => ({ ...current, password: e.target.value }))
              }
              autoComplete="new-password"
            />
            <div className="grid grid-cols-2 gap-3">
              {(["staff", "admin"] as UserRole[]).map((role) => (
                <button
                  key={role}
                  type="button"
                  className={`rounded-2xl border px-4 py-4 text-sm font-black uppercase tracking-[0.14em] ${
                    createForm.role === role
                      ? "border-red-600 bg-red-600 text-white"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                  onClick={() => setCreateForm((current) => ({ ...current, role }))}
                >
                  {role}
                </button>
              ))}
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Saving..." : "Create User"}
            </button>
          </form>
        </section>

        <section className="panel p-6 md:p-8">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="soft-label">Directory</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Current users</h2>
            </div>
            <button className="btn-secondary px-5" onClick={() => void loadUsersInternal()}>
              Refresh
            </button>
          </div>

          <div className="space-y-3">
            {users.map((user) => {
              const isSelf = authUser?.sub === user.id;
              const isEditing = editingUserId === user.id;
              const cannotDelete = isSelf || (user.role === "admin" && adminCount <= 1);

              return (
                <div key={user.id} className="rounded-3xl border border-black/8 bg-white p-5">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-[1fr_160px]">
                        <input
                          className="field"
                          placeholder="Username"
                          value={editForm.username}
                          onChange={(e) =>
                            setEditForm((current) => ({
                              ...current,
                              username: e.target.value,
                            }))
                          }
                        />
                        <select
                          className="field"
                          value={editForm.role}
                          onChange={(e) =>
                            setEditForm((current) => ({
                              ...current,
                              role: e.target.value as UserRole,
                            }))
                          }
                        >
                          <option value="staff">Staff</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <input
                        type="password"
                        className="field"
                        placeholder="New password (leave blank to keep current)"
                        value={editForm.password}
                        onChange={(e) =>
                          setEditForm((current) => ({
                            ...current,
                            password: e.target.value,
                          }))
                        }
                        autoComplete="new-password"
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={loading}
                          onClick={() => void updateUser()}
                        >
                          Save Changes
                        </button>
                        <button type="button" className="btn-secondary" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </div>
                      {isSelf ? (
                        <p className="text-sm font-semibold text-slate-500">
                          Updating your own account will ask you to log in again.
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="text-2xl font-black text-slate-950">{user.username}</p>
                          {isSelf ? (
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                              You
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                          User #{user.id}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black uppercase tracking-[0.14em] text-slate-700">
                          {user.role}
                        </span>
                        <button
                          type="button"
                          className="rounded-2xl bg-slate-950 px-5 py-3 font-bold text-white"
                          onClick={() => startEdit(user)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="rounded-2xl bg-red-600 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                          disabled={loading || cannotDelete}
                          onClick={() => void deleteUser(user)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
