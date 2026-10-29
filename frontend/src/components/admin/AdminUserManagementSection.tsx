import React, { useState, useEffect } from "react";
import { api } from "../../services/api";
import { Badge } from "../ui/Badge";
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Shield,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Trash2,
  Edit2,
  Eye,
  RefreshCw,
  Clock,
  Building2,
  Truck,
  Recycle,
  Briefcase,
  Key,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  UserCheck,
  Fingerprint,
} from "lucide-react";

interface UserItem {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  employeeId: string | null;
  phone?: string;
  organization?: string;
  facility?: { id: string; name: string; code?: string } | null;
  lastLoginAt: string | null;
  isArchived: boolean;
  archivedAt: string | null;
  statusReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export const AdminUserManagementSection: React.FC = () => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [candidateIdQuery, setCandidateIdQuery] = useState("");
  const [candidateLookupLoading, setCandidateLookupLoading] = useState(false);
  const [candidateLookupError, setCandidateLookupError] = useState<string | null>(null);

  // Facilities list for assignment
  const [facilities, setFacilities] = useState<any[]>([]);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Active user selection for modals
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [profileDetails, setProfileDetails] = useState<any | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Form states
  const [addForm, setAddForm] = useState({
    fullName: "",
    email: "",
    role: "WORKER",
    employeeId: "",
    password: "",
    phone: "",
    organization: "",
    facilityId: "",
    status: "APPROVED",
  });
  const [editForm, setEditForm] = useState({
    fullName: "",
    employeeId: "",
    phone: "",
    organization: "",
    facilityId: "",
  });
  const [roleForm, setRoleForm] = useState({
    newRole: "WORKER",
    reason: "",
  });
  const [statusForm, setStatusForm] = useState({
    newStatus: "SUSPENDED",
    reason: "",
  });
  const [archiveReason, setArchiveReason] = useState("");

