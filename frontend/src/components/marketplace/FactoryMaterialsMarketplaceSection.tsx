import React, { useState, useEffect } from "react";
import { api } from "../../services/api";
import { Badge } from "../ui/Badge";
import {
  Layers,
  Plus,
  Boxes,
  CheckCircle2,
  AlertTriangle,
  X,
  Truck,
  RefreshCw,
  Edit3,
  DollarSign,
  Scale,
  ShieldCheck,
  Search,
} from "lucide-react";

export const FactoryMaterialsMarketplaceSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"listings" | "orders">("listings");

  // Material Listings
  const [listings, setListings] = useState<any[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);

  // Source Batches
  const [sourceMaterials, setSourceMaterials] = useState<any[]>([]);

  // Orders
  const [sellerOrders, setSellerOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Create Listing Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedSourceBatchId, setSelectedSourceBatchId] = useState("");
  const [materialType, setMaterialType] = useState("Copper (Cathode 99.9%)");
  const [purityPercentage, setPurityPercentage] = useState("99.9");
  const [grade, setGrade] = useState("A1_ELECTROLYTIC");
  const [totalWeightKg, setTotalWeightKg] = useState("50");
  const [pricePerKg, setPricePerKg] = useState("750");
  const [minOrderKg, setMinOrderKg] = useState("5");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Order Fulfillment Modal
  const [fulfillModalOrder, setFulfillModalOrder] = useState<any | null>(null);
  const [orderStatus, setOrderStatus] = useState("DISPATCHED");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [fulfillmentNotes, setFulfillmentNotes] = useState("");
  const [submittingFulfill, setSubmittingFulfill] = useState(false);

  useEffect(() => {
    loadListings();
    loadSourceMaterials();
  }, []);

  const loadListings = async () => {
    setLoadingListings(true);
    try {
      const res = await api.getMyMaterialListings();
      if (res.success) {
        setListings(res.data || []);
      }
    } catch (err) {
      console.error("Failed to load material listings:", err);
    } finally {
      setLoadingListings(false);
    }
  };

  const loadSourceMaterials = async () => {
    try {
      const res = await api.getMaterials();
      if (res.success && res.materials) {
        setSourceMaterials(res.materials);
        if (res.materials.length > 0 && !selectedSourceBatchId) {
          setSelectedSourceBatchId(res.materials[0].materialBatchId || res.materials[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load source materials:", err);
    }
  };

  const loadSellerOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await api.getSellerOrders();
      if (res.success) {
        setSellerOrders(res.data || []);
      }
    } catch (err) {
      console.error("Failed to load seller orders:", err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSourceBatchId || !totalWeightKg || !pricePerKg) {
      setCreateError("Please fill in all mandatory listing fields.");
      return;
    }

    setSubmitting(true);
    setCreateError(null);

    try {
      const res = await api.createMaterialListing({
        sourceMaterialBatchId: selectedSourceBatchId,
        materialType,
        purityPercentage: Number(purityPercentage),
        grade,
        totalListedWeightKg: Number(totalWeightKg),
        pricePerKg: Number(pricePerKg),
        minimumOrderKg: Number(minOrderKg) || 1,
        description: description || `Certified recovered ${materialType} ready for industrial re-melting.`,
      });

      if (res.success) {
        alert("Recovered material listing created with verified mass balance!");
        setIsCreateOpen(false);
        loadListings();
      }
    } catch (err: any) {
      setCreateError(err.message || "Failed to create material listing.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateFulfillment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fulfillModalOrder) return;

    setSubmittingFulfill(true);
    try {
      const res = await api.updateOrderFulfillment(fulfillModalOrder.orderId, {
        orderStatus,
        trackingNumber: trackingNumber || undefined,
        notes: fulfillmentNotes || undefined,
      });

      if (res.success) {
        alert(`Order fulfillment updated to ${orderStatus}`);
        setFulfillModalOrder(null);
        loadSellerOrders();
      }
    } catch (err: any) {
      alert(err.message || "Failed to update fulfillment");
    } finally {
      setSubmittingFulfill(false);
    }
  };

  return (
    <div id="factory-materials-marketplace" className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#EDF7EF] border border-[#D7E5DB] rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E5F5EA] text-[#075B46] border border-[#D7E5DB] mb-2">
            <Layers className="w-3.5 h-3.5" />
            Verified Mass Balance Trading
          </span>
          <h2 className="text-xl sm:text-2xl font-serif text-[#173C32]">Recovered Materials Marketplace</h2>
          <p className="text-xs text-[#6B7C74] mt-0.5 max-w-xl">
            Commercialize refined copper, aluminium, precious metals, and polymers. Preserve exact batch traceability and prevent negative inventory.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveTab("listings");
              loadListings();
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "listings"
                ? "bg-[#075B46] text-white shadow-sm"
                : "bg-white text-[#6B7C74] border border-[#D7E5DB] hover:bg-[#EDF7EF]"
            }`}
          >
            My Material Listings ({listings.length})
          </button>

          <button
            onClick={() => {
              setActiveTab("orders");
              loadSellerOrders();
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "orders"
                ? "bg-[#075B46] text-white shadow-sm"
                : "bg-white text-[#6B7C74] border border-[#D7E5DB] hover:bg-[#EDF7EF]"
            }`}
          >
            Fulfillment Orders ({sellerOrders.length})
          </button>

          <button
            id="list-material-btn"
            onClick={() => {
              setIsCreateOpen(true);
              setCreateError(null);
            }}
            className="px-4 py-2 rounded-xl bg-[#087F5B] hover:bg-[#075B46] text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>List Recovered Stock</span>
          </button>
        </div>
      </div>

      {/* LISTINGS TAB */}
      {activeTab === "listings" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-serif text-[#173C32]">Published Material Lots</h3>
            <span className="text-xs text-[#6B7C74]">Backed by verifiable smelting & refining mass balance</span>
          </div>

          {loadingListings ? (
            <div className="p-12 text-center text-xs text-[#6B7C74]">Loading material listings...</div>
          ) : listings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#D7E5DB] p-8 text-center text-xs text-[#6B7C74] space-y-2">
              <p>No recovered materials listed yet.</p>
              <button
                onClick={() => setIsCreateOpen(true)}
                className="px-4 py-1.5 rounded-xl bg-[#075B46] text-white text-xs font-semibold"
              >
                Create First Material Listing
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {listings.map((item) => (
                <div
                  key={item.listingId}
                  className="bg-white rounded-2xl border border-[#D7E5DB] p-5 shadow-sm space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[#075B46]">{item.listingId}</span>
                      <Badge variant="success" className="text-[10px]">
                        {item.status}
                      </Badge>
                    </div>

                    <h4 className="text-sm font-bold text-[#173C32]">{item.materialType}</h4>
                    <p className="text-xs text-[#6B7C74]">
                      Grade: {item.grade} • Purity: {item.purityPercentage}%
                    </p>

                    <div className="p-3 rounded-xl bg-[#EDF7EF] text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[#6B7C74]">Remaining Stock:</span>
                        <span className="font-bold text-[#075B46]">{item.availableStockKg} kg</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#6B7C74]">Source Batch Ref:</span>
                        <span className="font-mono text-[10px] text-[#173C32]">{item.sourceMaterialBatchId}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#D7E5DB] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-[#6B7C74] block">Price per kg</span>
                      <span className="text-base font-bold text-[#075B46]">₹{item.pricePerKg.toLocaleString()}</span>
                    </div>

                    <span className="text-[11px] text-[#6B7C74]">Min Order: {item.minimumOrderKg} kg</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ORDERS TAB */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-serif text-[#173C32]">Commercial Material Fulfillment Orders</h3>
            <button
              onClick={loadSellerOrders}
              className="text-xs text-[#075B46] hover:underline flex items-center gap-1 font-semibold"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Orders</span>
            </button>
          </div>

          {loadingOrders ? (
            <div className="p-12 text-center text-xs text-[#6B7C74]">Loading fulfillment orders...</div>
          ) : sellerOrders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#D7E5DB] p-8 text-center text-xs text-[#6B7C74]">
              No purchase orders placed for your factory materials yet.
            </div>
          ) : (
            <div className="space-y-3">
              {sellerOrders.map((ord) => (
                <div
                  key={ord.orderId}
                  className="bg-white rounded-2xl border border-[#D7E5DB] p-5 shadow-sm space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#D7E5DB]">
                    <div>
                      <span className="font-mono text-xs font-bold text-[#075B46]">{ord.orderId}</span>
                      <h4 className="text-sm font-bold text-[#173C32]">{ord.itemTitle}</h4>
                      <p className="text-xs text-[#6B7C74]">
                        Buyer: {ord.customerName} ({ord.customerEmail}) • Qty: {ord.quantity} kg
                      </p>
                    </div>

                    <div className="flex flex-col sm:items-end gap-1">
                      <span className="text-base font-bold text-[#075B46]">₹{ord.totalAmount.toLocaleString()}</span>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={ord.paymentStatus === "VERIFIED_PAID" ? "success" : "secondary"}
                          className="text-[10px]"
                        >
                          {ord.paymentStatus}
                        </Badge>
                        <Badge variant="primary" className="text-[10px]">
                          {ord.orderStatus}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <p className="text-xs text-[#6B7C74]">
                      Destination: {ord.shippingAddress?.fullName}, {ord.shippingAddress?.streetAddress}, {ord.shippingAddress?.city}
                    </p>

                    <button
                      onClick={() => {
                        setFulfillModalOrder(ord);
                        setOrderStatus(ord.orderStatus || "DISPATCHED");
                        setTrackingNumber(ord.trackingNumber || "");
                        setFulfillmentNotes(ord.notes || "");
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white text-xs font-semibold shadow-sm"
                    >
                      Update Fulfillment
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CREATE MATERIAL LISTING MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#D7E5DB] max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#D7E5DB] pb-3">
              <h3 className="text-base font-serif text-[#173C32]">Publish Recovered Material Stock</h3>
              <button onClick={() => setIsCreateOpen(false)} className="p-1 rounded-lg hover:bg-[#EDF7EF] text-[#6B7C74]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateListing} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#173C32] mb-1">
                  Source Processing Batch (Mass Balance Link) *
                </label>
                <select
                  value={selectedSourceBatchId}
                  onChange={(e) => setSelectedSourceBatchId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-[#D7E5DB] bg-white text-xs font-mono"
                >
                  {sourceMaterials.map((m) => (
                    <option key={m.materialBatchId || m.id} value={m.materialBatchId || m.id}>
                      {m.materialBatchId} - {m.materialType} (Available: {m.recoveredWeightKg - (m.claimedWeightKg || 0)} kg)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#173C32] mb-1">Material Type *</label>
                  <input
                    type="text"
                    value={materialType}
                    onChange={(e) => setMaterialType(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-[#D7E5DB]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#173C32] mb-1">Purity (%) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="100"
                    value={purityPercentage}
                    onChange={(e) => setPurityPercentage(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-[#D7E5DB]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#173C32] mb-1">Industry Grade *</label>
                  <input
                    type="text"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-[#D7E5DB]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#173C32] mb-1">Listed Weight (kg) *</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={totalWeightKg}
                    onChange={(e) => setTotalWeightKg(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-[#D7E5DB]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#173C32] mb-1">Price / kg (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    value={pricePerKg}
                    onChange={(e) => setPricePerKg(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-[#D7E5DB]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#173C32] mb-1">Description & Certification Notes</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D7E5DB]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D7E5DB]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#D7E5DB] text-[#6B7C74]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white font-semibold shadow-sm"
                >
                  {submitting ? "Publishing..." : "Verify Mass Balance & Publish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULFILLMENT MODAL */}
      {fulfillModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#D7E5DB] max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#D7E5DB] pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-[#075B46]">{fulfillModalOrder.orderId}</span>
                <h3 className="text-base font-serif text-[#173C32]">Update Fulfillment Status</h3>
              </div>
              <button
                onClick={() => setFulfillModalOrder(null)}
                className="p-1 rounded-lg hover:bg-[#EDF7EF] text-[#6B7C74]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateFulfillment} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#173C32] mb-1">Fulfillment Status *</label>
                <select
                  value={orderStatus}
                  onChange={(e) => setOrderStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D7E5DB] bg-white font-semibold"
                >
                  <option value="PROCESSING">Processing & Packaging</option>
                  <option value="DISPATCHED">Dispatched (In Freight Transit)</option>
                  <option value="DELIVERED">Delivered & Verified at Destination</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#173C32] mb-1">Logistics Tracking / Lorry Receipt No.</label>
                <input
                  type="text"
                  placeholder="e.g. VRL-BLR-2026-904"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D7E5DB]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#173C32] mb-1">Fulfillment Dispatch Notes</label>
                <textarea
                  rows={2}
                  placeholder="Tare weight verified, sealed with tamper tags..."
                  value={fulfillmentNotes}
                  onChange={(e) => setFulfillmentNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D7E5DB]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D7E5DB]">
                <button
                  type="button"
                  onClick={() => setFulfillModalOrder(null)}
                  className="px-4 py-2 rounded-xl border border-[#D7E5DB] text-[#6B7C74]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingFulfill}
                  className="px-5 py-2 rounded-xl bg-[#075B46] hover:bg-[#087F5B] text-white font-semibold shadow-sm"
                >
                  {submittingFulfill ? "Saving..." : "Update Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
