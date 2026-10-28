const API_BASE = "http://localhost:5000/api";

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("ecotrace_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...getAuthHeader(),
    ...options.headers,
  };

  const res = await fetch(url, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "An unexpected error occurred");
  }

  return data;
}

export const api = {
  // Auth
  login: (credentials: { email: string; password: string; portalRole?: string }) =>
    request("/auth/login", { method: "POST", body: JSON.stringify(credentials) }),
  register: (userData: any) =>
    request("/auth/register", { method: "POST", body: JSON.stringify(userData) }),
  me: () => request("/auth/me"),

  // Batches
  getBatches: (params?: { status?: string; categoryId?: string; facilityId?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return request(`/batches${query ? `?${query}` : ""}`);
  },
  getBatchDetail: (batchId: string) => request(`/batches/${batchId}`),
  getCategories: () => request("/batches/categories"),
  getFacilities: () => request("/batches/facilities"),
  createBatch: (data: any) => request("/batches", { method: "POST", body: JSON.stringify(data) }),

  // Dispatches
  getDispatches: () => request("/dispatches"),
  getDrivers: () => request("/dispatches/drivers"),
  createDispatch: (data: any) => request("/dispatches", { method: "POST", body: JSON.stringify(data) }),
  updateDispatchStatus: (id: string, data: { status: string; proofHash?: string; discrepancyNotes?: string }) =>
    request(`/dispatches/${id}/status`, { method: "PATCH", body: JSON.stringify(data) }),

  // Receiving
  getIncomingShipments: () => request("/receiving/incoming"),
  getReceivingHistory: () => request("/receiving/history"),
  confirmReceiving: (data: any) => request("/receiving/confirm", { method: "POST", body: JSON.stringify(data) }),

  // Processing & Mass Balance
  getAvailableBatchesForWorker: () => request("/processing/available-batches"),
  getProcessingRecords: () => request("/processing/records"),
  recordProcessing: (data: any) => request("/processing", { method: "POST", body: JSON.stringify(data) }),
  reviewProcessing: (id: string, data: { approved: boolean; remarks: string }) =>
    request(`/processing/${id}/supervisor-review`, { method: "PATCH", body: JSON.stringify(data) }),

  // Materials & Duplicate Claim Prevention
  getMaterials: () => request("/materials"),
  getClaims: () => request("/materials/claims"),
  claimMaterial: (data: any) => request("/materials/claim", { method: "POST", body: JSON.stringify(data) }),

  // Products & Public Customer Verification
  getProducts: () => request("/products"),
  createProduct: (data: any) => request("/products", { method: "POST", body: JSON.stringify(data) }),
  verifyPublicProduct: (query: string) => request(`/products/verify/${encodeURIComponent(query)}`),

  // Admin Analytics & Audits
  getAdminAnalytics: () => request("/admin/analytics"),
  getUsers: () => request("/admin/users"),
  updateUserStatus: (id: string, status: string) =>
    request(`/admin/users/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  getAuditLogs: (params?: { action?: string; entityType?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return request(`/admin/audit-logs${query ? `?${query}` : ""}`);
  },
  getBlockchainTxs: () => request("/admin/blockchain/txs"),
  getExportCsvUrl: () => `${API_BASE}/admin/export/csv`,

  // File Upload
  uploadEvidence: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const token = localStorage.getItem("ecotrace_token");
    const res = await fetch(`${API_BASE}/evidence/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    return await res.json();
  },
};