  // Notifications / Feedback
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [tempPasswordNotice, setTempPasswordNotice] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
    loadFacilities();
  }, [page, roleFilter, statusFilter]);

  const loadFacilities = async () => {
    try {
      const res = await api.getFacilities();
      if (res.success && res.facilities) {
        setFacilities(res.facilities);
      }
    } catch (err) {
      console.warn("Could not load facilities:", err);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    setActionError(null);
    try {
      const res = await api.getUsers({
        search: search.trim() || undefined,
        role: roleFilter !== "ALL" ? roleFilter : undefined,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        page,
        limit,
      });

      if (res.success) {
        setUsers(res.users);
        setTotal(res.total || res.users.length);
        setTotalPages(res.totalPages || Math.ceil((res.total || res.users.length) / limit));
      } else {
        setActionError(res.error || "Failed to load user accounts.");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to load user list.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadUsers();
  };

  // Candidate / Employee ID Lookup
  const handleCandidateLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateIdQuery.trim()) return;

    setCandidateLookupLoading(true);
    setCandidateLookupError(null);
    try {
      const res = await api.lookupEmployeeId(candidateIdQuery.trim());
      if (res.success && res.user) {
        handleOpenProfile(res.user);
        setCandidateIdQuery("");
      } else {
        setCandidateLookupError(res.error || `No candidate/employee found with ID '${candidateIdQuery}'.`);
      }
    } catch (err: any) {
      setCandidateLookupError(err.message || `No candidate/employee found with ID '${candidateIdQuery}'.`);
    } finally {
      setCandidateLookupLoading(false);
    }
  };

  // Open Full Profile View Modal
  const handleOpenProfile = async (u: any) => {
    setSelectedUser(u);
    setShowProfileModal(true);
    setProfileLoading(true);
    try {
      const res = await api.getUserProfile(u.id);
      if (res.success) {
        setProfileDetails(res);
      }
    } catch (err) {
      console.error("Failed to load user profile:", err);
    } finally {
      setProfileLoading(false);
    }
  };

  // Open Edit Details Modal
  const handleOpenEdit = (u: UserItem) => {
    setSelectedUser(u);
    setEditForm({
      fullName: u.fullName || "",
      employeeId: u.employeeId || "",
      phone: u.phone || "",
      organization: u.organization || "",
      facilityId: u.facility?.id || "",
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  // Open Change Role Modal
  const handleOpenRole = (u: UserItem) => {
    setSelectedUser(u);
    setRoleForm({
      newRole: u.role,
      reason: "",
    });
    setFormErrors({});
    setShowRoleModal(true);
  };

  // Open Status Change Modal
  const handleOpenStatus = (u: UserItem, targetStatus?: string) => {
    setSelectedUser(u);
    setStatusForm({
      newStatus: targetStatus || (u.status === "APPROVED" ? "SUSPENDED" : "APPROVED"),
      reason: "",
    });
    setFormErrors({});
    setShowStatusModal(true);
  };

  // Open Archive Modal
  const handleOpenArchive = (u: UserItem) => {
    setSelectedUser(u);
    setArchiveReason("");
    setFormErrors({});
    setShowArchiveModal(true);
  };

  // Submit Add User
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setSubmitting(true);
    setActionError(null);
    setTempPasswordNotice(null);

    const errors: Record<string, string> = {};
    if (!addForm.fullName.trim() || addForm.fullName.trim().length < 2) {
      errors.fullName = "Full name must be at least 2 characters.";
    }
    if (!addForm.email.trim() || !addForm.email.includes("@")) {
      errors.email = "Please enter a valid email address.";
    }
    if (addForm.password && addForm.password.length < 6) {
      errors.password = "Password must be at least 6 characters.";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setSubmitting(false);
      return;
    }

    try {
      const res = await api.createUser({
        fullName: addForm.fullName.trim(),
        email: addForm.email.trim(),
        role: addForm.role,
        employeeId: addForm.employeeId.trim() || undefined,
        password: addForm.password.trim() || undefined,
        phone: addForm.phone.trim() || undefined,
        organization: addForm.organization.trim() || undefined,
        facilityId: addForm.facilityId || undefined,
        status: addForm.status,
      });

      if (res.success) {
        setShowAddModal(false);
        setActionSuccess(`User '${addForm.fullName}' created successfully!`);
        if (res.temporaryPassword) {
          setTempPasswordNotice(`Temporary credentials: ${addForm.email} / ${res.temporaryPassword}`);
        }
        setAddForm({
          fullName: "",
          email: "",
          role: "WORKER",
          employeeId: "",
          password: "",
          phone: "",
          organization: "",
          facilityId: "",
          status: "APPROVED",
        });
        loadUsers();
      } else {
        setActionError(res.error || "Failed to create user.");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to create user.");
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Edit User
  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setFormErrors({});
    setSubmitting(true);
    setActionError(null);

    try {
      const res = await api.updateUserDetails(selectedUser.id, {
        fullName: editForm.fullName.trim(),
        employeeId: editForm.employeeId.trim() || undefined,
        phone: editForm.phone.trim() || undefined,
        organization: editForm.organization.trim() || undefined,
        facilityId: editForm.facilityId || undefined,
      });

      if (res.success) {
        setShowEditModal(false);
        setActionSuccess(`User details for '${selectedUser.email}' updated successfully!`);
        loadUsers();
      } else {
        setActionError(res.error || "Failed to update user details.");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to update user details.");
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Role Change
  const handleRoleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSubmitting(true);
    setActionError(null);

    try {
      const res = await api.updateUserRole(
        selectedUser.id,
        roleForm.newRole,
        roleForm.reason.trim() || "Role updated by Administrator"
      );

      if (res.success) {
        setShowRoleModal(false);
        setActionSuccess(`Role for '${selectedUser.fullName}' changed to ${roleForm.newRole}.`);
        loadUsers();
      } else {
        setActionError(res.error || "Failed to change user role.");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to change user role.");
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Status Change (Activate/Deactivate/Suspend)
  const handleStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSubmitting(true);
    setActionError(null);

    try {
      const res = await api.updateUserStatus(
        selectedUser.id,
        statusForm.newStatus,
        statusForm.reason.trim() || "Status changed by Administrator"
      );

      if (res.success) {
        setShowStatusModal(false);
        setActionSuccess(`Status for '${selectedUser.fullName}' updated to ${statusForm.newStatus}.`);
        loadUsers();
      } else {
        setActionError(res.error || "Failed to update account status.");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to update account status.");
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Archive User
  const handleArchiveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSubmitting(true);
    setActionError(null);

    try {
      const res = await api.deleteUser(
        selectedUser.id,
        archiveReason.trim() || "Account archived by Administrator"
      );

      if (res.success) {
        setShowArchiveModal(false);
        setActionSuccess(`User '${selectedUser.fullName}' archived. Historical provenance records preserved.`);
        loadUsers();
      } else {
        setActionError(res.error || "Failed to archive user.");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to archive user.");
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleBadgeStyle = (r: string) => {
    switch (r) {
      case "ADMIN":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "DEALER":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "DRIVER":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "FACTORY":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "WORKER":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "CUSTOMER":
        return "bg-teal-50 text-teal-700 border-teal-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const getStatusBadgeStyle = (s: string, isArchived: boolean) => {
    if (isArchived || s === "ARCHIVED") {
      return "bg-slate-100 text-slate-700 border-slate-300";
    }
    switch (s) {
      case "APPROVED":
        return "bg-[#E5F5EA] text-[#075B46] border-[#D7E5DB]";
      case "PENDING":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "SUSPENDED":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "INACTIVE":
        return "bg-gray-100 text-gray-700 border-gray-300";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-[#D7E5DB] shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-[#EDF7EF] flex items-center justify-center border border-[#D7E5DB]">
                <Users className="w-5 h-5 text-[#075B46]" />
              </div>
              <h2 className="text-xl font-serif font-bold text-[#173C32]">Admin User Management &amp; RBAC</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB] font-semibold">
                {total} Total Accounts
              </span>
            </div>
            <p className="text-xs text-[#6B7C74] mt-1 font-sans">
              Manage system users, employee IDs, role authorizations, activation states, and security audit logs across EcoTrace.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#075B46] hover:bg-[#064e3b] text-white text-xs font-semibold shadow-sm transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add New User</span>
            </button>
            <button
              onClick={loadUsers}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#EDF7EF] hover:bg-[#E5F5EA] text-[#075B46] text-xs font-semibold border border-[#D7E5DB] shadow-sm transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Global Action Notifications */}
        {actionSuccess && (
          <div className="mt-4 p-3 rounded-xl bg-[#E5F5EA] border border-[#D7E5DB] text-[#075B46] text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="font-semibold">{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess(null)} className="text-[#075B46] hover:opacity-75">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {tempPasswordNotice && (
          <div className="mt-2 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 shrink-0 text-blue-600" />
              <span className="font-mono font-semibold">{tempPasswordNotice}</span>
            </div>
            <button onClick={() => setTempPasswordNotice(null)} className="text-blue-700 hover:opacity-75">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {actionError && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span className="font-semibold">{actionError}</span>
            </div>
            <button onClick={() => setActionError(null)} className="text-rose-700 hover:opacity-75">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Search, Filter & Quick Lookup Bar */}
        <div className="mt-6 pt-5 border-t border-[#D7E5DB] grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Main User Search */}
          <form onSubmit={handleSearchSubmit} className="md:col-span-5 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7C74]" />
            <input
              type="text"
              placeholder="Search by Name, Email, Organization..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB] text-xs text-[#173C32] placeholder-[#6B7C74]/70 focus:outline-none focus:border-[#075B46]"
            />
          </form>

          {/* Role Filter */}
          <div className="md:col-span-2">
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB] text-xs text-[#173C32] focus:outline-none focus:border-[#075B46]"
            >
              <option value="ALL">All Roles</option>
              <option value="ADMIN">Admin</option>
              <option value="DEALER">Dealer / Collector</option>
              <option value="DRIVER">Driver / Transporter</option>
              <option value="FACTORY">Factory Staff</option>
              <option value="WORKER">Worker</option>
              <option value="CUSTOMER">Customer</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="md:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB] text-xs text-[#173C32] focus:outline-none focus:border-[#075B46]"
            >
              <option value="ALL">All Statuses</option>
              <option value="APPROVED">Active (Approved)</option>
              <option value="PENDING">Pending Review</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="INACTIVE">Deactivated (Inactive)</option>
              <option value="ARCHIVED">Archived (Soft Deleted)</option>
            </select>
          </div>

          {/* Candidate / Employee ID Direct Lookup */}
          <form onSubmit={handleCandidateLookup} className="md:col-span-3 relative flex gap-1.5">
            <div className="relative flex-1">
              <Fingerprint className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B7C74]" />
              <input
                type="text"
                placeholder="Lookup ID (e.g. WRK-001)"
                value={candidateIdQuery}
                onChange={(e) => setCandidateIdQuery(e.target.value)}
                className="w-full pl-8 pr-2 py-2 rounded-xl bg-[#EDF7EF]/60 border border-[#D7E5DB] text-xs font-mono text-[#173C32] placeholder-[#6B7C74]/70 focus:outline-none focus:border-[#075B46]"
              />
            </div>
            <button
              type="submit"
              disabled={candidateLookupLoading || !candidateIdQuery.trim()}
              className="px-3 py-2 rounded-xl bg-[#173C32] hover:bg-[#122e26] text-white text-xs font-semibold shrink-0 disabled:opacity-50 transition-all"
            >
              {candidateLookupLoading ? "..." : "Lookup"}
            </button>
          </form>
        </div>

        {candidateLookupError && (
          <div className="mt-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2 rounded-lg font-mono">
            {candidateLookupError}
          </div>
        )}
      </div>

      {/* Main Users Table Card */}
      <div className="bg-white rounded-2xl border border-[#D7E5DB] shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-[#6B7C74] flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-[#075B46]" />
            <span>Loading user accounts from database...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#6B7C74] flex flex-col items-center justify-center gap-2">
            <Users className="w-8 h-8 text-[#6B7C74]/40" />
            <span className="font-semibold text-[#173C32]">No users found matching current filters</span>
            <p className="text-[11px] text-[#6B7C74]">Try clearing search parameters or reset role/status filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#EDF7EF] text-[#6B7C74] uppercase font-mono text-[10px]">
                <tr>
                  <th className="p-3.5">Candidate / Employee ID</th>
                  <th className="p-3.5">User Name &amp; Email</th>
                  <th className="p-3.5">Assigned Role</th>
                  <th className="p-3.5">Facility / Org</th>
                  <th className="p-3.5">Account Status</th>
                  <th className="p-3.5">Registered</th>
                  <th className="p-3.5">Last Login</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D7E5DB]">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-[#F7FBF7] transition-colors">
                    {/* Employee / Candidate ID */}
                    <td className="p-3.5">
                      {u.employeeId ? (
                        <span className="px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-[#EDF7EF] text-[#075B46] border border-[#D7E5DB]">
                          {u.employeeId}
                        </span>
                      ) : (
                        <span className="text-[#6B7C74]/50 font-mono text-[11px]">Unassigned</span>
                      )}
                    </td>

                    {/* Name & Email */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#E5F5EA] text-[#075B46] font-bold text-xs flex items-center justify-center border border-[#D7E5DB]">
                          {u.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-[#173C32]">{u.fullName}</div>
                          <div className="text-[11px] font-mono text-[#6B7C74]">{u.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="p-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${getRoleBadgeStyle(u.role)}`}>
                        {u.role}
                      </span>
                    </td>

                    {/* Facility / Org */}
                    <td className="p-3.5 text-[#6B7C74]">
                      {u.facility?.name || u.organization || "—"}
                    </td>

                    {/* Status */}
                    <td className="p-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${getStatusBadgeStyle(u.status, u.isArchived)}`}>
                        {u.isArchived ? "ARCHIVED" : u.status}
                      </span>
                    </td>

                    {/* Registration Date */}
                    <td className="p-3.5 text-[#6B7C74] font-mono text-[11px]">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>

                    {/* Last Login */}
                    <td className="p-3.5 text-[#6B7C74] font-mono text-[11px]">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never logged in"}
                    </td>

                    {/* Available Actions */}
                    <td className="p-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {/* View Profile */}
                        <button
                          onClick={() => handleOpenProfile(u)}
                          title="View Profile & Work Records"
                          className="p-1.5 rounded-lg bg-[#EDF7EF] hover:bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB] transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit Details */}
                        <button
                          onClick={() => handleOpenEdit(u)}
                          title="Edit User Details"
                          className="p-1.5 rounded-lg bg-[#EDF7EF] hover:bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB] transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Change Role */}
                        <button
                          onClick={() => handleOpenRole(u)}
                          title="Reassign Role"
                          className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-all"
                        >
                          <Shield className="w-3.5 h-3.5" />
                        </button>

                        {/* Status Toggle (Suspend / Activate) */}
                        <button
                          onClick={() => handleOpenStatus(u)}
                          title={u.status === "APPROVED" ? "Deactivate / Suspend Account" : "Activate / Approve Account"}
                          className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                            u.status === "APPROVED"
                              ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                              : "bg-[#E5F5EA] text-[#075B46] border-[#D7E5DB] hover:bg-[#EDF7EF]"
                          }`}
                        >
                          {u.status === "APPROVED" ? "Deactivate" : "Activate"}
                        </button>

                        {/* Archive / Delete Account */}
                        {!u.isArchived && (
                          <button
                            onClick={() => handleOpenArchive(u)}
                            title="Archive / Soft Delete Account"
                            className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-700 border border-slate-200 hover:border-rose-200 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-4 bg-[#F7FBF7] border-t border-[#D7E5DB] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6B7C74]">
          <div>
            Showing <span className="font-semibold text-[#173C32]">{users.length}</span> of{" "}
            <span className="font-semibold text-[#173C32]">{total}</span> total users (Page {page} of {totalPages || 1})
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-[#D7E5DB] text-[#173C32] disabled:opacity-40 hover:bg-[#EDF7EF] transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <span className="font-mono px-2">{page}</span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-[#D7E5DB] text-[#173C32] disabled:opacity-40 hover:bg-[#EDF7EF] transition-all"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 1: ADD NEW USER */}
      {/* ------------------------------------------------------------------- */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#D7E5DB] shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-5 bg-[#EDF7EF] border-b border-[#D7E5DB] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#075B46]" />
                <h3 className="font-serif font-bold text-base text-[#173C32]">Create New System Account</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-[#6B7C74] hover:text-[#173C32]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold text-[#173C32] mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={addForm.fullName}
                    onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
                    placeholder="e.g. Ramesh Chandra"
                    className="w-full px-3 py-2 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB] text-xs text-[#173C32] focus:outline-none focus:border-[#075B46]"
                  />
                  {formErrors.fullName && <p className="text-[11px] text-rose-600 mt-0.5">{formErrors.fullName}</p>}
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-[#173C32] mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    placeholder="e.g. ramesh@apexrecycling.com"
                    className="w-full px-3 py-2 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB] text-xs text-[#173C32] focus:outline-none focus:border-[#075B46]"
                  />
                  {formErrors.email && <p className="text-[11px] text-rose-600 mt-0.5">{formErrors.email}</p>}
                </div>

                <div>
                  <label className="block font-semibold text-[#173C32] mb-1">Role *</label>
                  <select
                    value={addForm.role}
                    onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB] text-xs text-[#173C32] focus:outline-none focus:border-[#075B46]"
                  >
                    <option value="WORKER">Worker (Recycling Workbench)</option>
                    <option value="DRIVER">Driver / Transporter</option>
                    <option value="DEALER">Dealer / Aggregator</option>
                    <option value="FACTORY">Factory Staff (Receiving)</option>
                    <option value="ADMIN">Administrator (Governance)</option>
                    <option value="CUSTOMER">Customer (Circular Marketplace)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#173C32] mb-1">Candidate / Employee ID</label>
                  <input
                    type="text"
                    value={addForm.employeeId}
                    onChange={(e) => setAddForm({ ...addForm, employeeId: e.target.value })}
                    placeholder="e.g. WRK-2026-0099"
                    className="w-full px-3 py-2 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB] text-xs font-mono text-[#173C32] focus:outline-none focus:border-[#075B46]"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-[#173C32] mb-1">
                    Password <span className="font-normal text-[#6B7C74]">(Optional; auto-generated if blank)</span>
                  </label>
                  <input
                    type="password"
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                    placeholder="Min 6 characters, or leave empty for auto-temp"
                    className="w-full px-3 py-2 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB] text-xs text-[#173C32] focus:outline-none focus:border-[#075B46]"
                  />
                  {formErrors.password && <p className="text-[11px] text-rose-600 mt-0.5">{formErrors.password}</p>}
                </div>

                <div>
                  <label className="block font-semibold text-[#173C32] mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB] text-xs text-[#173C32] focus:outline-none focus:border-[#075B46]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#173C32] mb-1">Initial Status</label>
                  <select
                    value={addForm.status}
                    onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB] text-xs text-[#173C32] focus:outline-none focus:border-[#075B46]"
                  >
                    <option value="APPROVED">Active (Approved)</option>
                    <option value="PENDING">Pending Approval</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#173C32] mb-1">Organization</label>
                  <input
                    type="text"
                    value={addForm.organization}
                    onChange={(e) => setAddForm({ ...addForm, organization: e.target.value })}
                    placeholder="e.g. Apex E-Waste Recycling Ltd"
                    className="w-full px-3 py-2 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB] text-xs text-[#173C32] focus:outline-none focus:border-[#075B46]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#173C32] mb-1">Assigned Facility</label>
                  <select
                    value={addForm.facilityId}
                    onChange={(e) => setAddForm({ ...addForm, facilityId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB] text-xs text-[#173C32] focus:outline-none focus:border-[#075B46]"
                  >
                    <option value="">None / Regional</option>
                    {facilities.map((f: any) => (
                      <option key={f.id || f._id} value={f.id || f._id}>
                        {f.name} ({f.code || "Hub"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-[#D7E5DB] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-[#075B46] hover:bg-[#064e3b] text-white font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 2: EDIT USER DETAILS */}
      {/* ------------------------------------------------------------------- */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#D7E5DB] shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 bg-[#EDF7EF] border-b border-[#D7E5DB] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-[#075B46]" />
                <h3 className="font-serif font-bold text-base text-[#173C32]">Edit User Details</h3>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-[#6B7C74] hover:text-[#173C32]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditUser} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#173C32] mb-1">Email (Immutable)</label>
                <input
                  type="text"
                  disabled
                  value={selectedUser.email}
                  className="w-full px-3 py-2 rounded-xl bg-gray-100 border border-gray-200 text-xs font-mono text-gray-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#173C32] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB] text-xs text-[#173C32] focus:outline-none focus:border-[#075B46]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#173C32] mb-1">Candidate / Employee ID</label>
                <input
                  type="text"
                  value={editForm.employeeId}
                  onChange={(e) => setEditForm({ ...editForm, employeeId: e.target.value })}
                  placeholder="e.g. WRK-2026-0042"
                  className="w-full px-3 py-2 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB] text-xs font-mono text-[#173C32] focus:outline-none focus:border-[#075B46]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#173C32] mb-1">Phone</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB] text-xs text-[#173C32] focus:outline-none focus:border-[#075B46]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#173C32] mb-1">Organization</label>
                <input
                  type="text"
                  value={editForm.organization}
                  onChange={(e) => setEditForm({ ...editForm, organization: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB] text-xs text-[#173C32] focus:outline-none focus:border-[#075B46]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#173C32] mb-1">Facility</label>
                <select
                  value={editForm.facilityId}
                  onChange={(e) => setEditForm({ ...editForm, facilityId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB] text-xs text-[#173C32] focus:outline-none focus:border-[#075B46]"
                >
                  <option value="">None / Regional</option>
                  {facilities.map((f: any) => (
                    <option key={f.id || f._id} value={f.id || f._id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-[#D7E5DB] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-[#075B46] hover:bg-[#064e3b] text-white font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 3: CHANGE USER ROLE */}
      {/* ------------------------------------------------------------------- */}
      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#D7E5DB] shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-700" />
                <h3 className="font-serif font-bold text-base text-blue-900">Reassign Account Role</h3>
              </div>
              <button onClick={() => setShowRoleModal(false)} className="text-blue-700 hover:text-blue-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRoleChange} className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB]">
                <div className="text-[11px] text-[#6B7C74]">Target Account:</div>
                <div className="font-semibold text-sm text-[#173C32]">{selectedUser.fullName}</div>
                <div className="font-mono text-[11px] text-[#6B7C74]">{selectedUser.email}</div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[11px] text-[#6B7C74]">Current Role:</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${getRoleBadgeStyle(selectedUser.role)}`}>
                    {selectedUser.role}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#173C32] mb-1">New Role *</label>
                <select
                  value={roleForm.newRole}
                  onChange={(e) => setRoleForm({ ...roleForm, newRole: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB] text-xs text-[#173C32] focus:outline-none focus:border-[#075B46]"
                >
                  <option value="ADMIN">Administrator (Governance &amp; Oversight)</option>
                  <option value="DEALER">Dealer / Collector (Batch Registration)</option>
                  <option value="DRIVER">Driver / Transporter (Carrier Logistics)</option>
                  <option value="FACTORY">Factory Staff (Weighmaster &amp; Receiving)</option>
                  <option value="WORKER">Worker (Recycling &amp; Mass Balance)</option>
                  <option value="CUSTOMER">Customer (Circular Marketplace)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#173C32] mb-1">
                  Reason for Role Change * <span className="font-normal text-[#6B7C74]">(Required for Audit Trail)</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={roleForm.reason}
                  onChange={(e) => setRoleForm({ ...roleForm, reason: e.target.value })}
                  placeholder="e.g. Promoted to Facility Supervisor; reassigned logistics duties..."
                  className="w-full px-3 py-2 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB] text-xs text-[#173C32] focus:outline-none focus:border-[#075B46]"
                />
              </div>

              {selectedUser.role === "ADMIN" && roleForm.newRole !== "ADMIN" && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <span>
                    Warning: Demoting an Administrator account will revoke high-privilege governance access. The system must retain at least one active Admin.
                  </span>
                </div>
              )}

              <div className="pt-4 border-t border-[#D7E5DB] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Role Change</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 4: ACTIVATE / DEACTIVATE ACCOUNT */}
      {/* ------------------------------------------------------------------- */}
      {showStatusModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#D7E5DB] shadow-xl w-full max-w-md overflow-hidden">
            <div className={`p-5 border-b flex items-center justify-between ${
              statusForm.newStatus === "APPROVED" ? "bg-[#EDF7EF] border-[#D7E5DB]" : "bg-rose-50 border-rose-200"
            }`}>
              <div className="flex items-center gap-2">
                {statusForm.newStatus === "APPROVED" ? (
                  <CheckCircle2 className="w-5 h-5 text-[#075B46]" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-700" />
                )}
                <h3 className={`font-serif font-bold text-base ${
                  statusForm.newStatus === "APPROVED" ? "text-[#173C32]" : "text-rose-900"
                }`}>
                  {statusForm.newStatus === "APPROVED" ? "Reactivate User Account" : "Deactivate / Suspend Account"}
                </h3>
              </div>
              <button onClick={() => setShowStatusModal(false)} className="text-[#6B7C74] hover:text-[#173C32]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStatusChange} className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB]">
                <div className="font-semibold text-sm text-[#173C32]">{selectedUser.fullName}</div>
                <div className="font-mono text-[11px] text-[#6B7C74]">{selectedUser.email}</div>
                <div className="mt-1 text-[11px] text-[#6B7C74]">
                  Current Status: <span className="font-semibold text-[#173C32]">{selectedUser.status}</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#173C32] mb-1">Target Account Status</label>
                <select
                  value={statusForm.newStatus}
                  onChange={(e) => setStatusForm({ ...statusForm, newStatus: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB] text-xs text-[#173C32] focus:outline-none focus:border-[#075B46]"
                >
                  <option value="APPROVED">Active (Approved - Full Access)</option>
                  <option value="SUSPENDED">Suspended (Access Blocked by Admin)</option>
                  <option value="INACTIVE">Inactive (Deactivated)</option>
                  <option value="PENDING">Pending Review</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#173C32] mb-1">
                  Reason for Action <span className="font-normal text-[#6B7C74]">(Logged in Audit Trail)</span>
                </label>
                <textarea
                  rows={3}
                  value={statusForm.reason}
                  onChange={(e) => setStatusForm({ ...statusForm, reason: e.target.value })}
                  placeholder="e.g. Security audit flag, seasonal leave, onboarding completed..."
                  className="w-full px-3 py-2 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB] text-xs text-[#173C32] focus:outline-none focus:border-[#075B46]"
                />
              </div>

              {statusForm.newStatus !== "APPROVED" && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                  Deactivating this account immediately revokes access to all protected APIs and role dashboards. Historical dispatches and transactions will be preserved.
                </div>
              )}

              <div className="pt-4 border-t border-[#D7E5DB] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-4 py-2 rounded-xl font-semibold text-white flex items-center gap-1.5 shadow-sm ${
                    statusForm.newStatus === "APPROVED"
                      ? "bg-[#075B46] hover:bg-[#064e3b]"
                      : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Status Update</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 5: ARCHIVE / SOFT DELETE ACCOUNT */}
      {/* ------------------------------------------------------------------- */}
      {showArchiveModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border border-rose-200 shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <h3 className="font-serif font-bold text-base text-rose-900">Archive Account</h3>
              </div>
              <button onClick={() => setShowArchiveModal(false)} className="text-rose-700 hover:text-rose-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleArchiveUser} className="p-6 space-y-4 text-xs">
              <p className="text-slate-700">
                Are you sure you want to archive user account <strong className="text-slate-900">{selectedUser.fullName}</strong> ({selectedUser.email})?
              </p>

              <div className="p-3 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB] text-[11px] text-[#173C32] space-y-1">
                <div>• Account login will be permanently blocked.</div>
                <div>• All past dispatches, batch intakes, and blockchain transactions remain immutable.</div>
                <div>• Active dispatches must be reassigned prior to driver archival.</div>
              </div>

              <div>
                <label className="block font-semibold text-[#173C32] mb-1">
                  Reason for Archival <span className="font-normal text-[#6B7C74]">(Mandatory)</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  placeholder="e.g. Employee departed organization; replacement assigned..."
                  className="w-full px-3 py-2 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB] text-xs text-[#173C32] focus:outline-none focus:border-[#075B46]"
                />
              </div>

              <div className="pt-4 border-t border-[#D7E5DB] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowArchiveModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !archiveReason.trim()}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Archive Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 6: DETAILED USER PROFILE & WORK SUMMARY */}
      {/* ------------------------------------------------------------------- */}
      {showProfileModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#D7E5DB] shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 bg-[#EDF7EF] border-b border-[#D7E5DB] flex items-center justify-between sticky top-0 bg-[#EDF7EF] z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#E5F5EA] text-[#075B46] font-bold text-xs flex items-center justify-center border border-[#D7E5DB]">
                  {selectedUser.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-[#173C32]">{selectedUser.fullName}</h3>
                  <p className="text-[11px] font-mono text-[#6B7C74]">{selectedUser.email}</p>
                </div>
              </div>
              <button onClick={() => setShowProfileModal(false)} className="text-[#6B7C74] hover:text-[#173C32]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 text-xs">
              {profileLoading ? (
                <div className="p-8 text-center text-[#6B7C74] flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-[#075B46]" />
                  <span>Loading user profile &amp; activity history...</span>
                </div>
              ) : (
                <>
                  {/* Account Overview Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB]">
                      <div className="text-[10px] text-[#6B7C74] uppercase font-mono">Assigned Role</div>
                      <div className="mt-1 font-bold text-xs text-[#173C32]">{selectedUser.role}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB]">
                      <div className="text-[10px] text-[#6B7C74] uppercase font-mono">Employee ID</div>
                      <div className="mt-1 font-mono font-bold text-xs text-[#075B46]">
                        {selectedUser.employeeId || "None"}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB]">
                      <div className="text-[10px] text-[#6B7C74] uppercase font-mono">Account Status</div>
                      <div className="mt-1 font-bold text-xs text-[#173C32]">{selectedUser.status}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#F7FBF7] border border-[#D7E5DB]">
                      <div className="text-[10px] text-[#6B7C74] uppercase font-mono">Phone</div>
                      <div className="mt-1 text-xs text-[#173C32]">{selectedUser.phone || "—"}</div>
                    </div>
                  </div>

                  {/* Facility & Organization */}
                  <div className="p-4 rounded-xl bg-[#EDF7EF]/50 border border-[#D7E5DB] space-y-2">
                    <div className="font-semibold text-xs text-[#173C32] flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[#075B46]" />
                      <span>Facility &amp; Organizational Affiliation</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[#6B7C74]">Organization:</span>{" "}
                        <span className="font-semibold text-[#173C32]">{selectedUser.organization || "Independent"}</span>
                      </div>
                      <div>
                        <span className="text-[#6B7C74]">Facility Hub:</span>{" "}
                        <span className="font-semibold text-[#173C32]">{selectedUser.facility?.name || "Regional / Mobile"}</span>
                      </div>
                      <div>
                        <span className="text-[#6B7C74]">Account Created:</span>{" "}
                        <span className="font-mono text-[#173C32]">{new Date(selectedUser.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div>
                        <span className="text-[#6B7C74]">Last Activity:</span>{" "}
                        <span className="font-mono text-[#173C32]">
                          {selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleString() : "Never"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Assigned Operational Work Records */}
                  {profileDetails?.assignedWork && (
                    <div className="space-y-3">
                      <h4 className="font-serif font-bold text-sm text-[#173C32] flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-[#075B46]" />
                        <span>Assigned Operational Work &amp; Dispatches</span>
                      </h4>

                      {profileDetails.assignedWork.roleType === "DRIVER" && (
                        <div className="p-4 rounded-xl bg-white border border-[#D7E5DB] space-y-2">
                          <div className="flex items-center justify-between text-xs pb-2 border-b border-[#D7E5DB]">
                            <span>
                              Total Dispatches: <strong className="text-[#173C32]">{profileDetails.assignedWork.totalDispatches}</strong>
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              {profileDetails.assignedWork.activeDispatchesCount} Active In-Transit
                            </span>
                          </div>
                          {profileDetails.assignedWork.recentDispatches?.length > 0 ? (
                            <div className="space-y-1.5 pt-1">
                              {profileDetails.assignedWork.recentDispatches.slice(0, 4).map((d: any) => (
                                <div key={d.id} className="p-2 rounded-lg bg-[#F7FBF7] text-[11px] flex items-center justify-between">
                                  <span className="font-mono font-semibold text-[#075B46]">{d.dispatchId}</span>
                                  <span className="text-[#6B7C74]">{d.destination}</span>
                                  <Badge status={d.status} size="sm" />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-[#6B7C74]">No active or historical dispatches for this driver.</p>
                          )}
                        </div>
                      )}

                      {profileDetails.assignedWork.roleType === "DEALER" && (
                        <div className="p-4 rounded-xl bg-white border border-[#D7E5DB] space-y-2">
                          <div className="text-xs pb-2 border-b border-[#D7E5DB]">
                            Total Batches Registered: <strong className="text-[#173C32]">{profileDetails.assignedWork.totalBatches}</strong>
                          </div>
                          {profileDetails.assignedWork.recentBatches?.length > 0 ? (
                            <div className="space-y-1.5 pt-1">
                              {profileDetails.assignedWork.recentBatches.slice(0, 4).map((b: any) => (
                                <div key={b.id} className="p-2 rounded-lg bg-[#F7FBF7] text-[11px] flex items-center justify-between">
                                  <span className="font-mono font-semibold text-[#075B46]">{b.batchId}</span>
                                  <span className="text-[#6B7C74]">{b.weightKg} kg</span>
                                  <Badge status={b.status} size="sm" />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-[#6B7C74]">No batches registered yet.</p>
                          )}
                        </div>
                      )}

                      {profileDetails.assignedWork.roleType === "WORKER" && (
                        <div className="p-4 rounded-xl bg-white border border-[#D7E5DB] space-y-2">
                          <div className="text-xs pb-2 border-b border-[#D7E5DB]">
                            Total Processing Runs: <strong className="text-[#173C32]">{profileDetails.assignedWork.totalProcessingRecords}</strong>
                          </div>
                          {profileDetails.assignedWork.recentProcessing?.length > 0 ? (
                            <div className="space-y-1.5 pt-1">
                              {profileDetails.assignedWork.recentProcessing.slice(0, 4).map((p: any) => (
                                <div key={p.id} className="p-2 rounded-lg bg-[#F7FBF7] text-[11px] flex items-center justify-between">
                                  <span className="font-mono font-semibold text-[#075B46]">{p.batchId}</span>
                                  <span className="text-[#6B7C74]">Processed: {p.processedWeightKg} kg</span>
                                  <span className="font-semibold text-emerald-700">Recovered: {p.recoveredWeightKg} kg</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-[#6B7C74]">No mass balance runs executed yet.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Audit History Trail */}
                  <div className="space-y-3">
                    <h4 className="font-serif font-bold text-sm text-[#173C32] flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#075B46]" />
                      <span>Security &amp; User Audit History</span>
                    </h4>

                    {profileDetails?.auditHistory && profileDetails.auditHistory.length > 0 ? (
                      <div className="max-h-44 overflow-y-auto divide-y divide-[#D7E5DB] rounded-xl border border-[#D7E5DB]">
                        {profileDetails.auditHistory.map((a: any) => (
                          <div key={a.id} className="p-2.5 bg-white text-[11px] flex items-center justify-between hover:bg-[#F7FBF7]">
                            <div>
                              <span className="font-mono font-semibold text-[#173C32]">{a.action}</span>
                              <div className="text-[10px] text-[#6B7C74] font-mono">
                                IP: {a.ipAddress || "127.0.0.1"} • {new Date(a.timestamp).toLocaleString()}
                              </div>
                            </div>
                            {a.details?.reason && (
                              <span className="text-[10px] text-[#6B7C74] italic max-w-xs truncate">
                                "{a.details.reason}"
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#6B7C74]">No historical audit events logged for this account.</p>
                    )}
                  </div>
                </>
              )}

              <div className="pt-4 border-t border-[#D7E5DB] flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold"
                >
                  Close Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
