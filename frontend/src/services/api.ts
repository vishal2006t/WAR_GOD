const API_BASE = (import.meta as any).env?.VITE_API_URL || "http://localhost:5000/api";

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
  getBatches: (params?: { status?: string; categoryId?: string; facilityId?: string; search?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return request(`/batches${query ? `?${query}` : ""}`);
  },
  getBatchDetail: (batchId: string) => request(`/batches/${batchId}`),
  getCategories: () => request("/batches/categories"),
  getFacilities: () => request("/batches/facilities"),
  createBatch: (data: any) => request("/batches", { method: "POST", body: JSON.stringify(data) }),
  updateBatch: (id: string, data: any) =>
    request(`/batches/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  // Dispatches
  getDispatches: () => request("/dispatches"),
  getDrivers: () => request("/dispatches/drivers"),
  getOptimizeRoutes: () => request("/dispatches/optimize-routes"),
  postOptimizeRoutes: (data?: any) =>
    request("/dispatches/optimize-routes", { method: "POST", body: JSON.stringify(data || {}) }),
  commitOptimization: (reportId: string) =>
    request("/dispatches/commit-optimization", { method: "POST", body: JSON.stringify({ reportId }) }),
  getOptimizationReports: () => request("/dispatches/optimization-reports"),
  getOptimizationReport: (id: string) => request(`/dispatches/optimization-reports/${id}`),
  createDispatch: (data: any) => request("/dispatches", { method: "POST", body: JSON.stringify(data) }),
  updateDispatchStatus: (
    id: string,
    data: {
      status: string;
      pickupWeightKg?: number;
      deliveryWeightKg?: number;
      rejectionReason?: string;
      exceptionReason?: string;
      proofHash?: string;
      deliveryProofUrl?: string;
      discrepancyNotes?: string;
    }
  ) => request(`/dispatches/${id}/status`, { method: "PATCH", body: JSON.stringify(data) }),
  getDispatchTracking: (id: string) => request(`/dispatches/${id}/tracking`),
  updateDispatchLocation: (
    id: string,
    data: {
      latitude: number;
      longitude: number;
      heading?: number;
      speed?: number;
      accuracy?: number;
      timestamp?: string;
    }
  ) => request(`/dispatches/${id}/location`, { method: "POST", body: JSON.stringify(data) }),
  tripAction: (
    id: string,
    data: {
      action: "START_TRIP" | "START_BREAK" | "RESUME_TRIP" | "COMPLETE_TRIP";
      reason?: string;
      location?: { latitude: number; longitude: number };
      notes?: string;
    }
  ) => request(`/dispatches/${id}/trip-action`, { method: "POST", body: JSON.stringify(data) }),
  confirmDispatchDelivery: (
    id: string,
    data: {
      otp: string;
      receivedWeightKg: number;
      discrepancyNotes?: string;
    }
  ) => request(`/dispatches/${id}/confirm-delivery`, { method: "POST", body: JSON.stringify(data) }),

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

  // Admin Analytics, Users & Audits
  getAdminAnalytics: () => request("/admin/analytics"),
  getUsers: (params?: { search?: string; role?: string; status?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams(
      Object.entries(params || {})
        .filter(([_, v]) => v !== undefined && v !== "")
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return request(`/admin/users${query ? `?${query}` : ""}`);
  },
  getUserProfile: (id: string) => request(`/admin/users/${id}`),
  createUser: (data: any) => request("/admin/users", { method: "POST", body: JSON.stringify(data) }),
  updateUserDetails: (id: string, data: any) =>
    request(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  updateUserRole: (id: string, role: string, reason?: string) =>
    request(`/admin/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role, reason }) }),
  updateUserStatus: (id: string, status: string, reason?: string) =>
    request(`/admin/users/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, reason }) }),
  deleteUser: (id: string, reason?: string) =>
    request(`/admin/users/${id}`, { method: "DELETE", body: JSON.stringify({ reason }) }),
  lookupEmployeeId: (empId: string) =>
    request(`/admin/users/lookup/employee-id/${encodeURIComponent(empId)}`),
  getUserAuditHistory: (id: string) => request(`/admin/users/${id}/audit-history`),
  getAuditLogs: (params?: { action?: string; entityType?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return request(`/admin/audit-logs${query ? `?${query}` : ""}`);
  },
  getBlockchainTxs: () => request("/admin/blockchain/txs"),
  getExportCsvUrl: () => `${API_BASE}/admin/export/csv`,
  getExportWordUrl: () => `${API_BASE}/admin/export/word`,

  // Word (.docx) Direct Download
  downloadWordAuditReport: async () => {
    const url = `${API_BASE}/admin/export/word`;
    const res = await fetch(url, { headers: getAuthHeader() });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Download failed" }));
      throw new Error(err.error || `Word audit export failed with status ${res.status}`);
    }

    let filename = `ecotrace-audit-export-${new Date().toISOString().split("T")[0]}.docx`;
    const disposition = res.headers.get("content-disposition");
    if (disposition) {
      const match = disposition.match(/filename=["']?([^"';]+)["']?/i);
      if (match && match[1]) {
        filename = match[1].trim();
      }
    }

    const blob = await res.blob();
    const docxBlob = new Blob([blob], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const blobUrl = window.URL.createObjectURL(docxBlob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
  },

  // Excel & CSV Direct Downloads
  downloadExcelReport: async (reportType: string, filter?: { startDate?: string; endDate?: string }) => {
    const params = new URLSearchParams();
    if (filter?.startDate) params.set("startDate", filter.startDate);
    if (filter?.endDate) params.set("endDate", filter.endDate);
    const queryStr = params.toString();
    const url = `${API_BASE}/admin/export/excel/${reportType}${queryStr ? `?${queryStr}` : ""}`;

    const res = await fetch(url, { headers: getAuthHeader() });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Download failed" }));
      throw new Error(err.error || `Excel export failed with status ${res.status}`);
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `ecotrace-${reportType}-report.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
  },

  downloadCsvReport: async () => {
    const url = `${API_BASE}/admin/export/csv`;
    const res = await fetch(url, { headers: getAuthHeader() });
    if (!res.ok) {
      throw new Error("Failed to export CSV report");
    }
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `ecotrace-audit-export-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
  },

  downloadOptimizationReport: async (reportId: string, format: "csv" | "excel") => {
    const url = `${API_BASE}/dispatches/optimization-reports/${reportId}/export/${format}`;
    const res = await fetch(url, { headers: getAuthHeader() });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Download failed" }));
      throw new Error(err.error || `Download failed with status ${res.status}`);
    }
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    const ext = format === "excel" ? "xlsx" : "csv";
    a.download = `EcoTrace_QpiAI_Optimization_${reportId}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
  },

  // Notifications
  getNotifications: () => request("/notifications"),
  getUnreadCount: () => request("/notifications/unread-count"),
  markNotificationRead: (id: string) => request(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllNotificationsRead: () => request("/notifications/read-all", { method: "PATCH" }),

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

  // Driver Fleet Management
  getDriversList: async (params?: { search?: string; availability?: string; vehicleType?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.append("search", params.search);
    if (params?.availability) q.append("availability", params.availability);
    if (params?.vehicleType) q.append("vehicleType", params.vehicleType);
    return request(`/drivers?${q.toString()}`);
  },

  getDriverDetails: async (id: string) => {
    return request(`/drivers/${id}`);
  },

  getDriverMe: async () => {
    return request("/drivers/me");
  },

  createDriver: async (data: any) => {
    return request("/drivers", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateDriver: async (id: string, data: any) => {
    return request(`/drivers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  updateDriverAvailability: async (id: string, availability: string) => {
    return request(`/drivers/${id}/availability`, {
      method: "PATCH",
      body: JSON.stringify({ availability }),
    });
  },

  deleteDriver: async (id: string) => {
    return request(`/drivers/${id}`, {
      method: "DELETE",
    });
  },

  // =========================================================================
  // CIRCULAR MARKETPLACE APIS
  // =========================================================================

  // Feature 1: Customer Selling
  createListing: (data: any) =>
    request("/marketplace/listings", { method: "POST", body: JSON.stringify(data) }),
  getMyListings: () => request("/marketplace/listings/my"),
  getInspectionListings: (params?: { status?: string; category?: string; search?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams(
      Object.entries(params || {})
        .filter(([_, v]) => v !== undefined && v !== "")
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return request(`/marketplace/listings/inspection${query ? `?${query}` : ""}`);
  },
  getListingDetail: (id: string) => request(`/marketplace/listings/${id}`),
  reviewListing: (id: string, data: { decision: "APPROVED" | "REJECTED"; reviewNotes?: string }) =>
    request(`/marketplace/listings/${id}/review`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  publishListing: (id: string) =>
    request(`/marketplace/listings/${id}/publish`, {
      method: "PATCH",
    }),
  cancelListing: (id: string, reason?: string) =>
    request(`/marketplace/listings/${id}/cancel`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    }),
  acceptOffer: (offerId: string) =>
    request(`/marketplace/offers/${offerId}/accept`, { method: "POST" }),
  rejectOffer: (offerId: string, reason?: string) =>
    request(`/marketplace/offers/${offerId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  // Feature 2: Dealer Nearby & Offers
  getNearbyListings: (params?: {
    category?: string;
    condition?: string;
    minPrice?: number;
    maxPrice?: number;
    latitude?: number;
    longitude?: number;
    maxDistanceKm?: number;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") q.append(k, String(v));
      });
    }
    return request(`/marketplace/listings/nearby?${q.toString()}`);
  },
  makeOffer: (listingId: string, data: { offeredPrice: number; message?: string; estimatedPickupHours?: number }) =>
    request(`/marketplace/listings/${listingId}/offer`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getMyOffers: () => request("/marketplace/offers/my"),
  assignPickupDriver: (
    listingId: string,
    data: { driverId: string; vehicleRegistration: string; vehicleType?: string; notes?: string }
  ) =>
    request(`/marketplace/listings/${listingId}/assign-driver`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Feature 3: Pickup Driver Tracking & Handover OTP
  getMyPickupTasks: () => request("/marketplace/pickups/my"),
  updatePickupTaskStatus: (
    id: string,
    data: {
      status: string;
      note?: string;
      handoverOtp?: string;
      proofPhotos?: string[];
      actualWeightKg?: number;
      cancellationReason?: string;
    }
  ) =>
    request(`/marketplace/pickups/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  updatePickupLocation: (
    id: string,
    coords: { latitude: number; longitude: number; heading?: number; speed?: number; accuracy?: number }
  ) =>
    request(`/marketplace/pickups/${id}/location`, {
      method: "POST",
      body: JSON.stringify(coords),
    }),

  // Feature 4: Dealer Inspection & Resale Marketplace
  getCollectedItemsForInspection: () => request("/marketplace/inspections/collected-items"),
  createInspection: (data: any) =>
    request("/marketplace/inspections", { method: "POST", body: JSON.stringify(data) }),
  createResaleProduct: (data: any) =>
    request("/marketplace/resale-products", { method: "POST", body: JSON.stringify(data) }),
  getMyResaleProducts: () => request("/marketplace/resale-products/my"),
  updateResaleProduct: (id: string, data: any) =>
    request(`/marketplace/resale-products/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  // Feature 5: Factory Recovered Materials
  createMaterialListing: (data: any) =>
    request("/marketplace/material-listings", { method: "POST", body: JSON.stringify(data) }),
  getMyMaterialListings: () => request("/marketplace/material-listings/my"),
  updateMaterialListing: (id: string, data: any) =>
    request(`/marketplace/material-listings/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  // Customer Marketplace & Order Checkout
  browseMarketplace: (params?: {
    type?: "ALL" | "REFURBISHED" | "P2P" | "MATERIAL";
    category?: string;
    brand?: string;
    model?: string;
    conditionGrade?: string;
    minPrice?: number;
    maxPrice?: number;
    search?: string;
    inStockOnly?: boolean;
  }) => {
    const q = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") q.append(k, String(v));
      });
    }
    return request(`/marketplace/browse?${q.toString()}`);
  },
  getMarketplaceProduct: (id: string) => request(`/marketplace/products/${id}`),
  createMarketplaceOrder: (data: any) =>
    request("/marketplace/orders", { method: "POST", body: JSON.stringify(data) }),
  payTestOrder: (orderId: string, data?: { paymentMethod?: string }) =>
    request(`/marketplace/orders/${orderId}/pay-test`, {
      method: "POST",
      body: JSON.stringify(data || { paymentMethod: "TEST_UPI" }),
    }),
  getMyOrders: () => request("/marketplace/orders/my"),
  getSellerOrders: () => request("/marketplace/orders/seller"),
  updateOrderFulfillment: (
    orderId: string,
    data: { orderStatus?: string; trackingNumber?: string; notes?: string }
  ) =>
    request(`/marketplace/orders/${orderId}/fulfillment`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // OpenStreetMap & OSRM Road Routing API
  getMapConfig: () => request("/maps/config"),
  computeRoadRoute: (data: {
    origin: { lat: number; lng: number };
    destination: { lat?: number; lng?: number; address?: string };
    taskId?: string;
  }) => request("/maps/route", { method: "POST", body: JSON.stringify(data) }),
  getPickupRoute: (taskId: string) => request(`/maps/pickup-route/${taskId}`),

  // Driver AI & Manual Mode Module
  getDriverOperatingMode: (scope?: string) =>
    request(`/driver-ai/mode${scope ? `?scope=${scope}` : ""}`),
  setDriverOperatingMode: (data: { mode: "AI" | "MANUAL"; notes?: string; scope?: string }) =>
    request("/driver-ai/mode", { method: "POST", body: JSON.stringify(data) }),
  getDriverAIRecommendations: (params?: {
    requiredWeightKg?: number;
    pickupLocation?: string;
    preferredVehicleType?: string;
  }) => {
    const q = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") q.append(k, String(v));
      });
    }
    return request(`/driver-ai/recommendations?${q.toString()}`);
  },
  manualAssignDriver: (data: {
    dispatchId?: string;
    pickupTaskId?: string;
    driverId: string;
    vehicleRegistration?: string;
    vehicleType?: string;
    overrideReason?: string;
  }) => request("/driver-ai/manual-assign", { method: "POST", body: JSON.stringify(data) }),
  getRealDriversWithStatus: () => request("/driver-ai/drivers"),
  updateDriverAvailabilityStatus: (driverId: string, data: { status: string; notes?: string }) =>
    request(`/driver-ai/drivers/${driverId}/status`, { method: "PATCH", body: JSON.stringify(data) }),
};
